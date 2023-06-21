// Copyright 2022-2023 The Memphis.dev Authors
// Licensed under the Memphis Business Source License 1.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// Changed License: [Apache License, Version 2.0 (https://www.apache.org/licenses/LICENSE-2.0), as published by the Apache Foundation.
//
// https://github.com/memphisdev/memphis/blob/master/LICENSE
//
// Additional Use Grant: You may make use of the Licensed Work (i) only as part of your own product or service, provided it is not a message broker or a message queue product or service; and (ii) provided that you do not use, provide, distribute, or make available the Licensed Work as a Service.
// A "Service" is a commercial offering, product, hosted, or managed service, that allows third parties (other than your own employees and contractors acting on your behalf) to access and/or use the Licensed Work or a substantial set of the features or functionality of the Licensed Work to third parties as a software-as-a-service, platform-as-a-service, infrastructure-as-a-service or other similar services that compete with Licensor products or services.
package server

import (
	"encoding/json"
	"errors"
	"fmt"
	"memphis/db"
	"memphis/models"
	"sync"

	"strconv"
	"strings"
	"time"
)

const CONN_STATUS_SUBJ = "$memphis_connection_status"
const INTEGRATIONS_UPDATES_SUBJ = "$memphis_integration_updates"
const CONFIGURATIONS_RELOAD_SIGNAL_SUBJ = "$memphis_config_reload_signal"
const NOTIFICATION_EVENTS_SUBJ = "$memphis_notifications"
const PM_RESEND_ACK_SUBJ = "$memphis_pm_acks"
const TIERED_STORAGE_CONSUMER = "$memphis_tiered_storage_consumer"
const DLS_UNACKED_CONSUMER = "$memphis_dls_unacked_consumer"
const SCHEMAVERSE_DLS_SUBJ = "$memphis_schemaverse_dls"

var LastReadThroughputMap map[string]models.Throughput
var LastWriteThroughputMap map[string]models.Throughput
var tieredStorageMsgsMap *concurrentMap[map[string][]StoredMsg]
var tieredStorageMapLock sync.Mutex

func (s *Server) ListenForZombieConnCheckRequests() error {
	_, err := s.subscribeOnAcc(s.GlobalAccount(), CONN_STATUS_SUBJ, CONN_STATUS_SUBJ+"_sid", func(_ *client, subject, reply string, msg []byte) {
		go func(msg []byte) {
			connInfo := &ConnzOptions{Limit: s.GlobalAccount().MaxActiveConnections()}
			conns, _ := s.Connz(connInfo)
			connectionIds := make(map[string]string)
			for _, conn := range conns.Conns {
				connId := strings.Split(conn.Name, "::")[0]
				if connId != "" {
					connectionIds[connId] = ""
				}
			}

			if len(connectionIds) > 0 { // in case there are connections
				bytes, err := json.Marshal(connectionIds)
				if err != nil {
					s.Errorf("ListenForZombieConnCheckRequests: %v", err.Error())
				} else {
					s.sendInternalAccountMsgWithReply(s.GlobalAccount(), reply, _EMPTY_, nil, bytes, true)
				}
			}
		}(copyBytes(msg))
	})
	if err != nil {
		return err
	}
	return nil
}

func (s *Server) ListenForIntegrationsUpdateEvents() error {
	_, err := s.subscribeOnAcc(s.GlobalAccount(), INTEGRATIONS_UPDATES_SUBJ, INTEGRATIONS_UPDATES_SUBJ+"_sid", func(_ *client, subject, reply string, msg []byte) {
		go func(msg []byte) {
			var integrationUpdate models.CreateIntegration
			err := json.Unmarshal(msg, &integrationUpdate)
			if err != nil {
				s.Errorf("[tenant: %v]ListenForIntegrationsUpdateEvents: %v", integrationUpdate.TenantName, err.Error())
				return
			}
			switch strings.ToLower(integrationUpdate.Name) {
			case "slack":
				if s.opts.UiHost == "" {
					EditClusterCompHost("ui_host", integrationUpdate.UIUrl)
				}
				CacheDetails("slack", integrationUpdate.Keys, integrationUpdate.Properties, integrationUpdate.TenantName)
			case "s3":
				CacheDetails("s3", integrationUpdate.Keys, integrationUpdate.Properties, integrationUpdate.TenantName)
			default:
				s.Warnf("[tenant: %v] ListenForIntegrationsUpdateEvents: %s %s", integrationUpdate.TenantName, strings.ToLower(integrationUpdate.Name), "unknown integration")
				return
			}
		}(copyBytes(msg))
	})
	if err != nil {
		return err
	}
	return nil
}

