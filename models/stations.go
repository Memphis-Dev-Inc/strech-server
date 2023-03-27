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

type Message struct {
	MessageSeq  int             `json:"message_seq"`
	Producer    ProducerDetails `json:"producer"`
	PoisonedCgs []PoisonedCg    `json:"poisoned_cgs"`
	Message     MessagePayload  `json:"message"`
}

type MessageResponse struct {
	MessageSeq  int             `json:"message_seq"`
	Producer    ProducerDetails `json:"producer"`
	PoisonedCgs []PoisonedCg    `json:"poisoned_cgs"`
	Message     MessagePayload  `json:"message"`
}

type MessageDetails struct {
	MessageSeq   int               `json:"message_seq"`
	ProducedBy   string            `json:"produced_by"`
	Data         string            `json:"data"`
	TimeSent     time.Time         `json:"created_at"`
	ConnectionId string            `json:"connection_id" `
	Size         int               `json:"size"`
	Headers      map[string]string `json:"headers"`
}

type Station struct {
	ID                          int       `json:"id"`
	Name                        string    `json:"name"`
	RetentionType               string    `json:"retention_type"`
	RetentionValue              int       `json:"retention_value"`
	StorageType                 string    `json:"storage_type"`
	Replicas                    int       `json:"replicas"`
	CreatedBy                   int       `json:"created_by"`
	CreatedByUsername           string    `json:"created_by_username"`
	CreatedAt                   time.Time `json:"created_at"`
	UpdatedAt                   time.Time `json:"updated_at"`
	IsDeleted                   bool      `json:"is_deleted"`
	SchemaName                  string    `json:"schema_name"`
	SchemaVersionNumber         int       `json:"schema_vesrion_number"`
	IdempotencyWindow           int64     `json:"idempotency_window_in_ms"`
	IsNative                    bool      `json:"is_native"`
	DlsConfigurationPoison      bool      `json:"dls_configuration_poison"`
	DlsConfigurationSchemaverse bool      `json:"dls_configuration_schemaverse"`
	TieredStorageEnabled        bool      `json:"tiered_storage_enabled"`
}

type GetStationResponseSchema struct {
	ID                   int              `json:"id"`
	Name                 string           `json:"name"`
	RetentionType        string           `json:"retention_type"`
	RetentionValue       int              `json:"retention_value"`
	StorageType          string           `json:"storage_type"`
	Replicas             int              `json:"replicas"`
	CreatedBy            int              `json:"created_by"`
	CreatedByUsername    string           `json:"created_by_username"`
	CreatedAt            time.Time        `json:"created_at"`
	LastUpdate           time.Time        `json:"last_update"`
	IsDeleted            bool             `json:"is_deleted"`
	Tags                 []CreateTag      `json:"tags"`
	IdempotencyWindow    int64            `json:"idempotency_window_in_ms" `
	IsNative             bool             `json:"is_native"`
	DlsConfiguration     DlsConfiguration `json:"dls_configuration"`
	TieredStorageEnabled bool             `json:"tiered_storage_enabled"`
}

type ExtendedStation struct {
	ID                          int         `json:"id"`
	Name                        string      `json:"name"`
	RetentionType               string      `json:"retention_type"`
	RetentionValue              int         `json:"retention_value"`
	StorageType                 string      `json:"storage_type"`
	Replicas                    int         `json:"replicas"`
	CreatedBy                   int         `json:"created_by"`
	CreatedAt                   time.Time   `json:"created_at"`
	UpdatedAt                   time.Time   `json:"last_update"`
	TotalMessages               int         `json:"total_messages"`
	PoisonMessages              int         `json:"posion_messages"`
	Tags                        []CreateTag `json:"tags"`
	IdempotencyWindow           int64       `json:"idempotency_window_in_ms"`
	IsNative                    bool        `json:"is_native"`
	DlsConfigurationPoison      bool        `json:"dls_configuration_poison"`
	DlsConfigurationSchemaverse bool        `json:"dls_configuration_schemaverse"`
	HasDlsMsgs                  bool        `json:"has_dls_messages"`
	Activity                    bool        `json:"activity"`
	Producers                   []Producer  `json:"producers"`
	Consumers                   []Consumer  `json:"consumers"`
	TieredStorageEnabled        bool        `json:"tiered_storage_enabled"`
}

