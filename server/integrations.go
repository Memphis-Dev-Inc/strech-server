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
	"memphis/db"
)

var IntegrationsCache map[string]interface{}
var NotificationFunctionsMap map[string]interface{}
var StorageFunctionsMap map[string]interface{}

const PoisonMAlert = "poison_message_alert"
const SchemaVAlert = "schema_validation_fail_alert"
const DisconEAlert = "disconnection_events_alert"

func InitializeIntegrations() error {
	IntegrationsCache = make(map[string]interface{})
	NotificationFunctionsMap = make(map[string]interface{})
	StorageFunctionsMap = make(map[string]interface{})
	NotificationFunctionsMap["slack"] = sendMessageToSlackChannel
	StorageFunctionsMap["s3"] = serv.uploadToS3Storage

	err := InitializeConnection("slack")
	if err != nil {
		return err
	}
	err = InitializeConnection("s3")
	if err != nil {
		return err
	}

	if configuration.SANDBOX_ENV == "true" {
		keys, properties := createIntegrationsKeysAndProperties("slack", configuration.SANDBOX_SLACK_BOT_TOKEN, configuration.SANDBOX_SLACK_CHANNEL_ID, true, true, true, "", "", "", "")
		createSlackIntegration(keys, properties, configuration.SANDBOX_UI_URL)
	}
	return nil
}

func InitializeConnection(integrationsType string) error {
	exist, integration, err := db.GetIntegration(integrationsType)
	if !exist {
		return nil
	} else if err != nil {
		return err
	}
	CacheDetails(integrationsType, integration.Keys, integration.Properties)
	return nil
}

func clearCache(integrationsType string) {
	delete(IntegrationsCache, integrationsType)
}

func CacheDetails(integrationType string, keys map[string]string, properties map[string]bool) {
	switch integrationType {
	case "slack":
		cacheDetailsSlack(keys, properties)
	case "s3":
		cacheDetailsS3(keys, properties)

	}

}
