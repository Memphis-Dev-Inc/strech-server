// Credit for The NATS.IO Authors
// Copyright 2021-2022 The Memphis Authors
// Licensed under the Apache License, Version 2.0 (the “License”);
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an “AS IS” BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.package routes
package routes

import (
	"memphis-broker/conf"
	"memphis-broker/middlewares"
	"memphis-broker/models"
	"memphis-broker/server"

	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	socketio "github.com/googollee/go-socket.io"
)

var socketServer = socketio.NewServer(nil)
var configuration = conf.GetConfig()

func getMainOverviewData(h *server.Handlers) (models.MainOverviewData, error) {
	stations, err := h.Stations.GetAllStationsDetails()
	if err != nil {
		return models.MainOverviewData{}, nil
	}
	totalMessages, err := h.Stations.GetTotalMessagesAcrossAllStations()
	if err != nil {
		return models.MainOverviewData{}, err
	}
	systemComponents, err := h.Monitoring.GetSystemComponents()
	if err != nil {
		return models.MainOverviewData{}, err
	}

	return models.MainOverviewData{
		TotalStations:    len(stations),
		TotalMessages:    totalMessages,
		SystemComponents: systemComponents,
		Stations:         stations,
	}, nil
}

func getStationsOverviewData(h *server.Handlers) ([]models.ExtendedStationDetails, error) {
	stations, err := h.Stations.GetStationsDetails()
	if err != nil {
		return stations, err
	}
	return stations, nil
}

func getSchemasOverviewData(h *server.Handlers) ([]models.ExtendedSchema, error) {
	schemas, err := h.Schemas.GetAllSchemasDetails()
	if err != nil {
		return schemas, err
	}
	return schemas, nil
}

func getStationOverviewData(stationName string, h *server.Handlers) (map[string]any, error) {
	sn, err := server.StationNameFromStr(stationName)
	if err != nil {
		return map[string]any{}, err
	}

	exist, station, err := server.IsStationExist(sn)
	if err != nil {
		return map[string]any{}, err
	}
	if !exist {
		return map[string]any{}, errors.New("Station does not exist")
	}

	connectedProducers, disconnectedProducers, deletedProducers, err := h.Producers.GetProducersByStation(station)
	if err != nil {
		return map[string]any{}, err
	}
	connectedCgs, disconnectedCgs, deletedCgs, err := h.Consumers.GetCgsByStation(sn, station)
	if err != nil {
		return map[string]any{}, err
	}
	auditLogs, err := h.AuditLogs.GetAuditLogsByStation(station)
	if err != nil {
		return map[string]any{}, err
	}
	totalMessages, err := h.Stations.GetTotalMessages(station.Name)
	if err != nil {
		return map[string]any{}, err
	}
	avgMsgSize, err := h.Stations.GetAvgMsgSize(station)
	if err != nil {
		return map[string]any{}, err
	}

	messagesToFetch := 1000
	messages, err := h.Stations.GetMessages(station, messagesToFetch)
	if err != nil {
		return map[string]any{}, err
	}

	poisonMessages, err := h.PoisonMsgs.GetPoisonMsgsByStation(station)
	if err != nil {
		return map[string]any{}, err
	}

	tags, err := h.Tags.GetTagsByStation(station.ID)
	if err != nil {
		return map[string]any{}, err
	}
	leader, followers, err := h.Stations.GetLeaderAndFollowers(station)
	if err != nil {
		return map[string]any{}, err
	}

	schema, err := h.Schemas.GetSchemaByStationName(sn)

	if err != nil && err != server.ErrNoSchema {
		return map[string]any{}, err
	}

	var response map[string]any

	if err == server.ErrNoSchema {
		response = map[string]any{
			"connected_producers":    connectedProducers,
			"disconnected_producers": disconnectedProducers,
			"deleted_producers":      deletedProducers,
			"connected_cgs":          connectedCgs,
			"disconnected_cgs":       disconnectedCgs,
			"deleted_cgs":            deletedCgs,
			"total_messages":         totalMessages,
			"average_message_size":   avgMsgSize,
			"audit_logs":             auditLogs,
			"messages":               messages,
			"poison_messages":        poisonMessages,
			"tags":                   tags,
			"leader":                 leader,
			"followers":              followers,
			"schema":                 struct{}{},
		}
		return response, nil
	}

	schemaVersion, err := h.Schemas.GetSchemaVersion(station.Schema.VersionNumber, schema.ID)
	if err != nil {
		return map[string]any{}, err
	}
	updatesAvailable := !schemaVersion.Active
	schemaDetails := models.StationOverviewSchemaDetails{SchemaName: schema.Name, VersionNumber: station.Schema.VersionNumber, UpdatesAvailable: updatesAvailable}

	response = map[string]any{
		"connected_producers":    connectedProducers,
		"disconnected_producers": disconnectedProducers,
		"deleted_producers":      deletedProducers,
		"connected_cgs":          connectedCgs,
		"disconnected_cgs":       disconnectedCgs,
		"deleted_cgs":            deletedCgs,
		"total_messages":         totalMessages,
		"average_message_size":   avgMsgSize,
		"audit_logs":             auditLogs,
		"messages":               messages,
		"poison_messages":        poisonMessages,
		"tags":                   tags,
		"leader":                 leader,
		"followers":              followers,
		"schema":                 schemaDetails,
	}

	return response, nil
}

