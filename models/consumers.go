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
package models

import (
	"time"
)

type Consumer struct {
	ID                  int       `json:"id"`
	Name                string    `json:"name"`
	StationId           int       `json:"station_id"`
	Type                string    `json:"type"`
	ConnectionId        string    `json:"connection_id"`
	ConsumersGroup      string    `json:"consumers_group"`
	MaxAckTimeMs        int64     `json:"max_ack_time_ms"`
	CreatedBy           int       `json:"created_by"`
	CreatedByUsername   string    `json:"created_by_username"`
	IsActive            bool      `json:"is_active"`
	CreatedAt           time.Time `json:"created_at" `
	IsDeleted           bool      `json:"is_deleted"`
	MaxMsgDeliveries    int       `json:"max_msg_deliveries"`
	StartConsumeFromSeq uint64    `json:"start_consume_from_seq"`
	LastMessages        int64     `json:"last_messages"`
}

type ExtendedConsumer struct {
	ID                int       `json:"id"`
	Name              string    `json:"name"`
	CreatedBy         string    `json:"created_by,omitempty"`
	CreatedByUsername string    `json:"created_by_username"`
	CreatedAt         time.Time `json:"created_at"`
	IsActive          bool      `json:"is_active"`
	IsDeleted         bool      `json:"is_deleted"`
	ClientAddress     string    `json:"client_address"`
	ConsumersGroup    string    `json:"consumers_group"`
	MaxAckTimeMs      int64     `json:"max_ack_time_ms"`
	MaxMsgDeliveries  int       `json:"max_msg_deliveries"`
	StationName       string    `json:"station_name,omitempty"`
}

type Cg struct {
	Name                  string             `json:"name"`
	UnprocessedMessages   int                `json:"unprocessed_messages"`
	PoisonMessages        int                `json:"poison_messages"`
	IsActive              bool               `json:"is_active"`
	IsDeleted             bool               `json:"is_deleted"`
	InProcessMessages     int                `json:"in_process_messages"`
	MaxAckTimeMs          int64              `json:"max_ack_time_ms"`
	MaxMsgDeliveries      int                `json:"max_msg_deliveries"`
	ConnectedConsumers    []ExtendedConsumer `json:"connected_consumers"`
	DisconnectedConsumers []ExtendedConsumer `json:"disconnected_consumers"`
	DeletedConsumers      []ExtendedConsumer `json:"deleted_consumers"`
	LastStatusChangeDate  time.Time          `json:"last_status_change_date"`
}

type GetAllConsumersByStationSchema struct {
	StationName string `form:"station_name" binding:"required"`
}

type CreateConsumerSchema struct {
	Name             string `json:"name" binding:"required"`
	StationName      string `json:"station_name" binding:"required"`
	ConnectionId     string `json:"connection_id" binding:"required"`
	ConsumerType     string `json:"consumer_type" binding:"required"`
	ConsumersGroup   string `json:"consumers_group"`
	MaxAckTimeMs     int64  `json:"max_ack_time_ms"`
	MaxMsgDeliveries int    `json:"max_msg_deliveries"`
}

type DestroyConsumerSchema struct {
	Name        string `json:"name" binding:"required"`
	StationName string `json:"station_name" binding:"required"`
}

type CgMember struct {
	Name              string `json:"name"`
	ClientAddress     string `json:"client_address"`
	IsActive          bool   `json:"is_active"`
	IsDeleted         bool   `json:"is_deleted"`
	CreatedBy         int    `json:"created_by"`
	CreatedByUsername string `json:"created_by_username"`
	MaxMsgDeliveries  int    `json:"max_msg_deliveries"`
	MaxAckTimeMs      int64  `json:"max_ack_time_ms"`
}