type ExtendedStationDetails struct {
	Station        Station     `json:"station"`
	TotalMessages  int         `json:"total_messages"`
	PoisonMessages int         `json:"posion_messages"`
	Tags           []CreateTag `json:"tags"`
	HasDlsMsgs     bool        `json:"has_dls_messages"`
	Activity       bool        `json:"activity"`
}

type GetStationSchema struct {
	StationName string `form:"station_name" json:"station_name" binding:"required"`
}

type CreateStationSchema struct {
	Name                 string           `json:"name" binding:"required,min=1,max=128"`
	RetentionType        string           `json:"retention_type"`
	RetentionValue       int              `json:"retention_value"`
	Replicas             int              `json:"replicas"`
	StorageType          string           `json:"storage_type"`
	Tags                 []CreateTag      `json:"tags"`
	SchemaName           string           `json:"schema_name"`
	IdempotencyWindow    int64            `json:"idempotency_window_in_ms"`
	DlsConfiguration     DlsConfiguration `json:"dls_configuration"`
	TieredStorageEnabled bool             `json:"tiered_storage_enabled"`
}

type DlsConfiguration struct {
	Poison      bool `json:"poison"`
	Schemaverse bool `json:"schemaverse"`
}

type UpdateDlsConfigSchema struct {
	StationName string `json:"station_name" binding:"required"`
	Poison      bool   `json:"poison"`
	Schemaverse bool   `json:"schemaverse"`
}

type DropDlsMessagesSchema struct {
	DlsMsgType    string `json:"dls_type" binding:"required"`
	DlsMessageIds []int  `json:"dls_message_ids" binding:"required"`
	StationName   string `json:"station_name" binding:"required"`
}

type PurgeStationSchema struct {
	StationName  string `json:"station_name" binding:"required"`
	PurgeDls     bool   `json:"purge_dls"`
	PurgeStation bool   `json:"purge_station"`
}

type RemoveMessagesSchema struct {
	StationName string   `json:"station_name" binding:"required"`
	MessageSeqs []uint64 `json:"message_seqs" binding:"required"`
}

// type ResendPoisonMessagesSchema struct {
// 	PoisonMessageIds []string `json:"poison_message_ids" binding:"required"`
// }

type ResendPoisonMessagesSchemaPg struct {
	PoisonMessageIds []int  `json:"poison_message_ids" binding:"required"`
	StationName      string `json:"station_name" binding:"required"`
}

type RemoveStationSchema struct {
	StationNames []string `json:"station_names" binding:"required"`
}

// TODO: remove
type GetPoisonMessageJourneySchema struct {
	MessageId string `form:"message_id" json:"message_id" binding:"required"`
}

type GetPoisonMessageJourneySchemaPg struct {
	MessageId   int    `form:"message_id" json:"message_id" binding:"required"`
	StationName string `form:"station_name" json:"station_name" binding:"required"`
}

// TODO: remove
type GetMessageDetailsSchema struct {
	IsDls       bool   `form:"is_dls" json:"is_dls"`
	DlsType     string `form:"dls_type" json:"dls_type"`
	MessageId   string `form:"message_id" json:"message_id"`
	MessageSeq  int    `form:"message_seq" json:"message_seq"`
	StationName string `form:"station_name" json:"station_name" binding:"required"`
}

type GetMessageDetailsSchemaPg struct {
	IsDls       bool   `form:"is_dls" json:"is_dls"`
	DlsType     string `form:"dls_type" json:"dls_type"`
	MessageId   int    `form:"message_id" json:"message_id"`
	MessageSeq  int    `form:"message_seq" json:"message_seq"`
	StationName string `form:"station_name" json:"station_name" binding:"required"`
}

type UseSchema struct {
	StationNames []string `json:"station_names" binding:"required"`
	SchemaName   string   `json:"schema_name" binding:"required"`
}

type RemoveSchemaFromStation struct {
	StationName string `json:"station_name" binding:"required"`
}

type SchemaDetails struct {
	SchemaName    string `json:"name"`
	VersionNumber int    `json:"version_number"`
}

type StationOverviewSchemaDetails struct {
	SchemaName       string `json:"name"`
	SchemaType       string `json:"schema_type"`
	VersionNumber    int    `json:"version_number"`
	UpdatesAvailable bool   `json:"updates_available"`
}

type GetUpdatesForSchema struct {
	StationName string `form:"station_name" json:"station_name" binding:"required"`
}

type StationMsgsDetails struct {
	HasDlsMsgs    bool `json:"has_dls_messages"`
	TotalMessages int  `json:"total_messages"`
}