func (s *Server) ListenForConfigReloadEvents() error {
	_, err := s.subscribeOnAcc(s.GlobalAccount(), CONFIGURATIONS_RELOAD_SIGNAL_SUBJ, CONFIGURATIONS_RELOAD_SIGNAL_SUBJ+"_sid", func(_ *client, subject, reply string, msg []byte) {
		go func(msg []byte) {
			// reload config
			err := s.Reload()
			if err != nil {
				s.Errorf("Failed reloading: %v", err.Error())
			}
		}(copyBytes(msg))
	})
	if err != nil {
		return err
	}
	return nil
}

func (s *Server) ListenForNotificationEvents() error {
	err := s.queueSubscribe(globalAccountName, NOTIFICATION_EVENTS_SUBJ, NOTIFICATION_EVENTS_SUBJ+"_group", func(_ *client, subject, reply string, msg []byte) {
		go func(msg []byte) {
			tenantName, message, err := s.getTenantNameAndMessage(msg)
			if err != nil {
				s.Errorf("[tenant: %v]ListenForNotificationEvents: %v", tenantName, err.Error())
				return
			}
			var notification models.Notification
			err = json.Unmarshal([]byte(message), &notification)
			if err != nil {
				s.Errorf("[tenant: %v]ListenForNotificationEvents: %v", tenantName, err.Error())
				return
			}
			notificationMsg := notification.Msg
			if notification.Code != "" {
				notificationMsg = notificationMsg + "\n```" + notification.Code + "```"
			}
			err = SendNotification(tenantName, notification.Title, notificationMsg, notification.Type)
			if err != nil {
				return
			}
		}(copyBytes(msg))
	})
	if err != nil {
		return err
	}
	return nil
}

func (s *Server) ListenForPoisonMsgAcks() error {
	err := s.queueSubscribe(globalAccountName, PM_RESEND_ACK_SUBJ, PM_RESEND_ACK_SUBJ+"_group", func(_ *client, subject, reply string, msg []byte) {
		go func(msg []byte) {
			tenantName, message, err := s.getTenantNameAndMessage(msg)
			if err != nil {
				s.Errorf("[tenant: %v]ListenForPoisonMsgAcks: %v", tenantName, err.Error())
				return
			}
			var msgToAck models.PmAckMsg
			err = json.Unmarshal([]byte(message), &msgToAck)
			if err != nil {
				s.Errorf("[tenant: %v]ListenForPoisonMsgAcks: %v", tenantName, err.Error())
				return
			}
			err = db.RemoveCgFromDlsMsg(msgToAck.ID, msgToAck.CgName, tenantName)
			if err != nil {
				return
			}

		}(copyBytes(msg))
	})
	if err != nil {
		return err
	}
	return nil
}

func getThroughputSubject(serverName string) string {
	return throughputStreamNameV1 + tsep + serverName
}

func (s *Server) InitializeThroughputSampling() {
	LastReadThroughputMap = map[string]models.Throughput{}
	LastWriteThroughputMap = map[string]models.Throughput{}
	for _, acc := range s.Opts().Accounts {
		LastReadThroughputMap[acc.GetName()] = models.Throughput{
			Bytes:       acc.outBytes,
			BytesPerSec: 0,
		}
		LastWriteThroughputMap[acc.GetName()] = models.Throughput{
			Bytes:       acc.inBytes,
			BytesPerSec: 0,
		}
	}
	go s.CalculateSelfThroughput()
}

