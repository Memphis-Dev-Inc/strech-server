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
	"context"
	"errors"
	"fmt"
	"memphis/conf"
	"memphis/db"
	"memphis/models"
	"regexp"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/nats-io/nuid"
	"go.mongodb.org/mongo-driver/mongo"
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
}

var serv *Server
var configuration = conf.GetConfig()

type srvMemphis struct {
	serverID               string
	nuid                   *nuid.NUID
	dbClient               *mongo.Client
	dbCtx                  context.Context
	dbCancel               context.CancelFunc
	activateSysLogsPubFunc func()
	fallbackLogQ           *ipQueue[fallbackLog]
	jsApiMu                sync.Mutex
	ws                     memphisWS
}

type memphisWS struct {
	subscriptions *concurrentMap[memphisWSReqFiller]
	quitCh        chan struct{}
}

func (s *Server) InitializeMemphisHandlers(dbInstance db.DbInstance) {
	serv = s
	s.memphis.dbClient = dbInstance.Client
	s.memphis.dbCtx = dbInstance.Ctx
	s.memphis.dbCancel = dbInstance.Cancel
	s.memphis.nuid = nuid.New()
	// s.memphis.serverID is initialized earlier, when logger is configured

	s.initializeSDKHandlers()
	s.initializeConfigurations()
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

func CreateDefaultStation(s *Server, sn StationName, username string) (models.Station, bool, error) {
	stationName := sn.Ext()
	err := s.CreateStream(sn, "message_age_sec", 604800, "file", 120000, 1, false)
	if err != nil {
		return models.Station{}, false, err
	}

	err = s.CreateDlsStream(sn, "file", 1)
	if err != nil {
		return models.Station{}, false, err
	}
	newStation, rowsUpdated, err := db.UpsertNewStation(stationName, username, "message_age_sec", 604800, "file", 1, models.SchemaDetails{}, 120000, true, models.DlsConfiguration{Poison: true, Schemaverse: true}, false)
	if err != nil {
		return models.Station{}, false, err
	}
	if rowsUpdated > 0 {
		return models.Station{}, false, nil
	}

	return newStation, true, nil
}

func shouldSendAnalytics() (bool, error) {
	exist, systemKey, err := db.GetSystemKey("analytics")
	if err != nil {
		return false, err
	}
	if !exist {
		return false, nil
	}

	if systemKey.Value == "true" {
		return true, nil
	} else {
		return false, nil
	}
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
