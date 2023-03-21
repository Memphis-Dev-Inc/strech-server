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
	"fmt"
	"memphis/analytics"
	"memphis/db"
	"memphis/models"
	"memphis/utils"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type ConfigurationsHandler struct{}

func (s *Server) initializeConfigurations() {
	exist, pmRetentionRes, err := db.GetConfiguration("pm_retention")
	if err != nil || !exist {
		if err != nil {
			s.Errorf("initializeConfigurations: " + err.Error())
		}
		POISON_MSGS_RETENTION_IN_HOURS = configuration.POISON_MSGS_RETENTION_IN_HOURS
		err = db.InsertConfiguration("pm_retention", strconv.Itoa(POISON_MSGS_RETENTION_IN_HOURS))
		if err != nil {
			s.Errorf("initializeConfigurations: " + err.Error())
		}
	} else {
		pmRetention, err := strconv.Atoi(pmRetentionRes.Value)
		if err != nil {
			s.Errorf("initializeConfigurations: " + err.Error())
		}
		POISON_MSGS_RETENTION_IN_HOURS = pmRetention
	}
	exist, logsRetentionRes, err := db.GetConfiguration("logs_retention")
	if err != nil || !exist {
		if err != nil {
			s.Errorf("initializeConfigurations: " + err.Error())
		}
		LOGS_RETENTION_IN_DAYS = s.opts.LogsRetentionDays
		err = db.InsertConfiguration("logs_retention", strconv.Itoa(LOGS_RETENTION_IN_DAYS))
		if err != nil {
			s.Errorf("initializeConfigurations: " + err.Error())
		}
	} else {
		logsRetention, err := strconv.Atoi(logsRetentionRes.Value)
		if err != nil {
			s.Errorf("initializeConfigurations: " + err.Error())
		}
		LOGS_RETENTION_IN_DAYS = logsRetention
	}

	exist, tsTimeRes, err := db.GetConfiguration("tiered_storage_time_sec")
	if err != nil || !exist {
		if err != nil {
			s.Errorf("initializeConfigurations: " + err.Error())
		}
		if configuration.TIERED_STORAGE_TIME_FRAME_SEC > 3600 || configuration.TIERED_STORAGE_TIME_FRAME_SEC < 5 {
			s.Warnf("initializeConfigurations: Tiered storage time can't be less than 5 seconds or more than 60 minutes - using default 8 seconds")
			TIERED_STORAGE_TIME_FRAME_SEC = 8
		} else {
			TIERED_STORAGE_TIME_FRAME_SEC = configuration.TIERED_STORAGE_TIME_FRAME_SEC
		}
		err = db.InsertConfiguration("tiered_storage_time_sec", strconv.Itoa(TIERED_STORAGE_TIME_FRAME_SEC))
		if err != nil {
			s.Errorf("initializeConfigurations: " + err.Error())
		}
	} else {
		tsTime, err := strconv.Atoi(tsTimeRes.Value)
		if err != nil {
			s.Errorf("initializeConfigurations: " + err.Error())
		}
		TIERED_STORAGE_TIME_FRAME_SEC = tsTime
	}

	exist, brokerHost, err := db.GetConfiguration("broker_host")
	if err != nil || !exist {
		if err != nil {
			s.Errorf("initializeConfigurations: " + err.Error())
		}
		if configuration.DOCKER_ENV != "" || configuration.LOCAL_CLUSTER_ENV {
			BROKER_HOST = "localhost"
		} else {
			BROKER_HOST = "memphis." + s.opts.K8sNamespace + ".svc.cluster.local"
		}
		err = db.InsertConfiguration("broker_host", BROKER_HOST)
		if err != nil {
			s.Errorf("initializeConfigurations: " + err.Error())
		}
	} else {
		BROKER_HOST = brokerHost.Value
	}
	exist, uiHost, err := db.GetConfiguration("ui_host")
	if err != nil || !exist {
		if err != nil {
			s.Errorf("initializeConfigurations: " + err.Error())
		}
		if configuration.DOCKER_ENV != "" || configuration.LOCAL_CLUSTER_ENV {
			UI_HOST = fmt.Sprintf("http://localhost:%v", s.opts.UiPort)
		} else {
			UI_HOST = fmt.Sprintf("http://memphis.%s.svc.cluster.local:%v", s.opts.K8sNamespace, s.opts.UiPort)
		}
		err = db.InsertConfiguration("ui_host", UI_HOST)
		if err != nil {
			s.Errorf("initializeConfigurations: " + err.Error())
		}
	} else {
		UI_HOST = uiHost.Value
	}
	exist, restGWHost, err := db.GetConfiguration("rest_gw_host")
	if err != nil || !exist {
		if err != nil {
			s.Errorf("initializeConfigurations: " + err.Error())
		}
		if configuration.DOCKER_ENV != "" || configuration.LOCAL_CLUSTER_ENV {
			REST_GW_HOST = fmt.Sprintf("http://localhost:%v", s.opts.RestGwPort)
		} else {
			REST_GW_HOST = fmt.Sprintf("http://memphis-rest-gateway.%s.svc.cluster.local:%v", s.opts.K8sNamespace, s.opts.RestGwPort)
		}
		restGWHost = models.ConfigurationsValue{
			Key:   "rest_gw_host",
			Value: REST_GW_HOST,
		}
		err = db.InsertConfiguration("rest_gw_host", REST_GW_HOST)
		if err != nil {
			s.Errorf("initializeConfigurations: " + err.Error())
		}
	} else {
		REST_GW_HOST = restGWHost.Value
	}
}

