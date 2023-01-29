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
	"fmt"
	"memphis-broker/analytics"
	"memphis-broker/models"
	"memphis-broker/utils"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type ConfigurationsHandler struct{}

var userMgmtHandler UserMgmtHandler

func (s *Server) initializeConfigurations() {
	var pmRetention models.ConfigurationsIntValue
	err := configurationsCollection.FindOne(context.TODO(), bson.M{"key": "pm_retention"}).Decode(&pmRetention)
	if err != nil {
		if err != mongo.ErrNoDocuments {
			s.Errorf("initializeConfigurations: " + err.Error())
		}
		POISON_MSGS_RETENTION_IN_HOURS = configuration.POISON_MSGS_RETENTION_IN_HOURS
		pmRetention = models.ConfigurationsIntValue{
			ID:    primitive.NewObjectID(),
			Key:   "pm_retention",
			Value: POISON_MSGS_RETENTION_IN_HOURS,
		}
		_, err = configurationsCollection.InsertOne(context.TODO(), pmRetention)
		if err != nil {
			s.Errorf("initializeConfigurations: " + err.Error())
		}
	} else {
		POISON_MSGS_RETENTION_IN_HOURS = pmRetention.Value
	}
	var logsRetention models.ConfigurationsIntValue
	err = configurationsCollection.FindOne(context.TODO(), bson.M{"key": "logs_retention"}).Decode(&logsRetention)
	if err != nil {
		if err != mongo.ErrNoDocuments {
			s.Errorf("initializeConfigurations: " + err.Error())
		}
		LOGS_RETENTION_IN_DAYS, err = strconv.Atoi(configuration.LOGS_RETENTION_IN_DAYS)
		if err != nil {
			s.Errorf("initializeConfigurations: " + err.Error())
			LOGS_RETENTION_IN_DAYS = 30 //default
		}
		logsRetention = models.ConfigurationsIntValue{
			ID:    primitive.NewObjectID(),
			Key:   "logs_retention",
			Value: LOGS_RETENTION_IN_DAYS,
		}
		_, err = configurationsCollection.InsertOne(context.TODO(), logsRetention)
		if err != nil {
			s.Errorf("initializeConfigurations: " + err.Error())
		}
	} else {
		LOGS_RETENTION_IN_DAYS = logsRetention.Value
	}
}

func (ch ConfigurationsHandler) EditClusterConfig(c *gin.Context) {
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

	shouldSendAnalytics, _ := shouldSendAnalytics()
	if shouldSendAnalytics {
		user, _ := getUserDetailsFromMiddleware(c)
		analytics.SendEvent(user.Username, "user-update-cluster-config")
	}

	c.IndentedJSON(200, gin.H{"pm_retention": POISON_MSGS_RETENTION_IN_HOURS, "logs_retention": LOGS_RETENTION_IN_DAYS})
}

func changePMRetention(pmRetention int) error {
	POISON_MSGS_RETENTION_IN_HOURS = pmRetention
	msg, err := json.Marshal(models.ConfigurationsUpdate{Type: "pm_retention", Update: POISON_MSGS_RETENTION_IN_HOURS})
	if err != nil {
		return err
	}
	err = serv.sendInternalAccountMsgWithReply(serv.GlobalAccount(), CONFIGURATIONS_UPDATES_SUBJ, _EMPTY_, nil, msg, true)
	if err != nil {
		return err
	}
	filter := bson.M{"key": "pm_retention"}
	update := bson.M{
		"$set": bson.M{
			"value": POISON_MSGS_RETENTION_IN_HOURS,
		},
	}
	opts := options.Update().SetUpsert(true)
	_, err = configurationsCollection.UpdateOne(context.TODO(), filter, update, opts)
	if err != nil {
		return err
	}
	var stations []models.Station
	cursor, err := stationsCollection.Find(context.TODO(), bson.M{
		"$or": []interface{}{
			bson.M{"is_deleted": false},
			bson.M{"is_deleted": bson.M{"$exists": false}},
		},
	})
	if err != nil {
		return err
	}

	if err = cursor.All(context.TODO(), &stations); err != nil {
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
	filter := bson.M{"key": "logs_retention"}
	update := bson.M{
		"$set": bson.M{
			"value": LOGS_RETENTION_IN_DAYS,
		},
	}
	opts := options.Update().SetUpsert(true)
	_, err := configurationsCollection.UpdateOne(context.TODO(), filter, update, opts)
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
	c.IndentedJSON(200, gin.H{"pm_retention": POISON_MSGS_RETENTION_IN_HOURS, "logs_retention": LOGS_RETENTION_IN_DAYS})
}
