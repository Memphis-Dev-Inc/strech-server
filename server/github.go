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
	"errors"
	"fmt"
	"memphis/db"
	"memphis/models"
	"strings"
)

type githubIntegrationDetails struct {
	Repository string `json:"repository"`
	Branch     string `json:"branch"`
	Type       string `json:"type"`
}

func cacheDetailsGithub(keys map[string]interface{}, properties map[string]bool, tenantName string) {
	githubIntegration := models.Integration{}
	githubIntegration.Keys = make(map[string]interface{})
	githubIntegration.Properties = make(map[string]bool)
	if keys == nil {
		deleteIntegrationFromTenant(tenantName, "github", IntegrationsConcurrentCache)
		return
	}

	githubIntegration.Keys["token"] = keys["token"]
	githubIntegration.Keys["connected_repos"] = keys["connected_repos"]
	githubIntegration.Name = "github"

	if _, ok := IntegrationsConcurrentCache.Load(tenantName); !ok {
		IntegrationsConcurrentCache.Add(tenantName, map[string]interface{}{"github": githubIntegration})
	} else {
		err := addIntegrationToTenant(tenantName, "github", IntegrationsConcurrentCache, githubIntegration)
		if err != nil {
			serv.Errorf("cacheDetailsGithub: %s ", err.Error())
			return
		}
	}
}

func createGithubIntegration(tenantName string, keys map[string]interface{}, properties map[string]bool) (models.Integration, error) {
	exist, githubIntegration, err := db.GetIntegration("github", tenantName)
	if err != nil {
		return models.Integration{}, err
	} else if !exist {
		stringMap := GetKeysAsStringMap(keys)
		cloneKeys := copyMaps(stringMap)
		encryptedValue, err := EncryptAES([]byte(keys["token"].(string)))
		if err != nil {
			return models.Integration{}, err
		}
		cloneKeys["token"] = encryptedValue
		destMap := copyStringMapToInterfaceMap(cloneKeys)
		integrationRes, insertErr := db.InsertNewIntegration(tenantName, "github", destMap, properties)
		if insertErr != nil {
			if strings.Contains(insertErr.Error(), "already exists") {
				return models.Integration{}, errors.New("github integration already exists")

			} else {
				return models.Integration{}, insertErr
			}
		}
		githubIntegration = integrationRes
		integrationToUpdate := models.CreateIntegration{
			Name:       "github",
			Keys:       keys,
			Properties: properties,
			TenantName: tenantName,
		}
		msg, err := json.Marshal(integrationToUpdate)
		if err != nil {
			return models.Integration{}, err
		}
		err = serv.sendInternalAccountMsgWithReply(serv.MemphisGlobalAccount(), INTEGRATIONS_UPDATES_SUBJ, _EMPTY_, nil, msg, true)
		if err != nil {
			return models.Integration{}, err
		}
		githubIntegration.Keys["token"] = hideIntegrationSecretKey(keys["token"].(string))
		return githubIntegration, nil
	}
	return models.Integration{}, errors.New("github integration already exists")
}

func (it IntegrationsHandler) handleCreateGithubIntegration(tenantName string, keys map[string]interface{}) (models.Integration, int, error) {
	statusCode, keys, err := it.handleGithubIntegration(tenantName, keys)
	if err != nil {
		return models.Integration{}, statusCode, err
	}

	keys, properties := createIntegrationsKeysAndProperties("github", "", "", false, false, false, "", "", "", "", "", "", keys["token"].(string), "", "", "")
	githubIntegration, err := createGithubIntegration(tenantName, keys, properties)
	if err != nil {
		return models.Integration{}, 500, err
	}
	return githubIntegration, statusCode, nil
}

