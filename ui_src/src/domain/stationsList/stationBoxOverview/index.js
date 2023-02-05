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

import './style.scss';

import React, { useState, useEffect } from 'react';
import { MinusOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import Lottie from 'lottie-react';

import { convertSecondsToDate, numberWithCommas } from '../../../services/valueConvertor';
import activeAndHealthy from '../../../assets/lotties/activeAndHealthy.json';
import noActiveAndUnhealthy from '../../../assets/lotties/noActiveAndUnhealthy.json';
import noActiveAndHealthy from '../../../assets/lotties/noActiveAndHealthy.json';
import activeAndUnhealthy from '../../../assets/lotties/activeAndUnhealthy.json';
import retentionIcon from '../../../assets/images/retentionIcon.svg';
import redirectIcon from '../../../assets/images/redirectIcon.svg';
import replicasIcon from '../../../assets/images/replicasIcon.svg';
import totalMsgIcon from '../../../assets/images/totalMsgIcon.svg';
import poisonMsgIcon from '../../../assets/images/poisonMsgIcon.svg';
import YellowHealth from '../../../assets/images/yellowHealth.svg';
import OverflowTip from '../../../components/tooltip/overflowtip';
import GreenHealth from '../../../assets/images/greenHealth.svg';
import { parsingDate } from '../../../services/valueConvertor';
import CheckboxComponent from '../../../components/checkBox';
import storageIcon from '../../../assets/images/strIcon.svg';
import TagsList from '../../../components/tagList';
import pathDomains from '../../../router';
import HealthyBadge from '../../../components/healthyBadge';

const StationBoxOverview = ({ station, handleCheckedClick, isCheck }) => {
    const [retentionValue, setRetentionValue] = useState('');
    useEffect(() => {
        switch (station?.station?.retention_type) {
            case 'message_age_sec':
                convertSecondsToDate(station?.station?.retention_value);
                setRetentionValue(convertSecondsToDate(station?.station?.retention_value));
                break;
            case 'bytes':
                setRetentionValue(`${station?.station?.retention_value} bytes`);
                break;
            case 'messages':
                setRetentionValue(`${station?.station?.retention_value} messages`);
                break;
            default:
                break;
        }
    }, []);

    return (
        <div>
            <CheckboxComponent className="check-box-station" checked={isCheck} id={station?.station?.name} onChange={handleCheckedClick} name={station?.station?.name} />
            <Link to={`${pathDomains.stations}/${station?.station?.name}`}>
                <div className="station-box-container">
                    <div className="left-section">
                        <div className="check-box">
                            <OverflowTip className="station-name" text={station?.station?.name}>
                                {station?.station?.name}{' '}
                                <label className="data-labels date" style={{ marginLeft: '5px' }}>
                                    {!station?.station?.is_native && '(non-native)'}
                                </label>
                            </OverflowTip>
                        </div>
                        <label className="data-labels date">
                            Created by {station?.station?.created_by_user} at {parsingDate(station?.station?.creation_date)}{' '}
                        </label>
                    </div>
                    <div className="middle-section">
                        <div className="station-created">
                            <label className="data-labels attached">Attached Schema</label>
                            <OverflowTip
                                className="data-info"
                                text={station?.station?.schema?.name === '' ? <MinusOutlined /> : station?.station?.schema?.name}
                                width={'90px'}
                            >
                                {station?.station?.schema?.name === '' ? <MinusOutlined /> : station?.station?.schema?.name}
                            </OverflowTip>
                        </div>
                        <div className="station-created">
                            <label className="data-labels">Tags</label>

                            <div className="tags-list">
                                {station?.tags.length === 0 ? (
                                    <p className="data-info">
                                        <MinusOutlined />
                                    </p>
                                ) : (
                                    <TagsList tagsToShow={3} tags={station?.tags} />
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="right-section">
                        <div className="station-meta">
                            <img src={retentionIcon} alt="retention" />
                            <label className="data-labels retention">Retention</label>
                            <OverflowTip className="data-info" text={retentionValue} width={'90px'}>
                                {retentionValue}
                            </OverflowTip>
                        </div>
                        <div className="station-meta">
                            <img src={storageIcon} alt="storage" />
                            <label className="data-labels storage">Storage Type</label>
                            <p className="data-info">{station?.station?.storage_type}</p>
                        </div>
                        <div className="station-meta">
                            <img src={replicasIcon} alt="replicas" />
                            <label className="data-labels replicas">Replicas</label>
                            <p className="data-info">{station?.station?.replicas}</p>
                        </div>
                        <div className="station-meta">
                            <img src={totalMsgIcon} alt="total messages" />
                            <label className="data-labels total">Total messages</label>
                            <p className="data-info">
                                {station.total_messages === 0 ? <MinusOutlined style={{ color: '#2E2C34' }} /> : numberWithCommas(station?.total_messages)}
                            </p>
                        </div>
                        <div className="station-meta poison">
                            <div>
                                <img src={poisonMsgIcon} alt="poison messages" />
                                <label className="data-labels">Status</label>
                            </div>
                            <div className="health-icon">
                                {station?.has_dls_messages ? (
                                    station?.activity ? (
                                        <Lottie animationData={activeAndUnhealthy} loop={true} />
                                    ) : (
                                        <Lottie animationData={noActiveAndUnhealthy} loop={true} />
                                    )
                                ) : station?.activity ? (
                                    <Lottie animationData={activeAndHealthy} loop={true} />
                                ) : (
                                    <Lottie animationData={noActiveAndHealthy} loop={true} />
                                )}
                            </div>
                        </div>
                        <div className="station-actions">
                            <div className="action">
                                <img src={redirectIcon} alt="redirectIcon" />
                            </div>
                        </div>
                    </div>
                </div>
            </Link>
        </div>
    );
};

export default StationBoxOverview;
