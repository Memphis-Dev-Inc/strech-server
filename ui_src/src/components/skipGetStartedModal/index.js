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

import React from 'react';
import Modal from '../modal';
import { LOCAL_STORAGE_SKIP_GET_STARTED, LOCAL_STORAGE_USER_NAME } from '../../const/localStorageConsts';
import { ApiEndpoints } from '../../const/apiEndpoints';
import { httpRequest } from '../../services/http';
import { capitalizeFirst } from '../../services/valueConvertor';

const SkipGetStrtedModal = ({ open, skip, cancel }) => {
    const skipGetStarted = async () => {
        try {
            await httpRequest('POST', ApiEndpoints.SKIP_GET_STARTED, { username: capitalizeFirst(localStorage.getItem(LOCAL_STORAGE_USER_NAME)) });
            localStorage.setItem(LOCAL_STORAGE_SKIP_GET_STARTED, true);
        } catch (error) {}
    };

    return (
        <Modal
            header="Are we skipping the tutorial?"
            height="100px"
            width="400px"
            rBtnText="Skip"
            lBtnText="Don't skip"
            lBtnClick={() => cancel()}
            rBtnClick={() => {
                skip();
                skipGetStarted();
            }}
            clickOutside={() => cancel()}
            open={open}
        >
            <div className="skip-tutorial-modal">
                <span>The tutorial will be closed.</span>
                <span>You can always head to Memphis documentation for guides and tutorials.</span>
            </div>
        </Modal>
    );
};
export default SkipGetStrtedModal;
