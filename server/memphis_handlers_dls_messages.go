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
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"memphis/db"
	"memphis/models"
	"sort"
	"strconv"
	"strings"
)

const (
	PoisonMessageTitle = "Poison message"
	dlsMsgSep          = "~"
)

type PoisonMessagesHandler struct{ S *Server }

func (s *Server) handleNewUnackedMsg(msg []byte) error {
	var message JSConsumerDeliveryExceededAdvisory
	err := json.Unmarshal(msg, &message)
	if err != nil {
		serv.Errorf("handleNewUnackedMsg: Error while getting notified about a poison message: %v", err.Error())
		return err
	}

	streamName := message.Stream
	accountName := message.Account
	// backward compatibility
	if accountName == "" {
		accountName = MEMPHIS_GLOBAL_ACCOUNT
	}
	stationName := StationNameFromStreamName(streamName)
	_, station, err := db.GetStationByName(stationName.Ext(), accountName)
	if err != nil {
		serv.Errorf("handleNewUnackedMsg: station: %v, Error while getting notified about a poison message: %v", stationName.Ext(), err.Error())
		return err
	}
	if !station.DlsConfigurationPoison {
		return nil
	}

	cgName := message.Consumer
	cgName = revertDelimiters(cgName)
	messageSeq := message.StreamSeq
	poisonMessageContent, err := s.memphisGetMessage(accountName, stationName.Intern(), uint64(messageSeq))
	if err != nil {
		if IsNatsErr(err, JSNoMessageFoundErr) {
			return nil
		}
		serv.Errorf("handleNewUnackedMsg: station: %v, Error while getting notified about a poison message: %v", stationName.Ext(), err.Error())
		return err
	}

	producedByHeader := ""
	var headersJson map[string]string
	if poisonMessageContent.Header != nil {
		headersJson, err = DecodeHeader(poisonMessageContent.Header)
		if err != nil {
			serv.Errorf("handleNewUnackedMsg: %v", err.Error())
			return err
		}
	}

	var producerId int
	poisonedCgs := []string{}
	if station.IsNative {
		connectionIdHeader := headersJson["$memphis_connectionId"]
		producedByHeader = headersJson["$memphis_producedBy"]

		// This check for backward compatability
		if connectionIdHeader == "" || producedByHeader == "" {
			connectionIdHeader = headersJson["connectionId"]
			producedByHeader = headersJson["producedBy"]
			if connectionIdHeader == "" || producedByHeader == "" {
				serv.Warnf("handleNewUnackedMsg: Error while getting notified about a poison message: Missing mandatory message headers, please upgrade the SDK version you are using")
				return nil
			}
		}

		if producedByHeader == "$memphis_dls" { // skip poison messages which have been resent
			return nil
		}

		connId := connectionIdHeader
		exist, p, err := db.GetProducerByNameAndConnectionID(producedByHeader, connId)
		if err != nil {
			serv.Errorf("handleNewUnackedMsg: Error while getting notified about a poison message: %v", err.Error())
			return err
		}
		if !exist {
			serv.Warnf("handleNewUnackedMsg: producer %v couldn't been found", producedByHeader)
			return nil
		}
		producerId = p.ID
		poisonedCgs = append(poisonedCgs, cgName)
	}

	messageDetails := models.MessagePayload{
		TimeSent: poisonMessageContent.Time,
		Size:     len(poisonMessageContent.Data) + len(poisonMessageContent.Header),
		Data:     hex.EncodeToString(poisonMessageContent.Data),
		Headers:  headersJson,
	}

	dlsMsgId, err := db.StorePoisonMsg(station.ID, int(messageSeq), cgName, producerId, poisonedCgs, messageDetails, station.TenantName)
	if err != nil {
		serv.Errorf("[tenant: %v]handleNewUnackedMsg atStorePoisonMsg: Error while getting notified about a poison message: %v", station.TenantName, err.Error())
		return err
	}
	if dlsMsgId == 0 { // nothing to do
		return nil
	}

	idForUrl := strconv.Itoa(dlsMsgId)
	var msgUrl = s.opts.UiHost + "/stations/" + stationName.Ext() + "/" + idForUrl
	err = SendNotification(station.TenantName, PoisonMessageTitle, "Poison message has been identified, for more details head to: "+msgUrl, PoisonMAlert)
	if err != nil {
		serv.Warnf("[tenant: %v]handleNewUnackedMsg at SendNotification: Error while sending a poison message notification: %v", station.TenantName, err.Error())
		return nil
	}
	return nil
}