func getSystemLogs(h *server.Handlers, filterSubjectSuffix string) (models.SystemLogsResponse, error) {
	const amount = 100
	const timeout = 3 * time.Second
	filterSubject := ""
	if filterSubjectSuffix != "" {
		filterSubject = "$memphis_syslogs." + filterSubjectSuffix
	}
	return h.Monitoring.S.GetSystemLogs(amount, timeout, true, 0, filterSubject, false)
}

func ginMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Request.Header.Del("Origin")
		c.Next()
	}
}

func InitializeSocketio(router *gin.Engine, h *server.Handlers) *socketio.Server {
	serv := h.Stations.S
	socketServer.OnConnect("/api", func(s socketio.Conn) error {
		return nil
	})

	socketServer.OnEvent("/api", "register_main_overview_data", func(s socketio.Conn, msg string) string {
		s.LeaveAll()
		s.Join("main_overview_sockets_group")

		return "recv " + msg
	})

	socketServer.OnEvent("/api", "register_station_overview_data", func(s socketio.Conn, stationName string) string {
		s.LeaveAll()
		s.Join("station_overview_group_" + stationName)

		return "recv " + stationName
	})

	socketServer.OnEvent("/api", "register_poison_message_journey_data", func(s socketio.Conn, poisonMsgId string) string {
		s.LeaveAll()
		s.Join("poison_message_journey_group_" + poisonMsgId)

		return "recv " + poisonMsgId
	})

	socketServer.OnEvent("/api", "deregister", func(s socketio.Conn, msg string) string {
		s.LeaveAll()
		return "recv " + msg
	})

	socketServer.OnEvent("/api", "get_all_stations_data", func(s socketio.Conn, msg string) string {
		s.LeaveAll()
		s.Join("all_stations_group")
		return "recv " + msg
	})

	socketServer.OnEvent("/api", "register_syslogs_data", func(s socketio.Conn, msg string) string {
		s.LeaveAll()
		s.Join("syslogs_group")
		return "recv " + msg
	})

	socketServer.OnEvent("/api", "register_syslogs_data_warn", func(s socketio.Conn, msg string) string {
		s.LeaveAll()
		s.Join("syslogs_warn")
		return "recv " + msg
	})

	socketServer.OnEvent("/api", "register_syslogs_data_err", func(s socketio.Conn, msg string) string {
		s.LeaveAll()
		s.Join("syslogs_err")
		return "recv " + msg
	})

	socketServer.OnEvent("/api", "register_syslogs_data_info", func(s socketio.Conn, msg string) string {
		s.LeaveAll()
		s.Join("syslogs_info")
		return "recv " + msg
	})

	socketServer.OnEvent("/api", "get_all_schemas_data", func(s socketio.Conn, msg string) string {
		s.LeaveAll()
		s.Join("all_schemas_group")
		return "recv " + msg
	})

	socketServer.OnError("/", func(s socketio.Conn, e error) {
		serv.Warnf("An error occurred during a socket connection " + e.Error())
	})

	go socketServer.Serve()

	go func() {
		for range time.Tick(time.Second * 5) {
			if socketServer.RoomLen("/api", "main_overview_sockets_group") > 0 {
				data, err := getMainOverviewData(h)
				if err != nil {
					serv.Errorf("Error while trying to get main overview data - " + err.Error())
				} else {
					socketServer.BroadcastToRoom("/api", "main_overview_sockets_group", "main_overview_data", data)
				}
			}

			if socketServer.RoomLen("/api", "all_stations_group") > 0 {
				data, err := getStationsOverviewData(h)
				if err != nil {
					serv.Errorf("Error while trying to get stations overview data - " + err.Error())
				} else {
					socketServer.BroadcastToRoom("/api", "all_stations_group", "stations_overview_data", data)
				}
			}

			if socketServer.RoomLen("/api", "all_schemas_group") > 0 {
				data, err := getSchemasOverviewData(h)
				if err != nil {
					serv.Errorf("Error while trying to get schemas overview data - " + err.Error())
				} else {
					socketServer.BroadcastToRoom("/api", "all_schemas_group", "schemas_overview_data", data)
				}
			}

			if socketServer.RoomLen("/api", "syslogs_group") > 0 {
				data, err := getSystemLogs(h, "")
				if err != nil {
					serv.Errorf("Error while trying to get system logs - " + err.Error())
				} else {
					socketServer.BroadcastToRoom("/api", "syslogs_group", "syslogs_data", data)
				}
			}

			if socketServer.RoomLen("/api", "syslogs_warn") > 0 {
				data, err := getSystemLogs(h, "warn")
				if err != nil {
					serv.Errorf("Error while trying to get system logs - " + err.Error())
				} else {
					socketServer.BroadcastToRoom("/api", "syslogs_warn", "syslogs_data", data)
				}
			}

			if socketServer.RoomLen("/api", "syslogs_err") > 0 {
				data, err := getSystemLogs(h, "err")
				if err != nil {
					serv.Errorf("Error while trying to get system logs - " + err.Error())
				} else {
					socketServer.BroadcastToRoom("/api", "syslogs_err", "syslogs_data", data)
				}
			}

			if socketServer.RoomLen("/api", "syslogs_info") > 0 {
				data, err := getSystemLogs(h, "info")
				if err != nil {
					serv.Errorf("Error while trying to get system logs - " + err.Error())
				} else {
					socketServer.BroadcastToRoom("/api", "syslogs_info", "syslogs_data", data)
				}
			}

			rooms := socketServer.Rooms("/api")
			for _, room := range rooms {
				if strings.HasPrefix(room, "station_overview_group_") && socketServer.RoomLen("/api", room) > 0 {
					stationName := strings.Split(room, "station_overview_group_")[1]
					data, err := getStationOverviewData(stationName, h)
					if err != nil {
						serv.Errorf("Error while trying to get station overview data - " + err.Error())
					} else {
						socketServer.BroadcastToRoom("/api", room, "station_overview_data_"+stationName, data)
					}
				}

				if strings.HasPrefix(room, "poison_message_journey_group_") && socketServer.RoomLen("/api", room) > 0 {
					poisonMsgId := strings.Split(room, "poison_message_journey_group_")[1]
					data, err := h.Stations.GetPoisonMessageJourneyDetails(poisonMsgId)
					if err != nil {
						serv.Errorf("Error while trying to get poison message journey - " + err.Error())
					} else {
						socketServer.BroadcastToRoom("/api", room, "poison_message_journey_data_"+poisonMsgId, data)
					}
				}
			}
		}
	}()

	socketIoRouter := router.Group("/api/socket.io")
	socketIoRouter.Use(cors.New(cors.Config{
		AllowOriginFunc: func(origin string) bool {
			return true
		},
		AllowMethods:     []string{"POST", "OPTIONS", "GET", "PUT", "DELETE"},
		AllowHeaders:     []string{"Accept", "Authorization", "Content-Type", "Content-Length", "X-CSRF-Token", "Token", "session", "Origin", "Host", "Connection", "Accept-Encoding", "Accept-Language", "X-Requested-With"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		AllowWildcard:    true,
		AllowWebSockets:  true,
	}))
	socketIoRouter.Use(ginMiddleware())
	socketIoRouter.Use(middlewares.Authenticate)

	socketIoRouter.GET("/*any", gin.WrapH(socketServer))
	socketIoRouter.POST("/*any", gin.WrapH(socketServer))
	return socketServer
}