func (it IntegrationsHandler) handleGithubIntegration(tenantName string, keys map[string]interface{}) (int, map[string]interface{}, error) {
	statusCode := 500

	if keys["token"] == "" {
		exist, integrationFromDb, err := db.GetIntegration("github", tenantName)
		if err != nil {
			return 500, map[string]interface{}{}, err
		}
		if !exist {
			statusCode = SHOWABLE_ERROR_STATUS_CODE
			return SHOWABLE_ERROR_STATUS_CODE, map[string]interface{}{}, errors.New("github integration does not exist")
		}
		if value, ok := integrationFromDb.Keys["token"]; ok {
			key := getAESKey()
			decryptedValue, err := DecryptAES(key, value.(string))
			if err != nil {
				return 500, map[string]interface{}{}, err
			}
			integrationFromDb.Keys["token"] = decryptedValue
		}
		keys["token"] = integrationFromDb.Keys["token"]

	}
	return statusCode, keys, nil
}

func (it IntegrationsHandler) handleUpdateGithubIntegration(tenantName string, body models.CreateIntegrationSchema) (models.Integration, int, error) {
	statusCode, keys, err := it.handleGithubIntegration(tenantName, body.Keys)
	if err != nil {
		return models.Integration{}, statusCode, err
	}
	githubIntegration, err := updateGithubIntegration(tenantName, keys, map[string]bool{})
	if err != nil {
		return githubIntegration, 500, err
	}
	return githubIntegration, statusCode, nil
}

func updateGithubIntegration(tenantName string, keys map[string]interface{}, properties map[string]bool) (models.Integration, error) {
	exist, integrationFromDb, err := db.GetIntegration("github", tenantName)
	if err != nil {
		return models.Integration{}, err
	}
	if !exist {
		return models.Integration{}, fmt.Errorf("integration does not exist")
	}

	// stringMap := make(map[string]string)
	// for k, v := range keys {
	// 	stringValue := fmt.Sprintf("%v", v)
	// 	stringMap[k] = stringValue
	// }
	stringMap := GetKeysAsStringMap(keys)
	cloneKeys := copyMaps(stringMap)
	encryptedValue, err := EncryptAES([]byte(stringMap["token"]))
	if err != nil {
		return models.Integration{}, err
	}
	cloneKeys["token"] = encryptedValue
	// destMap := make(map[string]interface{})
	// for k, v := range cloneKeys {
	// 	destMap[k] = v
	// }
	// destMap := copyStringMapToInterfaceMap(cloneKeys)

	updateIntegration := map[string]interface{}{}
	githubDetails := githubIntegrationDetails{
		Repository: keys["repo"].(string),
		Branch:     keys["branch"].(string),
		Type:       keys["type"].(string),
	}

	updateIntegration["token"] = integrationFromDb.Keys["token"]

	if repos, ok := integrationFromDb.Keys["connected_repos"].([]interface{}); ok {
		if len(repos) > 0 {
			updateIntegration["connected_repos"] = keys["connected_repos"]
			repos = append(repos, githubDetails)
			updateIntegration["connected_repos"] = repos
		}
	} else {
		newd := []githubIntegrationDetails{}
		newd = append(newd, githubDetails)
		updateIntegration["connected_repos"] = newd
	}

	githubIntegration, err := db.UpdateIntegration(tenantName, "github", updateIntegration, properties)
	if err != nil {
		return models.Integration{}, err
	}

	integrationToUpdate := models.CreateIntegration{
		Name:       githubIntegration.Name,
		Keys:       githubIntegration.Keys,
		Properties: githubIntegration.Properties,
		TenantName: githubIntegration.TenantName,
	}

	msg, err := json.Marshal(integrationToUpdate)
	if err != nil {
		return githubIntegration, err
	}
	err = serv.sendInternalAccountMsgWithReply(serv.MemphisGlobalAccount(), INTEGRATIONS_UPDATES_SUBJ, _EMPTY_, nil, msg, true)
	if err != nil {
		return githubIntegration, err
	}

	githubIntegration.Keys["token"] = hideIntegrationSecretKey(githubIntegration.Keys["token"].(string))
	return githubIntegration, nil
}