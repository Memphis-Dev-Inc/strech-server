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

export const ApiEndpoints = {
    //Management
    LOGIN: '/usermgmt/login',
    SIGNUP: '/usermgmt/addUserSignUp',
    REFRESH_TOKEN: '/usermgmt/refreshToken',
    ADD_USER: '/usermgmt/addUser',
    GET_ALL_USERS: '/usermgmt/getAllUsers',
    GET_APP_USERS: '/usermgmt/getApplicationUsers',
    REMOVE_USER: '/usermgmt/removeUser',
    REMOVE_MY_UER: '/usermgmt/removeMyUser',
    EDIT_AVATAR: '/usermgmt/editAvatar',
    GET_COMPANY_LOGO: '/usermgmt/getCompanyLogo',
    EDIT_COMPANY_LOGO: '/usermgmt/editCompanyLogo',
    REMOVE_COMPANY_LOGO: '/usermgmt/removeCompanyLogo',
    EDIT_ANALYTICS: '/usermgmt/editAnalytics',
    SANDBOX_LOGIN: '/sandbox/login',
    DONE_NEXT_STEPS: '/usermgmt/doneNextSteps',
    GET_SIGNUP_FLAG: '/usermgmt/getSignUpFlag',
    SKIP_GET_STARTED: '/usermgmt/skipGetStarted',
    GET_FILTER_DETAILS: '/usermgmt/getFilterDetails',

    //Station
    CREATE_STATION: '/stations/createStation',
    REMOVE_STATION: '/stations/removeStation',
    GET_STATION: '/stations/getStation',
    GET_ALL_STATIONS: '/stations/getAllStations',
    GET_STATIONS: '/stations/getStations',
    GET_POISON_MESSAGE_JOURNEY: '/stations/getPoisonMessageJourney',
    GET_MESSAGE_DETAILS: '/stations/getMessageDetails',
    DROP_DLS_MESSAGE: '/stations/dropDlsMessages',
    RESEND_POISON_MESSAGE_JOURNEY: '/stations/resendPoisonMessages',
    USE_SCHEMA: '/stations/useSchema',
    GET_UPDATE_SCHEMA: '/stations/getUpdatesForSchemaByStation',
    REMOVE_SCHEMA_FROM_STATION: '/stations/removeSchemaFromStation',
    TIERD_STORAGE_CLICKED: '/stations/tierdStorageClicked',
    UPDATE_DLS_CONFIGURATION: '/stations/updateDlsConfig',

    //Producers
    GET_ALL_PRODUCERS_BY_STATION: '/producers/getAllProducersByStation',

    //Consumers
    GET_ALL_CONSUMERS_BY_STATION: '/consumers/getAllConsumersByStation',

    //Monitor
    GET_CLUSTER_INFO: '/monitoring/getClusterInfo',
    GET_MAIN_OVERVIEW_DATA: '/monitoring/getMainOverviewData',
    GET_STATION_DATA: '/monitoring/getStationOverviewData',
    GET_SYS_LOGS: '/monitoring/getSystemLogs',
    DOWNLOAD_SYS_LOGS: '/monitoring/downloadSystemLogs',
    GET_AVAILABLE_REPLICAS: '/monitoring/getAvailableReplicas',

    //Tags
    GET_TAGS: '/tags/getTags',
    GET_USED_TAGS: '/tags/getUsedTags',
    REMOVE_TAG: '/tags/removeTag',
    CREATE_NEW_TAG: '/tags/createNewTag',
    UPDATE_TAGS_FOR_ENTITY: '/tags/updateTagsForEntity',

    //Schemas
    GET_ALL_SCHEMAS: '/schemas/getAllSchemas',
    CREATE_NEW_SCHEMA: '/schemas/createNewSchema',
    GET_SCHEMA_DETAILS: '/schemas/getSchemaDetails',
    REMOVE_SCHEMA: '/schemas/removeSchema',
    CREATE_NEW_VERSION: '/schemas/createNewVersion',
    ROLL_BACK_VERSION: '/schemas/rollBackVersion',
    VALIDATE_SCHEMA: '/schemas/validateSchema',

    //Integrations
    CREATE_INTEGRATION: '/integrations/createIntegration',
    UPDATE_INTEGRATIONL: '/integrations/updateIntegration',
    GET_INTEGRATION_DETAILS: '/integrations/getIntegrationDetails',
    GET_ALL_INTEGRATION: '/integrations/getAllIntegrations',
    DISCONNECT_INTEGRATION: '/integrations/disconnectIntegration',
    REQUEST_INTEGRATION: '/integrations/requestIntegration',

    //Configuration
    GET_CLUSTER_CONFIGURATION: '/configurations/getClusterConfig',
    EDIT_CLUSTER_CONFIGURATION: '/configurations/editClusterConfig',

    //Auth
    GENERATE_TOKEN: '/auth/authenticate'
};
