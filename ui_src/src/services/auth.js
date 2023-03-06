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

import {
    LOCAL_STORAGE_ALREADY_LOGGED_IN,
    LOCAL_STORAGE_AVATAR_ID,
    LOCAL_STORAGE_CREATION_DATE,
    LOCAL_STORAGE_TOKEN,
    LOCAL_STORAGE_EXPIRED_TOKEN,
    LOCAL_STORAGE_USER_ID,
    LOCAL_STORAGE_USER_NAME,
    LOCAL_STORAGE_USER_TYPE,
    LOCAL_STORAGE_ENV,
    LOCAL_STORAGE_WELCOME_MESSAGE,
    LOCAL_STORAGE_FULL_NAME,
    LOCAL_STORAGE_SKIP_GET_STARTED,
    LOCAL_STORAGE_BROKER_HOST,
    LOCAL_STORAGE_REST_GW_HOST,
    LOCAL_STORAGE_UI_HOST,
    LOCAL_STORAGE_TIERED_STORAGE_TIME
} from '../const/localStorageConsts';
import pathDomains from '../router';

const AuthService = (function () {
    const saveToLocalStorage = (userData) => {
        const now = new Date();
        const expiryToken = now.getTime() + userData.expires_in;

        localStorage.setItem(LOCAL_STORAGE_ALREADY_LOGGED_IN, userData.already_logged_in);
        localStorage.setItem(LOCAL_STORAGE_AVATAR_ID, userData.avatar_id);
        localStorage.setItem(LOCAL_STORAGE_CREATION_DATE, userData.creation_date);
        localStorage.setItem(LOCAL_STORAGE_TOKEN, userData.jwt);
        localStorage.setItem(LOCAL_STORAGE_USER_ID, userData.user_id);
        localStorage.setItem(LOCAL_STORAGE_USER_NAME, userData.username);
        localStorage.setItem(LOCAL_STORAGE_FULL_NAME, userData.full_name);
        localStorage.setItem(LOCAL_STORAGE_USER_TYPE, userData.user_type);
        localStorage.setItem(LOCAL_STORAGE_EXPIRED_TOKEN, expiryToken);
        localStorage.setItem(LOCAL_STORAGE_ENV, userData.env);
        localStorage.setItem(LOCAL_STORAGE_SKIP_GET_STARTED, userData.skip_get_started);
        localStorage.setItem(LOCAL_STORAGE_BROKER_HOST, userData.broker_host);
        localStorage.setItem(LOCAL_STORAGE_REST_GW_HOST, userData.rest_gw_host);
        localStorage.setItem(LOCAL_STORAGE_UI_HOST, userData.ui_host);
        localStorage.setItem(LOCAL_STORAGE_TIERED_STORAGE_TIME, userData.tiered_storage_time_sec);
        if (userData.already_logged_in === false) {
            localStorage.setItem(LOCAL_STORAGE_WELCOME_MESSAGE, true);
        }
    };

    const logout = () => {
        const isSkipGetStarted = localStorage.getItem(LOCAL_STORAGE_SKIP_GET_STARTED);
        localStorage.clear();
        if (isSkipGetStarted === 'true') {
            localStorage.setItem(LOCAL_STORAGE_SKIP_GET_STARTED, isSkipGetStarted);
        }
        window.location.assign(pathDomains.login);
    };

    const isValidToken = () => {
        const tokenExpiryTime = localStorage.getItem(LOCAL_STORAGE_EXPIRED_TOKEN);
        if (Date.now() <= tokenExpiryTime) {
            return true;
        } else {
            return false;
        }
    };

    return {
        saveToLocalStorage,
        logout,
        isValidToken
    };
})();
export default AuthService;
