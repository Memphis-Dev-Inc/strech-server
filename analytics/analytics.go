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
package analytics

import (
	"encoding/json"
	"fmt"
	"memphis/conf"
	"memphis/db"
	"strings"
	"time"

	"github.com/gofrs/uuid"
	"github.com/memphisdev/memphis.go"
)

const (
	ACCOUNT_ID = 223671990
	USERNAME   = "traces_producer"
	PASSWORD   = "usersTracesMemphis@1"
	HOST       = "aws-eu-central-1.cloud.memphis.dev"
)

type EventParam struct {
	Name  string `json:"name"`
	Value string `json:"value" binding:"required"`
}

type EventBody struct {
	DistinctId     string                 `json:"distinct_id"`
	Event          string                 `json:"event"`
	Properties     map[string]interface{} `json:"properties"`
	TimeStamp      time.Time              `json:"timestamp"`
	MemphisVersion string                 `json:"memphis_version"`
}

var configuration = conf.GetConfig()
var deploymentId string
var memphisVersion string
var memphisConnection *memphis.Conn

func InitializeAnalytics(memphisV, customDeploymentId string) error {
	memphisVersion = memphisV
	if customDeploymentId != "" {
		deploymentId = customDeploymentId
	} else {
		exist, deployment, err := db.GetSystemKey("deployment_id", conf.MemphisGlobalAccountName)
		if err != nil {
			return err
		} else if !exist {
			uid, err := uuid.NewV4()
			if err != nil {
				return err
			}
			deploymentId = uid.String()
			err = db.InsertSystemKey("deployment_id", deploymentId, conf.MemphisGlobalAccountName)
			if err != nil {
				return err
			}
		} else {
			deploymentId = deployment.Value
		}
	}

	exist, _, err := db.GetSystemKey("analytics", conf.MemphisGlobalAccountName)
	if err != nil {
		return err
	} else if !exist {
		value := ""
		if configuration.ANALYTICS == "true" {
			value = "true"
		} else {
			value = "false"
		}

		err = db.InsertSystemKey("analytics", value, conf.MemphisGlobalAccountName)
		if err != nil {
			return err
		}
	}

	memphisConnection, err = memphis.Connect(HOST, USERNAME, memphis.Password(PASSWORD), memphis.AccountId(ACCOUNT_ID), memphis.MaxReconnect(500), memphis.ReconnectInterval(1*time.Second))
	if err != nil {
		errMsg := fmt.Errorf("InitializeAnalytics: initalize connection failed %s ", err.Error())
		return errMsg
	}
	return nil
}

func Close() {
	_, analytics, _ := db.GetSystemKey("analytics", conf.MemphisGlobalAccountName)
	if analytics.Value == "true" {
		memphisConnection.Close()
	}
}

func SendEvent(tenantName, username string, params map[string]interface{}, eventName string) {
	distinctId := deploymentId
	if configuration.DEV_ENV != "" {
		distinctId = "dev"
	}

	if eventName != "error" {
		tenantName = strings.ReplaceAll(tenantName, "-", "_") // for parsing purposes
		if tenantName != "" && username != "" {
			distinctId = distinctId + "-" + tenantName + "-" + username
		}
	}

	var eventMsg []byte
	var event *EventBody
	var err error

	if eventName == "error" {
		event = &EventBody{
			DistinctId:     distinctId,
			Event:          "error",
			Properties:     params,
			TimeStamp:      time.Now(),
			MemphisVersion: memphisVersion,
		}
	} else {
		event = &EventBody{
			DistinctId:     distinctId,
			Event:          eventName,
			Properties:     params,
			TimeStamp:      time.Now(),
			MemphisVersion: memphisVersion,
		}
	}

	eventMsg, err = json.Marshal(event)
	if err != nil {
		return
	}
	memphisConnection.Produce("users-traces", "producer_users_traces", eventMsg, []memphis.ProducerOpt{memphis.ProducerGenUniqueSuffix()}, []memphis.ProduceOpt{})
}
