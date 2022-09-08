// Credit for The NATS.IO Authors
// Copyright 2021-2022 The Memphis Authors
// Licensed under the MIT License (the "License");
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// This license limiting reselling the software itself "AS IS".

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
package server

import (
	"context"
	"flag"
	"fmt"
	"io/ioutil"
	"memphis-broker/analytics"
	"memphis-broker/models"
	"memphis-broker/utils"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/util/homedir"
)

type MonitoringHandler struct{ S *Server }

var clientset *kubernetes.Clientset

func clientSetConfig() error {
	var config *rest.Config
	var err error
	if configuration.DEV_ENV != "" { // dev environment is running locally and not inside the cluster
		// outside the cluster config
		var kubeconfig *string
		if home := homedir.HomeDir(); home != "" {
			kubeconfig = flag.String("kubeconfig", filepath.Join(home, ".kube", "config"), "/Users/idanasulin/.kube/config")
		} else {
			kubeconfig = flag.String("kubeconfig", "", "/Users/idanasulin/.kube/config")
		}
		flag.Parse()
		config, err = clientcmd.BuildConfigFromFlags("", *kubeconfig)
		if err != nil {
			return err
		}
	} else {
		// in cluster config
		config, err = rest.InClusterConfig()
		if err != nil {
			serv.Errorf("InClusterConfig error: " + err.Error())
			return err
		}
	}

	clientset, err = kubernetes.NewForConfig(config)
	if err != nil {
		serv.Errorf("NewForConfig error: " + err.Error())
		return err
	}

	return nil
}

func (mh MonitoringHandler) GetSystemComponents() ([]models.SystemComponent, error) {
	var components []models.SystemComponent
	if configuration.DOCKER_ENV != "" { // docker env

		err := serv.memphis.dbClient.Ping(context.TODO(), nil)
		if err != nil {
			components = append(components, models.SystemComponent{
				Component:   "mongodb",
				DesiredPods: 1,
				ActualPods:  0,
			})
		} else {
			components = append(components, models.SystemComponent{
				Component:   "mongodb",
				DesiredPods: 1,
				ActualPods:  1,
			})
		}

		components = append(components, models.SystemComponent{
			Component:   "memphis-broker",
			DesiredPods: 1,
			ActualPods:  1,
		})
	} else { // k8s env
		if clientset == nil {
			err := clientSetConfig()
			if err != nil {
				return components, err
			}
		}

		deploymentsClient := clientset.AppsV1().Deployments(configuration.K8S_NAMESPACE)
		deploymentsList, err := deploymentsClient.List(context.TODO(), metav1.ListOptions{})
		if err != nil {
			return components, err
		}

		for _, d := range deploymentsList.Items {
			components = append(components, models.SystemComponent{
				Component:   d.GetName(),
				DesiredPods: int(*d.Spec.Replicas),
				ActualPods:  int(d.Status.ReadyReplicas),
			})
		}

		statefulsetsClient := clientset.AppsV1().StatefulSets(configuration.K8S_NAMESPACE)
		statefulsetsList, err := statefulsetsClient.List(context.TODO(), metav1.ListOptions{})
		if err != nil {
			return components, err
		}
		for _, s := range statefulsetsList.Items {
			components = append(components, models.SystemComponent{
				Component:   s.GetName(),
				DesiredPods: int(*s.Spec.Replicas),
				ActualPods:  int(s.Status.ReadyReplicas),
			})
		}
	}

	return components, nil
}

func (mh MonitoringHandler) GetClusterInfo(c *gin.Context) {
	fileContent, err := ioutil.ReadFile("version.conf")
	if err != nil {
		serv.Errorf("GetClusterInfo error: " + err.Error())
		c.AbortWithStatusJSON(500, gin.H{"message": "Server error"})
		return
	}
	c.IndentedJSON(200, gin.H{"version": string(fileContent)})
}

