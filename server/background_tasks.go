// Copyright 2022-2023 The Memphis.dev Authors
// Licensed under the Memphis Business Source License 1.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// Changed License: [Apache License, Version 2.0 (https://www.apache.org/licenses/LICENSE-2.0), as published by the Apache Foundation.
//
// https://github.com/memphisdev/memphis-broker/blob/master/LICENSE
//
// Additional Use Grant: You may make use of the Licensed Work (i) only as part of your own product or service, provided it is not a message broker or a message queue product or service; and (ii) provided that you do not use, provide, distribute, or make available the Licensed Work as a Service.
// A "Service" is a commercial offering, product, hosted, or managed service, that allows third parties (other than your own employees and contractors acting on your behalf) to access and/or use the Licensed Work or a substantial set of the features or functionality of the Licensed Work to third parties as a software-as-a-service, platform-as-a-service, infrastructure-as-a-service or other similar services that compete with Licensor products or services.
package server

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"memphis-broker/models"
	"sync"

	"strconv"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

const CONN_STATUS_SUBJ = "$memphis_connection_status"
const INTEGRATIONS_UPDATES_SUBJ = "$memphis_integration_updates"
const CONFIGURATIONS_UPDATES_SUBJ = "$memphis_configurations_updates"
const NOTIFICATION_EVENTS_SUBJ = "$memphis_notifications"
const PM_RESEND_ACK_SUBJ = "$memphis_pm_acks"
const TIERED_STORAGE_CONSUMER = "$memphis_tiered_storage_consumer"

var LastReadThroughput models.Throughput
var LastWriteThroughput models.Throughput
var tieredStorageMsgsMap *concurrentMap[[]StoredMsg]
var tieredStorageMapLock sync.Mutex