func (pmh PoisonMessagesHandler) GetDlsMsgsByStationLight(station models.Station) ([]models.LightDlsMessageResponse, []models.LightDlsMessageResponse, int, error) {
	poisonMessages := make([]models.LightDlsMessageResponse, 0)
	schemaMessages := make([]models.LightDlsMessageResponse, 0)

	dlsMsgs, err := db.GetDlsMsgsByStationId(station.ID)
	if err != nil {
		return []models.LightDlsMessageResponse{}, []models.LightDlsMessageResponse{}, 0, err
	}

	for _, v := range dlsMsgs {
		data := v.MessageDetails.Data
		if len(data) > 80 { // get the first chars for preview needs
			data = data[0:80]
		}
		messageDetails := models.MessagePayload{
			TimeSent: v.MessageDetails.TimeSent,
			Size:     v.MessageDetails.Size,
			Data:     data,
			Headers:  v.MessageDetails.Headers,
		}
		switch v.MessageType {
		case "poison":
			poisonMessages = append(poisonMessages, models.LightDlsMessageResponse{MessageSeq: v.MessageSeq, ID: v.ID, Message: messageDetails})
		case "schema":
			messageDetails.Size = len(v.MessageDetails.Data) + len(v.MessageDetails.Headers)
			schemaMessages = append(schemaMessages, models.LightDlsMessageResponse{MessageSeq: v.MessageSeq, ID: v.ID, Message: v.MessageDetails})
		}
	}

	lenPoison, lenSchema := len(poisonMessages), len(schemaMessages)
	totalDlsAmount := lenPoison + lenSchema

	sort.Slice(poisonMessages, func(i, j int) bool {
		return poisonMessages[i].Message.TimeSent.After(poisonMessages[j].Message.TimeSent)
	})

	sort.Slice(schemaMessages, func(i, j int) bool {
		return schemaMessages[i].Message.TimeSent.After(schemaMessages[j].Message.TimeSent)
	})

	if lenPoison > 1000 {
		poisonMessages = poisonMessages[:1000]
	}

	if lenSchema > 1000 {
		schemaMessages = schemaMessages[:1000]
	}
	return poisonMessages, schemaMessages, totalDlsAmount, nil
}