func (mh MonitoringHandler) GetMainOverviewData(c *gin.Context) {
	stationsHandler := StationsHandler{S: mh.S}
	stations, err := stationsHandler.GetAllStationsDetails()
	if err != nil {
		serv.Errorf("GetMainOverviewData error: " + err.Error())
		c.AbortWithStatusJSON(500, gin.H{"message": "Server error"})
		return
	}
	totalMessages, err := stationsHandler.GetTotalMessagesAcrossAllStations()
	if err != nil {
		serv.Errorf("GetMainOverviewData error: " + err.Error())
		c.AbortWithStatusJSON(500, gin.H{"message": "Server error"})
		return
	}
	systemComponents, err := mh.GetSystemComponents()
	if err != nil {
		serv.Errorf("GetMainOverviewData error: " + err.Error())
		c.AbortWithStatusJSON(500, gin.H{"message": "Server error"})
		return
	}

	response := models.MainOverviewData{
		TotalStations:    len(stations),
		TotalMessages:    totalMessages,
		SystemComponents: systemComponents,
		Stations:         stations,
	}

	c.IndentedJSON(200, response)
}

func (mh MonitoringHandler) GetStationOverviewData(c *gin.Context) {
	stationsHandler := StationsHandler{S: mh.S}
	producersHandler := ProducersHandler{S: mh.S}
	consumersHandler := ConsumersHandler{S: mh.S}
	auditLogsHandler := AuditLogsHandler{}
	poisonMsgsHandler := PoisonMessagesHandler{S: mh.S}
	var body models.GetStationOverviewDataSchema
	ok := utils.Validate(c, &body, false, nil)
	if !ok {
		return
	}

	stationName := strings.ToLower(body.StationName)
	exist, station, err := IsStationExist(stationName)
	if err != nil {
		serv.Errorf("GetStationOverviewData error: " + err.Error())
		c.AbortWithStatusJSON(500, gin.H{"message": "Server error"})
		return
	}
	if !exist {
		serv.Errorf("Station does not exist")
		c.AbortWithStatusJSON(configuration.SHOWABLE_ERROR_STATUS_CODE, gin.H{"message": "Station does not exist"})
		return
	}

	connectedProducers, disconnectedProducers, deletedProducers, err := producersHandler.GetProducersByStation(station)
	if err != nil {
		serv.Errorf("GetStationOverviewData error: " + err.Error())
		c.AbortWithStatusJSON(500, gin.H{"message": "Server error"})
		return
	}

	connectedCgs, disconnectedCgs, deletedCgs, err := consumersHandler.GetCgsByStation(station)
	if err != nil {
		serv.Errorf("GetStationOverviewData error: " + err.Error())
		c.AbortWithStatusJSON(500, gin.H{"message": "Server error"})
		return
	}

	auditLogs, err := auditLogsHandler.GetAuditLogsByStation(station)
	if err != nil {
		serv.Errorf("GetStationOverviewData error: " + err.Error())
		c.AbortWithStatusJSON(500, gin.H{"message": "Server error"})
		return
	}
	totalMessages, err := stationsHandler.GetTotalMessages(station)
	if err != nil {
		serv.Errorf("GetStationOverviewData error: " + err.Error())
		c.AbortWithStatusJSON(500, gin.H{"message": "Server error"})
		return
	}
	avgMsgSize, err := stationsHandler.GetAvgMsgSize(station)
	if err != nil {
		serv.Errorf("GetStationOverviewData error: " + err.Error())
		c.AbortWithStatusJSON(500, gin.H{"message": "Server error"})
		return
	}

	messagesToFetch := 1000
	messages, err := stationsHandler.GetMessages(station, messagesToFetch)
	if err != nil {
		serv.Errorf("GetStationOverviewData error: " + err.Error())
		c.AbortWithStatusJSON(500, gin.H{"message": "Server error"})
		return
	}

	poisonMessages, err := poisonMsgsHandler.GetPoisonMsgsByStation(station)
	if err != nil {
		serv.Errorf("GetStationOverviewData error: " + err.Error())
		c.AbortWithStatusJSON(500, gin.H{"message": "Server error"})
		return
	}

	response := models.StationOverviewData{
		ConnectedProducers:    connectedProducers,
		DisconnectedProducers: disconnectedProducers,
		DeletedProducers:      deletedProducers,
		ConnectedCgs:          connectedCgs,
		DisconnectedCgs:       disconnectedCgs,
		DeletedCgs:            deletedCgs,
		TotalMessages:         totalMessages,
		AvgMsgSize:            avgMsgSize,
		AuditLogs:             auditLogs,
		Messages:              messages,
		PoisonMessages:        poisonMessages,
	}

	shouldSendAnalytics, _ := shouldSendAnalytics()
	if shouldSendAnalytics {
		user, _ := getUserDetailsFromMiddleware(c)
		analytics.SendEvent(user.Username, "user-enter-station-overview")
	}

	c.IndentedJSON(200, response)
}