func (ch ConfigurationsHandler) EditClusterConfig(c *gin.Context) {
	// if err := DenyForSandboxEnv(c); err != nil {
	// 	return
	// }

	var body models.EditClusterConfigSchema
	ok := utils.Validate(c, &body, false, nil)
	if !ok {
		return
	}
	if POISON_MSGS_RETENTION_IN_HOURS != body.PMRetention {
		err := changePMRetention(body.PMRetention)
		if err != nil {
			serv.Errorf("EditConfigurations: " + err.Error())
			c.AbortWithStatusJSON(500, gin.H{"message": "Server error"})
			return
		}
	}
	if LOGS_RETENTION_IN_DAYS != body.LogsRetention {
		err := changeLogsRetention(body.LogsRetention)
		if err != nil {
			serv.Errorf("EditConfigurations: " + err.Error())
			c.AbortWithStatusJSON(500, gin.H{"message": "Server error"})
			return
		}
	}

	if body.TSTimeSec > 3600 || body.TSTimeSec < 5 {
		serv.Errorf("EditConfigurations: Tiered storage time can't be less than 5 seconds or more than 60 minutes")
		c.AbortWithStatusJSON(SHOWABLE_ERROR_STATUS_CODE, gin.H{"message": "Tiered storage time can't be less than 5 seconds or more than 60 minutes"})
	} else {
		err := changeTSTime(body.TSTimeSec)
		if err != nil {
			serv.Errorf("EditConfigurations: " + err.Error())
			c.AbortWithStatusJSON(500, gin.H{"message": "Server error"})
			return
		}
	}

	brokerHost := strings.ToLower(body.BrokerHost)
	if BROKER_HOST != brokerHost {
		err := editClusterCompHost("broker_host", brokerHost)
		if err != nil {
			serv.Errorf("EditConfigurations: " + err.Error())
			c.AbortWithStatusJSON(500, gin.H{"message": "Server error"})
			return
		}
	}

	uiHost := strings.ToLower(body.UiHost)
	if UI_HOST != uiHost {
		err := editClusterCompHost("ui_host", uiHost)
		if err != nil {
			serv.Errorf("EditConfigurations: " + err.Error())
			c.AbortWithStatusJSON(500, gin.H{"message": "Server error"})
			return
		}
	}

	restGWHost := strings.ToLower(body.RestGWHost)
	if REST_GW_HOST != restGWHost {
		err := editClusterCompHost("rest_gw_host", restGWHost)
		if err != nil {
			serv.Errorf("EditConfigurations: " + err.Error())
			c.AbortWithStatusJSON(500, gin.H{"message": "Server error"})
			return
		}
	}

	shouldSendAnalytics, _ := shouldSendAnalytics()
	if shouldSendAnalytics {
		user, _ := getUserDetailsFromMiddleware(c)
		analytics.SendEvent(user.Username, "user-update-cluster-config")
	}

	c.IndentedJSON(200, gin.H{"pm_retention": POISON_MSGS_RETENTION_IN_HOURS, "logs_retention": LOGS_RETENTION_IN_DAYS, "broker_host": BROKER_HOST, "ui_host": UI_HOST, "rest_gw_host": REST_GW_HOST, "tiered_storage_time_sec": TIERED_STORAGE_TIME_FRAME_SEC})
}