func (pmh PoisonMessagesHandler) GetDlsMessageDetailsById(messageId int, dlsType string, tenantName string) (models.DlsMessageResponse, error) {
	exist, dlsMessage, err := db.GetDlsMessageById(messageId)
	if err != nil {
		return models.DlsMessageResponse{}, err
	}
	if !exist {
		return models.DlsMessageResponse{}, errors.New("dls message does not exists")
	}
	exist, station, err := db.GetStationById(dlsMessage.StationId, dlsMessage.TenantName)
	if err != nil {
		return models.DlsMessageResponse{}, err
	}
	if !exist {
		return models.DlsMessageResponse{}, fmt.Errorf("Station %v does not exists", station.Name)
	}

	sn, err := StationNameFromStr(station.Name)
	if err != nil {
		return models.DlsMessageResponse{}, err
	}

	poisonedCgs := []models.PoisonedCg{}
	var producer models.Producer
	var clientAddress string
	var connectionId string

	msgDetails := models.MessagePayload{
		TimeSent: dlsMessage.MessageDetails.TimeSent,
		Size:     dlsMessage.MessageDetails.Size,
		Data:     dlsMessage.MessageDetails.Data,
		Headers:  dlsMessage.MessageDetails.Headers,
	}
	dlsMsg := models.DlsMessage{
		ID:              dlsMessage.ID,
		StationId:       dlsMessage.StationId,
		MessageSeq:      dlsMessage.MessageSeq,
		ProducerId:      dlsMessage.ProducerId,
		PoisonedCgs:     dlsMessage.PoisonedCgs,
		MessageDetails:  msgDetails,
		UpdatedAt:       dlsMessage.UpdatedAt,
		MessageType:     dlsMessage.MessageType,
		ValidationError: dlsMessage.ValidationError,
	}

	if station.IsNative {
		connectionIdHeader := dlsMsg.MessageDetails.Headers["$memphis_connectionId"]
		//This check for backward compatability
		if connectionIdHeader == "" {
			connectionIdHeader = dlsMsg.MessageDetails.Headers["connectionId"]
			if connectionIdHeader == "" {
				return models.DlsMessageResponse{}, nil
			}
		}
		connectionId = connectionIdHeader
		_, conn, err := db.GetConnectionByID(connectionId)
		if err != nil {
			return models.DlsMessageResponse{}, err
		}
		clientAddress = conn.ClientAddress

		exist, prod, err := db.GetProducerByID(dlsMsg.ProducerId)
		if err != nil {
			return models.DlsMessageResponse{}, err
		}
		if !exist {
			return models.DlsMessageResponse{}, fmt.Errorf("Producer %v does not exist", prod.Name)
		}
		producer = prod

		pc := models.PoisonedCg{}
		pCg := dlsMsg.PoisonedCgs
		for _, v := range pCg {
			cgInfo, err := serv.GetCgInfo(station.TenantName, sn, v)
			if err != nil {
				return models.DlsMessageResponse{}, err
			}
			cgMembers, err := GetConsumerGroupMembers(v, station)
			if err != nil {
				return models.DlsMessageResponse{}, err
			}
			pc.IsActive, pc.IsDeleted = getCgStatus(cgMembers)

			pc.CgName = v
			pc.TotalPoisonMessages = -1
			pc.MaxAckTimeMs = cgMembers[0].MaxAckTimeMs
			pc.MaxMsgDeliveries = cgMembers[0].MaxMsgDeliveries
			pc.CgMembers = cgMembers
			pc.UnprocessedMessages = int(cgInfo.NumPending)
			pc.InProcessMessages = cgInfo.NumAckPending
			poisonedCgs = append(poisonedCgs, pc)

		}

		if dlsType == "schema" {
			size := len(dlsMessage.MessageDetails.Data) + len(dlsMessage.MessageDetails.Headers)
			dlsMsg.MessageDetails.Size = size
		}

		for header := range dlsMsg.MessageDetails.Headers {
			if strings.HasPrefix(header, "$memphis") {
				delete(dlsMsg.MessageDetails.Headers, header)
			}
		}
	}

	sort.Slice(poisonedCgs, func(i, j int) bool {
		return poisonedCgs[i].CgName < poisonedCgs[j].CgName
	})

	schemaType := ""
	if station.SchemaName != "" {
		exist, schema, err := db.GetSchemaByName(station.SchemaName, station.TenantName)
		if err != nil {
			return models.DlsMessageResponse{}, err
		}
		if exist {
			schemaType = schema.Type
		}
	}

	result := models.DlsMessageResponse{
		ID:          dlsMsg.ID,
		StationName: station.Name,
		SchemaType:  schemaType,
		MessageSeq:  dlsMsg.MessageSeq,
		Producer: models.ProducerDetails{
			Name:              producer.Name,
			ConnectionId:      producer.ConnectionId,
			ClientAddress:     clientAddress,
			CreatedBy:         producer.CreatedBy,
			CreatedByUsername: producer.CreatedByUsername,
			IsActive:          producer.IsActive,
			IsDeleted:         producer.IsDeleted,
		},
		Message:         dlsMsg.MessageDetails,
		UpdatedAt:       dlsMsg.UpdatedAt,
		PoisonedCgs:     poisonedCgs,
		ValidationError: dlsMsg.ValidationError,
	}

	return result, nil
}

func GetPoisonedCgsByMessage(station models.Station, messageSeq int) ([]models.PoisonedCg, error) {
	var dlsMsg models.DlsMessage
	_, dlsMsg, err := db.GetMsgByStationIdAndMsgSeq(station.ID, messageSeq)
	if err != nil {
		return []models.PoisonedCg{}, err
	}

	cgs := dlsMsg.PoisonedCgs

	poisonedCg := models.PoisonedCg{}
	poisonedCgs := []models.PoisonedCg{}
	for _, cg := range cgs {
		stationName, err := StationNameFromStr(station.Name)
		if err != nil {
			return []models.PoisonedCg{}, err
		}
		cgInfo, err := serv.GetCgInfo(station.TenantName, stationName, cg)
		if err != nil {
			return []models.PoisonedCg{}, err
		}
		cgMembers, err := GetConsumerGroupMembers(cg, station)
		if err != nil {
			return []models.PoisonedCg{}, err
		}
		poisonedCg.IsActive, poisonedCg.IsDeleted = getCgStatus(cgMembers)

		poisonedCg.CgName = cg
		poisonedCg.TotalPoisonMessages = -1
		poisonedCg.MaxAckTimeMs = cgMembers[0].MaxAckTimeMs
		poisonedCg.MaxMsgDeliveries = cgMembers[0].MaxMsgDeliveries
		poisonedCg.CgMembers = cgMembers
		poisonedCg.UnprocessedMessages = int(cgInfo.NumPending)
		poisonedCg.InProcessMessages = cgInfo.NumAckPending
		poisonedCgs = append(poisonedCgs, poisonedCg)
	}

	sort.Slice(poisonedCgs, func(i, j int) bool {
		return poisonedCgs[i].CgName < poisonedCgs[j].CgName
	})

	return poisonedCgs, nil
}
