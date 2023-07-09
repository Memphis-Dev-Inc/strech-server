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
	"errors"
	"fmt"
	"memphis/conf"
	"memphis/db"
	"memphis/models"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/nats-io/nuid"
)

type Handlers struct {
	Producers      ProducersHandler
	Consumers      ConsumersHandler
	AuditLogs      AuditLogsHandler
	Stations       StationsHandler
	Monitoring     MonitoringHandler
	PoisonMsgs     PoisonMessagesHandler
	Tags           TagsHandler
	Schemas        SchemasHandler
	Integrations   IntegrationsHandler
	Configurations ConfigurationsHandler
	Tenants        TenantHandler
	Billing        BillingHandler
}

var serv *Server
var configuration = conf.GetConfig()

type srvMemphis struct {
	serverID               string
	nuid                   *nuid.NUID
	activateSysLogsPubFunc func()
	fallbackLogQ           *ipQueue[fallbackLog]
	// jsApiMu                sync.Mutex
	ws memphisWS
}

type memphisWS struct {
	subscriptions *concurrentMap[memphisWSReqTenantsToFiller]
	quitCh        chan struct{}
}

func (s *Server) InitializeMemphisHandlers() {
	serv = s
	s.memphis.nuid = nuid.New()

	s.initializeSDKHandlers()
	s.initWS()

}

func getUserDetailsFromMiddleware(c *gin.Context) (models.User, error) {
	user, _ := c.Get("user")
	userModel := user.(models.User)
	if len(userModel.Username) == 0 {
		return userModel, errors.New("username is empty")
	}
	return userModel, nil
}

func CreateDefaultStation(tenantName string, s *Server, sn StationName, userId int, username string) (models.Station, bool, error) {
	stationName := sn.Ext()
	replicas := getDefaultReplicas()
	err := s.CreateStream(tenantName, sn, "message_age_sec", 604800, "file", 120000, replicas, false)
	if err != nil {
		return models.Station{}, false, err
	}

	schemaName := ""
	schemaVersionNumber := 0

	newStation, rowsUpdated, err := db.InsertNewStation(stationName, userId, username, "message_age_sec", 604800, "file", replicas, schemaName, schemaVersionNumber, 120000, true, models.DlsConfiguration{Poison: true, Schemaverse: true}, false, tenantName)
	if err != nil {
		return models.Station{}, false, err
	}
	if rowsUpdated == 0 {
		return models.Station{}, false, nil
	}

	return newStation, true, nil
}

func validateName(name, objectType string) error {
	emptyErrStr := fmt.Sprintf("%v name can not be empty", objectType)
	tooLongErrStr := fmt.Sprintf("%v should be under 128 characters", objectType)
	invalidCharErrStr := fmt.Sprintf("Only alphanumeric and the '_', '-', '.' characters are allowed in %v", objectType)
	firstLetterErrStr := fmt.Sprintf("%v name can not start or end with non alphanumeric character", objectType)

	emptyErr := errors.New(emptyErrStr)
	tooLongErr := errors.New(tooLongErrStr)
	invalidCharErr := errors.New(invalidCharErrStr)
	firstLetterErr := errors.New(firstLetterErrStr)

	if len(name) == 0 {
		return emptyErr
	}

	if len(name) > 128 {
		return tooLongErr
	}

	re := regexp.MustCompile("^[a-z0-9_.-]*$")

	validName := re.MatchString(name)
	if !validName {
		return invalidCharErr
	}

	if name[0:1] == "." || name[0:1] == "-" || name[0:1] == "_" || name[len(name)-1:] == "." || name[len(name)-1:] == "-" || name[len(name)-1:] == "_" {
		return firstLetterErr
	}

	return nil
}

const (
	delimiterToReplace   = "."
	delimiterReplacement = "#"
)

func replaceDelimiters(name string) string {
	return strings.Replace(name, delimiterToReplace, delimiterReplacement, -1)
}

func revertDelimiters(name string) string {
	return strings.Replace(name, delimiterReplacement, delimiterToReplace, -1)
}