func changePMRetention(pmRetention int) error {
	POISON_MSGS_RETENTION_IN_HOURS = pmRetention
	msg, err := json.Marshal(models.SdkClientsUpdates{Type: "pm_retention", Update: POISON_MSGS_RETENTION_IN_HOURS})
	if err != nil {
		return err
	}
	err = serv.sendInternalAccountMsgWithReply(serv.GlobalAccount(), CONFIGURATIONS_UPDATES_SUBJ, _EMPTY_, nil, msg, true)
	if err != nil {
		return err
	}
	err = db.UpdateConfiguration("pm_retention", strconv.Itoa(POISON_MSGS_RETENTION_IN_HOURS))
	if err != nil {
		return err
	}
	stations, err := db.GetActiveStations()
	if err != nil {
		return err
	}
	maxAge := time.Duration(POISON_MSGS_RETENTION_IN_HOURS) * time.Hour
	for _, station := range stations {
		sn, err := StationNameFromStr(station.Name)
		if err != nil {
			return err
		}
		streamName := fmt.Sprintf(dlsStreamName, sn.Intern())
		var storage StorageType
		if station.StorageType == "memory" {
			storage = MemoryStorage
		} else {
			storage = FileStorage
		}
		err = serv.memphisUpdateStream(&StreamConfig{
			Name:      streamName,
			Subjects:  []string{streamName + ".>"},
			Retention: LimitsPolicy,
			MaxAge:    maxAge,
			Storage:   storage,
		})
		if err != nil {
			return err
		}
	}

	return nil
}

func changeLogsRetention(logsRetention int) error {
	LOGS_RETENTION_IN_DAYS = logsRetention
	err := db.UpdateConfiguration("logs_retention", strconv.Itoa(LOGS_RETENTION_IN_DAYS))
	if err != nil {
		return err
	}
	retentionDur := time.Duration(LOGS_RETENTION_IN_DAYS) * time.Hour * 24
	err = serv.memphisUpdateStream(&StreamConfig{
		Name:         syslogsStreamName,
		Subjects:     []string{syslogsStreamName + ".>"},
		Retention:    LimitsPolicy,
		MaxAge:       retentionDur,
		MaxConsumers: -1,
		Discard:      DiscardOld,
		Storage:      FileStorage,
	})
	if err != nil {
		return err
	}
	return nil
}

func (ch ConfigurationsHandler) GetClusterConfig(c *gin.Context) {
	shouldSendAnalytics, _ := shouldSendAnalytics()
	if shouldSendAnalytics {
		user, _ := getUserDetailsFromMiddleware(c)
		analytics.SendEvent(user.Username, "user-enter-cluster-config-page")
	}
	c.IndentedJSON(200, gin.H{"pm_retention": POISON_MSGS_RETENTION_IN_HOURS, "logs_retention": LOGS_RETENTION_IN_DAYS, "broker_host": BROKER_HOST, "ui_host": UI_HOST, "rest_gw_host": REST_GW_HOST, "tiered_storage_time_sec": TIERED_STORAGE_TIME_FRAME_SEC})
}

func changeTSTime(tsTime int) error {
	TIERED_STORAGE_TIME_FRAME_SEC = tsTime
	msg, err := json.Marshal(models.SdkClientsUpdates{Type: "tiered_storage_time_sec", Update: TIERED_STORAGE_TIME_FRAME_SEC})
	if err != nil {
		return err
	}
	err = serv.sendInternalAccountMsgWithReply(serv.GlobalAccount(), CONFIGURATIONS_UPDATES_SUBJ, _EMPTY_, nil, msg, true)
	if err != nil {
		return err
	}
	err = db.UpdateConfiguration("tiered_storage_time_sec", strconv.Itoa(TIERED_STORAGE_TIME_FRAME_SEC))
	if err != nil {
		return err
	}

	return nil
}

func editClusterCompHost(key string, host string) error {
	switch key {
	case "broker_host":
		BROKER_HOST = host
	case "ui_host":
		UI_HOST = host
	case "rest_gw_host":
		REST_GW_HOST = host
	}

	msg, err := json.Marshal(models.SdkClientsUpdates{Type: key, Update: host})
	if err != nil {
		return err
	}
	err = serv.sendInternalAccountMsgWithReply(serv.GlobalAccount(), CONFIGURATIONS_UPDATES_SUBJ, _EMPTY_, nil, msg, true)
	if err != nil {
		return err
	}
	err = db.UpdateConfiguration(key, host)
	if err != nil {
		return err
	}
	return nil
}