func (mh MonitoringHandler) GetSystemLogs(c *gin.Context) {
	const amount = 100
	const timeout = 3 * time.Second

	var request models.SystemLogsRequest
	ok := utils.Validate(c, &request, false, nil)
	if !ok {
		return
	}

	uid := mh.S.memphis.nuid.Next()
	durableName := "$memphis_fetch_logs_consumer_" + uid

	cc := ConsumerConfig{
		OptStartSeq:   request.StartIdx,
		DeliverPolicy: DeliverByStartSequence,
		AckPolicy:     AckExplicit,
		Durable:       durableName,
	}

	switch request.LogType {
	case "err":
		cc.FilterSubject = syslogsStreamName + "." + syslogsErrSubject
	case "wrn":
		cc.FilterSubject = syslogsStreamName + "." + syslogsWarnSubject
	case "inf":
		cc.FilterSubject = syslogsStreamName + "." + syslogsInfoSubject
	}

	err := mh.S.memphisAddConsumer(syslogsStreamName, &cc)
	if err != nil {
		serv.Errorf("GetSystemLogs error: " + err.Error())
		c.AbortWithStatusJSON(500, gin.H{"message": "Server error"})
		return
	}

	responseChan := make(chan StoredMsg)
	subject := fmt.Sprintf(JSApiRequestNextT, syslogsStreamName, durableName)
	reply := durableName + "_reply"
	req := []byte(strconv.Itoa(amount))

	sub, err := mh.S.subscribeOnGlobalAcc(reply, reply+"_sid", func(_ *client, subject, reply string, msg []byte) {
		go func(respCh chan StoredMsg, reply string, msg []byte) {
			// ack
			mh.S.sendInternalAccountMsg(mh.S.GlobalAccount(), reply, []byte(_EMPTY_))

			rawTs := tokenAt(reply, 8)
			seq, _, _ := ackReplyInfo(reply)

			intTs, err := strconv.Atoi(rawTs)
			if err != nil {
				mh.S.Errorf(err.Error())
			}

			respCh <- StoredMsg{
				Sequence: uint64(seq),
				Data:     msg,
				Time:     time.Unix(0, int64(intTs)),
			}
		}(responseChan, reply, copyBytes(msg))
	})
	if err != nil {
		serv.Errorf("GetSystemLogs error: " + err.Error())
		c.AbortWithStatusJSON(500, gin.H{"message": "Server error"})
		return
	}

	mh.S.sendInternalAccountMsgWithReply(mh.S.GlobalAccount(), subject, reply, nil, req, true)

	var msgs []StoredMsg
	timer := time.NewTimer(timeout)
	for i := 0; i < amount; i++ {
		select {
		case <-timer.C:
			goto cleanup
		case msg := <-responseChan:
			msgs = append(msgs, msg)
		}
	}

cleanup:
	timer.Stop()
	sub.close()
	err = mh.S.RemoveConsumer(syslogsStreamName, durableName)
	if err != nil {
		serv.Errorf("GetSystemLogs error: " + err.Error())
		c.AbortWithStatusJSON(500, gin.H{"message": "Server error"})
		return
	}

	var resMsgs []models.MessageDetails
	for _, msg := range msgs {
		if err != nil {
			serv.Errorf("GetSystemLogs error: " + err.Error())
			c.AbortWithStatusJSON(500, gin.H{"message": "Server error"})
			return
		}

		data := string(msg.Data)
		if len(data) > 100 { // get the first chars for preview needs
			data = data[0:100]
		}
		resMsgs = append(resMsgs, models.MessageDetails{
			MessageSeq:   int(msg.Sequence),
			Data:         data,
			ProducedBy:   _EMPTY_,
			ConnectionId: _EMPTY_,
			TimeSent:     msg.Time,
			Size:         len(msg.Subject) + len(msg.Data),
		})
	}
	response := models.SystemLogsResponse{
		Logs: resMsgs}

	c.IndentedJSON(200, response)
}