func (s *Server) CalculateSelfThroughput() {
	for range time.Tick(time.Second * 1) {
		readMap := map[string]int64{}
		writeMap := map[string]int64{}
		s.accounts.Range(func(_, v interface{}) bool {
			acc := v.(*Account)
			accName := acc.GetName()
			currentRead := acc.outBytes - LastReadThroughputMap[accName].Bytes
			LastReadThroughputMap[accName] = models.Throughput{
				Bytes:       acc.outBytes,
				BytesPerSec: currentRead,
			}
			readMap[accName] = currentRead
			currentWrite := acc.inBytes - LastWriteThroughputMap[accName].Bytes
			LastWriteThroughputMap[accName] = models.Throughput{
				Bytes:       acc.inBytes,
				BytesPerSec: currentWrite,
			}
			writeMap[accName] = currentWrite
			return true
		})
		serverName := s.opts.ServerName
		subj := getThroughputSubject(serverName)
		tpMsg := models.BrokerThroughput{
			Name:     serverName,
			ReadMap:  readMap,
			WriteMap: writeMap,
		}
		s.sendInternalAccountMsg(s.GlobalAccount(), subj, tpMsg)
	}
}

func (s *Server) StartBackgroundTasks() error {
	err := s.ListenForZombieConnCheckRequests()
	if err != nil {
		return errors.New("Failed subscribing for zombie conns check requests: " + err.Error())
	}

	err = s.ListenForIntegrationsUpdateEvents()
	if err != nil {
		return errors.New("Failed subscribing for integrations updates: " + err.Error())
	}

	err = s.ListenForNotificationEvents()
	if err != nil {
		return errors.New("Failed subscribing for schema validation updates: " + err.Error())
	}

	err = s.ListenForPoisonMsgAcks()
	if err != nil {
		return errors.New("Failed subscribing for poison message acks: " + err.Error())
	}

	err = s.ListenForConfigReloadEvents()
	if err != nil {
		return errors.New("Failed subscribing for configurations update: " + err.Error())
	}

	err = s.ListenForSchemaverseDlsEvents()
	if err != nil {
		return errors.New("Failed to subscribing for schemaverse dls" + err.Error())
	}

	go s.ConsumeUnackedMsgs()
	go s.ConsumeTieredStorageMsgs()
	go s.RemoveOldDlsMsgs()
	go s.uploadMsgsToTier2Storage()
	go s.InitializeThroughputSampling()
	go s.UploadTenantUsageToDB()
	go s.RefreshFirebaseFunctionsKey()

	return nil
}

func (s *Server) uploadMsgsToTier2Storage() {
	currentTimeFrame := s.opts.TieredStorageUploadIntervalSec
	ticker := time.NewTicker(time.Duration(currentTimeFrame) * time.Second)
	for range ticker.C {
		if s.opts.TieredStorageUploadIntervalSec != currentTimeFrame {
			currentTimeFrame = s.opts.TieredStorageUploadIntervalSec
			ticker.Reset(time.Duration(currentTimeFrame) * time.Second)
			// update consumer when TIERED_STORAGE_TIME_FRAME_SEC configuration was changed
			cc := ConsumerConfig{
				DeliverPolicy: DeliverAll,
				AckPolicy:     AckExplicit,
				Durable:       TIERED_STORAGE_CONSUMER,
				FilterSubject: tieredStorageStream + ".>",
				AckWait:       time.Duration(2) * time.Duration(currentTimeFrame) * time.Second,
				MaxAckPending: -1,
				MaxDeliver:    10,
			}
			err := serv.memphisAddConsumer(globalAccountName, tieredStorageStream, &cc)
			if err != nil {
				serv.Errorf("Failed add tiered storage consumer: %v", err.Error())
				return
			}
			TIERED_STORAGE_CONSUMER_CREATED = true
		}
		tieredStorageMapLock.Lock()
		err := flushMapToTire2Storage()
		if err != nil {
			serv.Errorf("Failed upload messages to tiered 2 storage: %v", err.Error())
			tieredStorageMapLock.Unlock()
			continue
		}
		// ack all messages uploaded to tiered 2 storage or when there is no s3 integaration to tenant
		for t, tenant := range tieredStorageMsgsMap.m {
			for i, msgs := range tenant {
				for _, msg := range msgs {
					reply := msg.ReplySubject
					s.sendInternalAccountMsg(s.GlobalAccount(), reply, []byte(_EMPTY_))
				}
				delete(tenant, i)
			}
			tieredStorageMsgsMap.Delete(t)
		}

		tieredStorageMapLock.Unlock()
	}
}