func (s *Server) ListenForZombieConnCheckRequests() error {
	_, err := s.subscribeOnGlobalAcc(CONN_STATUS_SUBJ, CONN_STATUS_SUBJ+"_sid", func(_ *client, subject, reply string, msg []byte) {
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
					s.Errorf("ListenForZombieConnCheckRequests: " + err.Error())
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
	_, err := s.subscribeOnGlobalAcc(INTEGRATIONS_UPDATES_SUBJ, INTEGRATIONS_UPDATES_SUBJ+"_sid"+s.Name(), func(_ *client, subject, reply string, msg []byte) {
		go func(msg []byte) {
			var integrationUpdate models.CreateIntegrationSchema
			err := json.Unmarshal(msg, &integrationUpdate)
			if err != nil {
				s.Errorf("ListenForIntegrationsUpdateEvents: " + err.Error())
				return
			}
			switch strings.ToLower(integrationUpdate.Name) {
			case "slack":
				if UI_HOST == "" {
					UI_HOST = integrationUpdate.UIUrl
				}
				configurationsCollection.UpdateOne(context.TODO(), bson.M{"key": "ui_host"},
					bson.M{"$set": bson.M{"value": UI_HOST}})

				CacheDetails("slack", integrationUpdate.Keys, integrationUpdate.Properties)
			case "s3":
				CacheDetails("s3", integrationUpdate.Keys, integrationUpdate.Properties)
			default:
				s.Warnf("ListenForIntegrationsUpdateEvents: %s %s", strings.ToLower(integrationUpdate.Name), "unknown integration")
				return
			}
		}(copyBytes(msg))
	})
	if err != nil {
		return err
	}
	return nil
}

func (s *Server) ListenForConfigurationsUpdateEvents() error {
	_, err := s.subscribeOnGlobalAcc(CONFIGURATIONS_UPDATES_SUBJ, CONFIGURATIONS_UPDATES_SUBJ+"_sid"+s.Name(), func(_ *client, subject, reply string, msg []byte) {
		go func(msg []byte) {
			var configurationsUpdate models.ConfigurationsUpdate
			err := json.Unmarshal(msg, &configurationsUpdate)
			if err != nil {
				s.Errorf("ListenForConfigurationsUpdateEvents: " + err.Error())
				return
			}
			switch strings.ToLower(configurationsUpdate.Type) {
			case "pm_retention":
				POISON_MSGS_RETENTION_IN_HOURS = int(configurationsUpdate.Update.(float64))
			case "tiered_storage_time_sec":
				TIERED_STORAGE_TIME_FRAME_SEC = int(configurationsUpdate.Update.(float64))
			case "broker_host":
				BROKER_HOST = fmt.Sprintf("%v", configurationsUpdate.Update)
			case "ui_host":
				UI_HOST = fmt.Sprintf("%v", configurationsUpdate.Update)
			case "rest_gw_host":
				REST_GW_HOST = fmt.Sprintf("%v", configurationsUpdate.Update)
			default:
				return
			}
		}(copyBytes(msg))
	})
	if err != nil {
		return err
	}
	return nil
}

func (s *Server) ListenForNotificationEvents() error {
	err := s.queueSubscribe(NOTIFICATION_EVENTS_SUBJ, NOTIFICATION_EVENTS_SUBJ+"_group", func(_ *client, subject, reply string, msg []byte) {
		go func(msg []byte) {
			var notification models.Notification
			err := json.Unmarshal(msg, &notification)
			if err != nil {
				s.Errorf("ListenForNotificationEvents: " + err.Error())
				return
			}
			notificationMsg := notification.Msg
			if notification.Code != "" {
				notificationMsg = notificationMsg + "\n```" + notification.Code + "```"
			}
			err = SendNotification(notification.Title, notificationMsg, notification.Type)
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

func ackPoisonMsgV0(msgId string, cgName string) error {
	splitId := strings.Split(msgId, dlsMsgSep)
	stationName := splitId[0]
	sn, err := StationNameFromStr(stationName)
	if err != nil {
		return err
	}
	streamName := fmt.Sprintf(dlsStreamName, sn.Intern())
	uid := serv.memphis.nuid.Next()
	durableName := "$memphis_fetch_dls_consumer_" + uid
	amount := uint64(1)
	internalCgName := replaceDelimiters(cgName)
	filter := GetDlsSubject("poison", sn.Intern(), msgId, internalCgName)
	timeout := 30 * time.Second
	msgs, err := serv.memphisGetMessagesByFilter(streamName, filter, 0, amount, timeout)

	if len(msgs) != 1 {
		return errors.New("message was not found")
	}

	msg := msgs[0]
	var dlsMsg models.DlsMessage
	err = json.Unmarshal(msg.Data, &dlsMsg)
	if err != nil {
		return err
	}

	err = serv.memphisRemoveConsumer(streamName, durableName)
	if err != nil {
		return err
	}
	return nil
}

func (s *Server) ListenForPoisonMsgAcks() error {
	err := s.queueSubscribe(PM_RESEND_ACK_SUBJ, PM_RESEND_ACK_SUBJ+"_group", func(_ *client, subject, reply string, msg []byte) {
		go func(msg []byte) {
			var msgToAck models.PmAckMsg
			err := json.Unmarshal(msg, &msgToAck)
			if err != nil {
				s.Errorf("ListenForPoisonMsgAcks: " + err.Error())
				return
			}
			//This check for backward compatability
			if msgToAck.CgName != "" {
				err = ackPoisonMsgV0(msgToAck.ID, msgToAck.CgName)
				if err != nil {
					s.Errorf("ListenForPoisonMsgAcks: " + err.Error())
					return
				}
			} else {
				splitId := strings.Split(msgToAck.ID, dlsMsgSep)
				stationName := splitId[0]
				sn, err := StationNameFromStr(stationName)
				if err != nil {
					s.Errorf("ListenForPoisonMsgAcks: " + err.Error())
					return
				}
				streamName := fmt.Sprintf(dlsStreamName, sn.Intern())
				seq, err := strconv.ParseInt(msgToAck.Sequence, 10, 64)
				if err != nil {
					s.Errorf("ListenForPoisonMsgAcks: " + err.Error())
					return
				}
				_, err = s.memphisDeleteMsgFromStream(streamName, uint64(seq))
				if err != nil {
					s.Errorf("ListenForPoisonMsgAcks: " + err.Error())
					return
				}
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

func (s *Server) InitializeThroughputSampling() error {
	v, err := serv.Varz(nil)
	if err != nil {
		return err
	}

	LastReadThroughput = models.Throughput{
		Bytes:       v.OutBytes,
		BytesPerSec: 0,
	}
	LastWriteThroughput = models.Throughput{
		Bytes:       v.InBytes,
		BytesPerSec: 0,
	}

	go s.CalculateSelfThroughput()

	return nil
}

func (s *Server) CalculateSelfThroughput() error {
	for range time.Tick(time.Second * 1) {
		v, err := serv.Varz(nil)
		if err != nil {
			return err
		}

		currentWrite := v.InBytes - LastWriteThroughput.Bytes
		LastWriteThroughput = models.Throughput{
			Bytes:       v.InBytes,
			BytesPerSec: currentWrite,
		}
		currentRead := v.OutBytes - LastReadThroughput.Bytes
		LastReadThroughput = models.Throughput{
			Bytes:       v.OutBytes,
			BytesPerSec: currentRead,
		}
		serverName := configuration.SERVER_NAME
		subj := getThroughputSubject(serverName)
		tpMsg := models.BrokerThroughput{
			Name:  serverName,
			Read:  currentRead,
			Write: currentWrite,
		}
		s.sendInternalAccountMsg(s.GlobalAccount(), subj, tpMsg)
	}

	return nil
}

func (s *Server) StartBackgroundTasks() error {
	s.ListenForPoisonMessages()
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

	err = s.ListenForConfigurationsUpdateEvents()
	if err != nil {
		return errors.New("Failed subscribing for configurations update: " + err.Error())
	}

	// creating consumer + start listening
	err = s.ListenForTieredStorageMessages()
	if err != nil {
		return errors.New("Failed to subscribe for tiered storage messages" + err.Error())
	}

	// send JS API request to get more messages
	go s.sendPeriodicJsApiFetchTieredStorageMsgs()
	go s.uploadMsgsToTier2Storage()

	filter := bson.M{"key": "ui_host"}
	var configurationsStringValue models.ConfigurationsStringValue
	err = configurationsCollection.FindOne(context.TODO(), filter).Decode(&configurationsStringValue)
	if err == mongo.ErrNoDocuments {
		UI_HOST = ""
		uiUrlKey := models.SystemKey{
			ID:    primitive.NewObjectID(),
			Key:   "ui_host",
			Value: UI_HOST,
		}

		_, err = configurationsCollection.InsertOne(context.TODO(), uiUrlKey)
		if err != nil {
			return err
		}
	} else if err != nil {
		return err
	} else {
		UI_HOST = configurationsStringValue.Value
	}

	err = s.InitializeThroughputSampling()
	if err != nil {
		return err
	}
	return nil
}

func (s *Server) uploadMsgsToTier2Storage() {
	currentTimeFrame := TIERED_STORAGE_TIME_FRAME_SEC
	ticker := time.NewTicker(time.Duration(TIERED_STORAGE_TIME_FRAME_SEC) * time.Second)
	for range ticker.C {
		if TIERED_STORAGE_TIME_FRAME_SEC != currentTimeFrame {
			currentTimeFrame = TIERED_STORAGE_TIME_FRAME_SEC
			ticker.Reset(time.Duration(TIERED_STORAGE_TIME_FRAME_SEC) * time.Second)
		}
		tieredStorageMapLock.Lock()
		if len(tieredStorageMsgsMap.m) > 0 {
			err := flushMapToTire2Storage()
			if err != nil {
				serv.Errorf("Failed upload messages to tiered 2 storage: " + err.Error())
				tieredStorageMapLock.Unlock()
				continue
			}
		}

		for i, msgs := range tieredStorageMsgsMap.m {
			for _, msg := range msgs {
				reply := msg.ReplySubject
				s.sendInternalAccountMsg(s.GlobalAccount(), reply, []byte(_EMPTY_))
			}
			tieredStorageMsgsMap.Delete(i)
		}
		tieredStorageMapLock.Unlock()
	}
}

func (s *Server) sendPeriodicJsApiFetchTieredStorageMsgs() {
	ticker := time.NewTicker(2 * time.Second)
	for range ticker.C {
		if TIERED_STORAGE_CONSUMER_CREATED && TIERED_STORAGE_STREAM_CREATED {
			durableName := TIERED_STORAGE_CONSUMER
			subject := fmt.Sprintf(JSApiRequestNextT, tieredStorageStream, durableName)
			reply := durableName + "_reply"
			amount := 1000
			req := []byte(strconv.FormatUint(uint64(amount), 10))
			serv.sendInternalAccountMsgWithReply(serv.GlobalAccount(), subject, reply, nil, req, true)
		}
	}
}

func (s *Server) ListenForTieredStorageMessages() error {
	tieredStorageMsgsMap = NewConcurrentMap[[]StoredMsg]()

	subject := TIERED_STORAGE_CONSUMER + "_reply"
	err := serv.queueSubscribe(subject, subject+"_sid", func(_ *client, subject, reply string, msg []byte) {
		go func(subject, reply string, msg []byte) {
			//Ignore 409 Exceeded MaxWaiting cases
			if reply != "" {
				rawMsg := strings.Split(string(msg), CR_LF+CR_LF)
				var tieredStorageMsg TieredStorageMsg
				if len(rawMsg) == 2 {
					err := json.Unmarshal([]byte(rawMsg[1]), &tieredStorageMsg)
					if err != nil {
						serv.Errorf("Failed unmarshalling tiered storage message: " + err.Error())
						return
					}
				} else {
					serv.Errorf("Invalid tiered storage message structure: message must contains msg-id header")
					return
				}
				payload := tieredStorageMsg.Buf
				replySubj := reply
				rawTs := tokenAt(reply, 8)
				seq, _, _ := ackReplyInfo(reply)
				intTs, err := strconv.Atoi(rawTs)
				if err != nil {
					serv.Errorf("Failed convert rawTs from string to int")
					return
				}

				dataFirstIdx := 0
				dataFirstIdx = getHdrLastIdxFromRaw(payload) + 1
				if dataFirstIdx > len(payload)-len(CR_LF) {
					s.Errorf("memphis error parsing")
					return
				}
				dataLen := len(payload) - dataFirstIdx
				header := payload[:dataFirstIdx]
				data := payload[dataFirstIdx : dataFirstIdx+dataLen]
				message := StoredMsg{
					Subject:      tieredStorageMsg.StationName,
					Sequence:     uint64(seq),
					Data:         data,
					Header:       header,
					Time:         time.Unix(0, int64(intTs)),
					ReplySubject: replySubj,
				}

				s.storeInTieredStorageMap(message)
			}
		}(subject, reply, copyBytes(msg))
	})
	if err != nil {
		serv.Errorf("Failed queueSubscribe tiered storage: " + err.Error())
		return err
	}

	return nil
}
