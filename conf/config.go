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
package conf

import (
	"github.com/gin-gonic/gin"
	"github.com/tkanos/gonfig"
)

type Configuration struct {
	DEV_ENV                 string
	LOCAL_CLUSTER_ENV       bool
	DOCKER_ENV              string
	ANALYTICS               string
	EXPORTER                bool
	METADATA_DB_USER        string
	METADATA_DB_PASS        string
	METADATA_DB_DBNAME      string
	METADATA_DB_HOST        string
	METADATA_DB_PORT        string
	METADATA_DB_TLS_ENABLED bool
	METADATA_DB_TLS_KEY     string
	METADATA_DB_TLS_CRT     string
	METADATA_DB_TLS_CA      string
	// SANDBOX_SLACK_BOT_TOKEN        string
	// SANDBOX_SLACK_CHANNEL_ID       string
	// SANDBOX_UI_URL                 string
	// GOOGLE_CLIENT_ID               string
	// GOOGLE_CLIENT_SECRET           string
	// SANDBOX_ENV                    string
	// GITHUB_CLIENT_ID               string
	// GITHUB_CLIENT_SECRET           string
	// SANDBOX_REDIRECT_URI           string
}

func GetConfig() Configuration {
	configuration := Configuration{}
	gonfig.GetConf("", &configuration)
	if configuration.METADATA_DB_USER == "" {
		configuration.METADATA_DB_USER = "memphis"
	}
	if configuration.METADATA_DB_PASS == "" {
		configuration.METADATA_DB_PASS = "memphis"
	}
	if configuration.METADATA_DB_DBNAME == "" {
		configuration.METADATA_DB_DBNAME = "memphis"
	}
	if configuration.METADATA_DB_HOST == "" {
		configuration.METADATA_DB_HOST = "localhost"
	}
	if configuration.METADATA_DB_PASS == "" {
		configuration.METADATA_DB_PASS = "memphis"
	}
	if configuration.METADATA_DB_PORT == "" {
		configuration.METADATA_DB_PORT = "5005"
	}

	gin.SetMode(gin.ReleaseMode)
	return configuration
}