func (s *Server) ConsumeUnackedMsgs() {
	type unAckedMsg struct {
		Msg          []byte
		ReplySubject string
	}
	amount := 1000
	req := []byte(strconv.FormatUint(uint64(amount), 10))
	for {
		if DLS_UNACKED_CONSUMER_CREATED && DLS_UNACKED_STREAM_CREATED {
			resp := make(chan unAckedMsg)
			replySubj := DLS_UNACKED_CONSUMER + "_reply_" + s.memphis.nuid.Next()

			// subscribe to unacked messages
			sub, err := s.subscribeOnAcc(s.GlobalAccount(), replySubj, replySubj+"_sid", func(_ *client, subject, reply string, msg []byte) {
				go func(subject, reply string, msg []byte) {
					// Ignore 409 Exceeded MaxWaiting cases
					if reply != "" {
						message := unAckedMsg{
							Msg:          msg,
							ReplySubject: reply,
						}
						resp <- message
					}
				}(subject, reply, copyBytes(msg))
			})
			if err != nil {
				s.Errorf("Failed to subscribe to unacked messages: %v", err.Error())
				continue
			}

			// send JS API request to get more messages
			subject := fmt.Sprintf(JSApiRequestNextT, dlsUnackedStream, DLS_UNACKED_CONSUMER)
			s.sendInternalAccountMsgWithReply(s.GlobalAccount(), subject, replySubj, nil, req, true)

			timeout := time.NewTimer(5 * time.Second)
			msgs := make([]unAckedMsg, 0)
			stop := false
			for {
				if stop {
					s.unsubscribeOnAcc(s.GlobalAccount(), sub)
					break
				}
				select {
				case unAckedMsg := <-resp:
					msgs = append(msgs, unAckedMsg)
					if len(msgs) == amount {
						stop = true
					}
				case <-timeout.C:
					stop = true
				}
			}
			for _, msg := range msgs {
				err := s.handleNewUnackedMsg(msg.Msg)
				if err == nil {
					// send ack
					s.sendInternalAccountMsgWithEcho(s.GlobalAccount(), msg.ReplySubject, []byte(_EMPTY_))
				}
			}
		} else {
			time.Sleep(2 * time.Second)
		}
	}
}

