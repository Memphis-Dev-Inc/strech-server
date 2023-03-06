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
	"memphis/models"
	"time"

	"go.mongodb.org/mongo-driver/bson"
)

type AuditLogsHandler struct{}

func CreateAuditLogs(auditLogs []interface{}) error {
	_, err := auditLogsCollection.InsertMany(context.TODO(), auditLogs)
	if err != nil {
		return err
	}
	return nil
}

func (ah AuditLogsHandler) GetAuditLogsByStation(station models.Station) ([]models.AuditLog, error) {
	var auditLogs []models.AuditLog

	cursor, err := auditLogsCollection.Find(context.TODO(), bson.M{"station_name": station.Name, "creation_date": bson.M{
		"$gte": (time.Now().AddDate(0, 0, -5)),
	}})
	if err != nil {
		return auditLogs, err
	}

	if err = cursor.All(context.TODO(), &auditLogs); err != nil {
		return auditLogs, err
	}

	if len(auditLogs) == 0 {
		auditLogs = []models.AuditLog{}
	}

	return auditLogs, nil
}

func RemoveAllAuditLogsByStation(stationName string) error {
	_, err := auditLogsCollection.DeleteMany(context.TODO(), bson.M{"station_name": stationName})
	if err != nil {
		return err
	}
	return nil
}
