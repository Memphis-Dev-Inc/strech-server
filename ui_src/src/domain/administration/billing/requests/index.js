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

import './style.scss';
import React, { useEffect, useState } from 'react';
import { ApiEndpoints } from 'const/apiEndpoints';
import { httpRequest } from 'services/http';
import { convertBytes } from 'services/valueConvertor';
import { ReactComponent as ConsumedIcon } from 'assets/images/setting/consumed.svg';
import { ReactComponent as RedeliverIcon } from 'assets/images/setting/redeliver.svg';
import { ReactComponent as DeadLetterIcon } from 'assets/images/setting/deadLetter.svg';
import { ReactComponent as StorageIcon } from 'assets/images/setting/storage.svg';
import DatePickerComponent from 'components/datePicker';
import Loader from 'components/loader';
import { ReactComponent as DataInIcon } from 'assets/images/dataIn.svg';
import { ReactComponent as DataOutIcon } from 'assets/images/dataOut.svg';
import { ReactComponent as MessageIcon } from 'assets/images/messageIcon.svg';
import { LOCAL_STORAGE_CREATION_DATE } from 'const/localStorageConsts';
function Requests() {
    const [usageData, setUsageData] = useState(null);
    const [usageType, setUsageType] = useState('Data out');
    const [isLoading, setIsLoading] = useState(true);

    const getBillingDetails = async (date) => {
        try {
            const month = date.getMonth();
            const year = date.getFullYear();
            const data = await httpRequest('GET', `${ApiEndpoints.GET_BILLING_DETAILS}?month=${month + 1}&year=${year}`);

            setUsageData(data);
            setIsLoading(false);
        } catch (err) {
            return;
        }
    };

    const onChangeDate = (date) => {
        getBillingDetails(date);
    };

    useEffect(() => {
        const today = new Date();
        getBillingDetails(today);
    }, []);

    return (
        <div className="requests-container">
            {isLoading && <Loader />}
            <div className="header-preferences">
                <div className="header">
                    <div>
                        <p className="main-header">Usage report</p>
                        <p className="memphis-label">We will keep an eye on your data streams and alert.</p>
                    </div>
                    <DatePickerComponent onChange={onChangeDate} picker="month" allowClear={false} dateFrom={localStorage.getItem(LOCAL_STORAGE_CREATION_DATE)} />
                </div>
            </div>
            <div className="usage-details">
                <div className="segment-data">
                    <div className={`tab-container ${usageType === 'Data in' ? 'active' : ''}`} onClick={() => setUsageType('Data in')}>
                        <div className="tab">
                            <div className="tab-item">
                                <div className="top-row">
                                    <span className="icon">
                                        <DataInIcon />
                                    </span>
                                    <span className="text-left">Data in</span>
                                </div>
                                <div className="bottom-row">
                                    <span className="text">{usageData ? convertBytes(usageData?.data_in, false) : 0}</span>
                                </div>
                            </div>
                            <div className="divider" />
                            <div className="tab-item">
                                <div className="top-row">
                                    <MessageIcon />
                                    <span className="text-right">Total Messages</span>
                                </div>
                                <div className="bottom-row">
                                    <span className="text">{usageData ? usageData?.data_in_events?.toLocaleString('en-US') : '0 Gb'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className={`tab-container ${usageType === 'Data out' ? 'active' : ''}`} onClick={() => setUsageType('Data out')}>
                        <div className="tab">
                            <div className="tab-item">
                                <div className="top-row">
                                    <span className="icon">
                                        <DataOutIcon />
                                    </span>
                                    <span className="text-left">Data out</span>
                                </div>
                                <div className="bottom-row">
                                    <span className="text">{usageData ? convertBytes(usageData?.data_out, false) : '0 Gb'}</span>
                                </div>
                            </div>
                            <div className="divider" />
                            <div className="tab-item">
                                <div className="top-row">
                                    <MessageIcon />
                                    <span className="text-right">Total Messages</span>
                                </div>
                                <div className="bottom-row">
                                    <span className="text">{usageData ? usageData?.data_out_events?.toLocaleString('en-US') : 0}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                {usageType === 'Data out' && (
                    <div className="panel-container">
                        <div className="requests-panel">
                            <div className="requests-item">
                                <div className="box-edge lavander"></div>
                                <div className="circle-img">
                                    <ConsumedIcon alt="Consumed" />
                                </div>

                                <div>
                                    <label className="request-type">Consumed messages</label>
                                    <label className="request-description">The total number of consumed messages.</label>
                                </div>
                            </div>
                            <label className="requests-value">{usageData?.consumed_events?.toLocaleString('en-US')}</label>
                        </div>
                        <div className="requests-panel">
                            <div className="requests-item">
                                <div className="box-edge lavander"></div>
                                <div className="circle-img">
                                    <RedeliverIcon alt="Redelivered" />
                                </div>

                                <div>
                                    <label className="request-type">Redelivered messages</label>
                                    <label className="request-description">The total number of redelivered messages.</label>
                                </div>
                            </div>
                            <label className="requests-value">{usageData?.redelivery_events?.toLocaleString('en-US')}</label>
                        </div>
                        <div className="requests-panel">
                            <div className="requests-item">
                                <div className="box-edge lavander"></div>
                                <div className="circle-img">
                                    <StorageIcon alt="Storage" />
                                </div>

                                <div>
                                    <label className="request-type">Storage tiering</label>
                                    <label className="request-description">The total number of events migrated using storage tiering.</label>
                                </div>
                            </div>
                            <label className="requests-value">{usageData?.storage_tiering_events?.toLocaleString('en-US')}</label>
                        </div>
                        <div className="requests-panel">
                            <div className="requests-item">
                                <div className="box-edge lavander"></div>
                                <div className="circle-img">
                                    <DeadLetterIcon alt="Dead-letter" />
                                </div>

                                <div>
                                    <label className="request-type">Dead-letter messages retrieval</label>
                                    <label className="request-description">The total number of messages retransmitted from Dead-Letter Stations.</label>
                                </div>
                            </div>
                            <label className="requests-value">{usageData?.dls_retransmit_events?.toLocaleString('en-US')}</label>
                        </div>
                    </div>
                )}
                {usageType === 'Data in' && (
                    <div className="panel-container">
                        <div className="requests-panel">
                            <div className="requests-item">
                                <div className="box-edge lavander"></div>
                                <div className="circle-img">
                                    <ConsumedIcon alt="Consumed" />
                                </div>

                                <div>
                                    <label className="request-type">Produced messages</label>
                                    <label className="request-description">The total number of produced messages.</label>
                                </div>
                            </div>
                            <label className="requests-value">{usageData?.data_in_events?.toLocaleString('en-US')}</label>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
export default Requests;
