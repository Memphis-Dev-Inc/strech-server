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
package routes

import (
	"memphis/server"

	"github.com/gin-gonic/gin"
)

func InitializeStationsRoutes(router *gin.RouterGroup, h *server.Handlers) {
	stationsHandler := h.Stations
	stationsRoutes := router.Group("/stations")
	stationsRoutes.GET("/getStation", stationsHandler.GetStation)
	stationsRoutes.GET("/getMessageDetails", stationsHandler.GetMessageDetails)
	stationsRoutes.GET("/getAllStations", stationsHandler.GetAllStations)
	stationsRoutes.GET("/getStations", stationsHandler.GetStations)
	stationsRoutes.GET("/getPoisonMessageJourney", stationsHandler.GetPoisonMessageJourney)
	stationsRoutes.POST("/createStation", stationsHandler.CreateStation)
	stationsRoutes.POST("/resendPoisonMessages", stationsHandler.ResendPoisonMessages)
	stationsRoutes.DELETE("/removeStation", stationsHandler.RemoveStation)
	stationsRoutes.POST("/useSchema", stationsHandler.UseSchema)
	stationsRoutes.DELETE("/removeSchemaFromStation", stationsHandler.RemoveSchemaFromStation)
	stationsRoutes.GET("/getUpdatesForSchemaByStation", stationsHandler.GetUpdatesForSchemaByStation)
	stationsRoutes.GET("/tierdStorageClicked", stationsHandler.TierdStorageClicked) // TODO to be deleted
	stationsRoutes.PUT("/updateDlsConfig", stationsHandler.UpdateDlsConfig)
	stationsRoutes.POST("/dropDlsMessages", stationsHandler.DropDlsMessages)
	stationsRoutes.DELETE("/purgeStation", stationsHandler.PurgeStation)
	stationsRoutes.DELETE("/removeMessages", stationsHandler.RemoveMessages)
}