func (s *Server) ConsumeTieredStorageMsgs() {
	type tsMsg struct {
		Msg          []byte
		ReplySubject string
	}

	tieredStorageMsgsMap = NewConcurrentMap[map[string][]StoredMsg]()
	amount := 1000
	req := []byte(strconv.FormatUint(uint64(amount), 10))
	for {
		if TIERED_STORAGE_CONSUMER_CREATED && TIERED_STORAGE_STREAM_CREATED {
			resp := make(chan tsMsg)
			replySubj := TIERED_STORAGE_CONSUMER + "_reply_" + s.memphis.nuid.Next()

			// subscribe to unacked messages
			sub, err := s.subscribeOnAcc(s.GlobalAccount(), replySubj, replySubj+"_sid", func(_ *client, subject, reply string, msg []byte) {
				go func(subject, reply string, msg []byte) {
					// Ignore 409 Exceeded MaxWaiting cases
					if reply != "" {
						message := tsMsg{
							Msg:          msg,
							ReplySubject: reply,
						}
						resp <- message
					}
				}(subject, reply, copyBytes(msg))
			})
			if err != nil {
				s.Errorf("Failed to subscribe to tiered storage messages: %v", err.Error())
				continue
			}

			// send JS API request to get more messages
			subject := fmt.Sprintf(JSApiRequestNextT, tieredStorageStream, TIERED_STORAGE_CONSUMER)
			s.sendInternalAccountMsgWithReply(s.GlobalAccount(), subject, replySubj, nil, req, true)

			timeout := time.NewTimer(5 * time.Second)
			msgs := make([]tsMsg, 0)
			stop := false
			for {
				if stop {
					s.unsubscribeOnAcc(s.GlobalAccount(), sub)
					break
				}
				select {
				case tieredStorageMsg := <-resp:
					msgs = append(msgs, tieredStorageMsg)
					if len(msgs) == amount {
						stop = true
					}
				case <-timeout.C:
					stop = true
				}
			}
			for _, message := range msgs {
				msg := message.Msg
				reply := message.ReplySubject
				s.handleNewTieredStorageMsg(msg, reply)
			}
		} else {
			time.Sleep(2 * time.Second)
		}
	}
}

func (s *Server) ListenForSchemaverseDlsEvents() error {
	err := s.queueSubscribe(globalAccountName, SCHEMAVERSE_DLS_SUBJ, SCHEMAVERSE_DLS_SUBJ+"_group", func(_ *client, subject, reply string, msg []byte) {
		go func(msg []byte) {
			tenantName, stringMessage, err := s.getTenantNameAndMessage(msg)
			if err != nil {
				s.Errorf("[tenant: %v]ListenForNotificationEvents: %v", tenantName, err.Error())
				return
			}
			var message models.SchemaVerseDlsMessageSdk
			err = json.Unmarshal([]byte(stringMessage), &message)
			if err != nil {
				serv.Errorf("[tenant: %v]ListenForSchemaverseDlsEvents: %v", tenantName, err.Error())
				return
			}

			exist, station, err := db.GetStationByName(message.StationName, tenantName)
			if err != nil {
				serv.Errorf("[tenant: %v]ListenForSchemaverseDlsEvents: %v", tenantName, err.Error())
				return
			}
			if !exist {
				serv.Warnf("[tenant: %v]ListenForSchemaverseDlsEvents: station %v couldn't been found", tenantName, message.StationName)
				return
			}

			exist, p, err := db.GetProducerByNameAndConnectionID(message.Producer.Name, message.Producer.ConnectionId)
			if err != nil {
				serv.Errorf("[tenant: %v]ListenForSchemaverseDlsEvents: %v", tenantName, err.Error())
				return
			}

			if !exist {
				serv.Warnf("[tenant: %v]ListenForSchemaverseDlsEvents: producer %v couldn't been found", tenantName, p.Name)
				return
			}

			message.Message.TimeSent = time.Now()
			_, err = db.InsertSchemaverseDlsMsg(station.ID, 0, p.ID, []string{}, models.MessagePayload(message.Message), message.ValidationError, tenantName)
			if err != nil {
				serv.Errorf("[tenant: %v]ListenForSchemaverseDlsEvents: %v", tenantName, err.Error())
				return
			}
		}(copyBytes(msg))
	})
	if err != nil {
		return err
	}

	return nil
}

func (s *Server) RemoveOldDlsMsgs() {
	ticker := time.NewTicker(2 * time.Minute)
	for range ticker.C {
		configurationTime := time.Now().Add(time.Hour * time.Duration(-s.opts.DlsRetentionHours))
		err := db.DeleteOldDlsMessageByRetention(configurationTime)
		if err != nil {
			serv.Errorf("RemoveOldDlsMsgs: %v", err.Error())
		}
	}
}
