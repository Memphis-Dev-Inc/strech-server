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
	"encoding/json"
	"errors"
	"memphis-broker/models"
	"time"
)

const (
	// wrapper subject for JSApiTemplateCreate
	memphisJSApiStreamCreate = "$MEMPHIS.JS.API.STREAM.CREATE"
	// wrapper subject for JSApiTemplateDelete
	memphisJSApiStreamDelete = "$MEMPHIS.JS.API.STREAM.DELETE"
)

var wrapperMap = map[string]string{
	memphisJSApiStreamCreate: JSApiStreamCreate,
	memphisJSApiStreamDelete: JSApiStreamDelete,
}

func memphisFindJSAPIWrapperSubject(c *client, subject string) string {
	if c.memphisInfo.isNative || c.kind != CLIENT {
		return subject
	}

	for wrapped, subj := range wrapperMap {
		if subjectIsSubsetMatch(subject, subj) {
			return wrapped
		}
	}

	return subject
}

func memphisCreateNonNativeStationIfNeeded(s *Server, reply string, cfg StreamConfig, c *client) {
	respCh := make(chan *JSApiStreamCreateResponse)
	sub, err := s.subscribeOnAcc(s.SystemAccount(), reply, reply+"_sid", func(_ *client, subject, reply string, msg []byte) {
		go func(msg []byte, respCh chan *JSApiStreamCreateResponse) {
			var resp JSApiStreamCreateResponse
			if err := json.Unmarshal(msg, &resp); err != nil {
				s.Errorf("memphisJSApiWrapStreamCreate: unmarshal error: " + err.Error())
				respCh <- nil
				return
			}
			respCh <- &resp
		}(copyBytes(msg), respCh)
	})
	if err != nil {
		s.Errorf("memphisJSApiWrapStreamCreate: failed to subscribe: " + err.Error())
		return
	}

	timeout := time.NewTimer(5 * time.Second)
	select {
	case resp := <-respCh:
		if resp != nil && resp.DidCreate {
			var storageType string
			if cfg.Storage == MemoryStorage {
				storageType = "memory"
			} else if cfg.Storage == FileStorage {
				storageType = "file"
			}

			var retentionType string
			var retentionValue int
			if cfg.MaxAge > 0 {
				retentionType = "message_age_sec"
				retentionValue = int(cfg.MaxAge / 1000000000)
			} else if cfg.MaxBytes > 0 {
				retentionType = "bytes"
				retentionValue = int(cfg.MaxBytes)
			} else if cfg.MaxMsgs > 0 {
				retentionType = "messages"
				retentionValue = int(cfg.MaxMsgs)
			}

			csr := createStationRequest{
				StationName:       cfg.Name,
				SchemaName:        "",
				RetentionType:     retentionType,
				RetentionValue:    retentionValue,
				StorageType:       storageType,
				Replicas:          cfg.Replicas,
				DedupEnabled:      true,
				DedupWindowMillis: 0,
				IdempotencyWindow: int64(cfg.Duplicates.Milliseconds()),
				DlsConfiguration: models.DlsConfiguration{
					Poison:      true,
					Schemaverse: false,
				},
			}

			s.createStationDirectIntern(c, reply, &csr, false)
		}
	case <-timeout.C:
		break
	}

	s.unsubscribeOnAcc(s.SystemAccount(), sub)
}

func memphisDeleteNonNativeStationIfNeeded(s *Server, reply string, streamName string, c *client) {
	respCh := make(chan *JSApiStreamDeleteResponse)
	sub, err := s.subscribeOnAcc(s.SystemAccount(), reply, reply+"_sid", func(_ *client, subject, reply string, msg []byte) {
		go func(msg []byte, respCh chan *JSApiStreamDeleteResponse) {
			var resp JSApiStreamDeleteResponse
			if err := json.Unmarshal(msg, &resp); err != nil {
				s.Errorf("memphisJSApiWrapStreamDelete: unmarshal error: " + err.Error())
				respCh <- nil
				return
			}
			respCh <- &resp
		}(copyBytes(msg), respCh)
	})
	if err != nil {
		s.Errorf("memphisJSApiWrapStreamDelete: failed to subscribe: " + err.Error())
		return
	}

	timeout := time.NewTimer(5 * time.Second)
	select {
	case resp := <-respCh:
		if resp != nil && resp.Success {
			dsr := destroyStationRequest{StationName: streamName}
			s.removeStationDirectIntern(c, reply, &dsr, false)
		}
	case <-timeout.C:
		break
	}

	s.unsubscribeOnAcc(s.SystemAccount(), sub)
}

func (s *Server) memphisJSApiWrapStreamCreate(sub *subscription, c *client, acc *Account, subject, reply string, rmsg []byte) {
	var resp = JSApiStreamCreateResponse{ApiResponse: ApiResponse{Type: JSApiStreamCreateResponseType}}

	var cfg StreamConfig
	ci, acc, _, msg, err := s.getRequestInfo(c, rmsg)
	if err != nil {
		s.Warnf(badAPIRequestT, msg)
		return
	}

	if err := json.Unmarshal(msg, &cfg); err != nil {
		resp.Error = NewJSInvalidJSONError()
		s.sendAPIErrResponse(ci, acc, subject, reply, string(msg), s.jsonResponse(&resp))
		return
	}

	if cfg.Retention != LimitsPolicy {
		resp.Error = NewJSStreamCreateError(errors.New("The only supported retention type is limits"))
		s.sendAPIErrResponse(ci, acc, subject, reply, string(msg), s.jsonResponse(&resp))
		return
	}

	if len(cfg.Name) > 32 {
		resp.Error = NewJSStreamCreateError(errors.New("Stream name can not be greater than 32 characters"))
		s.sendAPIErrResponse(ci, acc, subject, reply, string(msg), s.jsonResponse(&resp))
		return
	}

	go memphisCreateNonNativeStationIfNeeded(s, reply, cfg, c)

	s.jsStreamCreateRequestIntern(sub, c, acc, subject, reply, rmsg)
}

func (s *Server) memphisJSApiWrapStreamDelete(sub *subscription, c *client, acc *Account, subject, reply string, rmsg []byte) {
	go memphisDeleteNonNativeStationIfNeeded(s, reply, streamNameFromSubject(subject), c)

	s.jsStreamDeleteRequestIntern(sub, c, acc, subject, reply, rmsg)
}
