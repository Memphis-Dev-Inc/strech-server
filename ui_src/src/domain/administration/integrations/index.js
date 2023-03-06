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

import React, { useEffect, useContext, useState } from 'react';

import integrationRequestIcon from '../../../assets/images/integrationRequestIcon.svg';
import cloudeBadge from '../../../assets/images/cloudeBadge.svg';
import { CATEGORY_LIST, INTEGRATION_LIST } from '../../../const/integrationList';
import IntegrationItem from './components/integrationItem';
import { ApiEndpoints } from '../../../const/apiEndpoints';
import { httpRequest } from '../../../services/http';
import { Context } from '../../../hooks/store';
import { CloudQueueRounded } from '@material-ui/icons';
import Button from '../../../components/button';
import Modal from '../../../components/modal';
import Input from '../../../components/Input';
import { message } from 'antd';
import Tag from '../../../components/tag';
import Loader from '../../../components/loader';

const Integrations = () => {
    const [state, dispatch] = useContext(Context);
    const [modalIsOpen, modalFlip] = useState(false);
    const [integrationRequest, setIntegrationRequest] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [filterList, setFilterList] = useState(INTEGRATION_LIST);
    const [imagesLoaded, setImagesLoaded] = useState(false);

    useEffect(() => {
        getallIntegration();
    }, []);

    useEffect(() => {
        const images = [];
        Object.values(INTEGRATION_LIST).forEach((integration) => {
            images.push(integration.banner.props.src);
            images.push(integration.insideBanner.props.src);
            images.push(integration.icon.props.src);
        });
        const promises = [];

        images.forEach((imageUrl) => {
            const image = new Image();
            promises.push(
                new Promise((resolve) => {
                    image.onload = resolve;
                })
            );
            image.src = imageUrl;
        });

        Promise.all(promises).then(() => {
            setImagesLoaded(true);
        });
    }, []);

    useEffect(() => {
        switch (categoryFilter) {
            case 'All':
                setFilterList(INTEGRATION_LIST);
                break;
            default:
                let filteredList = Object.values(INTEGRATION_LIST).filter((integration) => integration.category.name === categoryFilter);
                setFilterList(filteredList);
                break;
        }
    }, [categoryFilter]);

    const getallIntegration = async () => {
        try {
            const data = await httpRequest('GET', ApiEndpoints.GET_ALL_INTEGRATION);
            dispatch({ type: 'SET_INTEGRATIONS', payload: data || [] });
        } catch (err) {
            return;
        }
    };
    const handleSendRequest = async () => {
        try {
            await httpRequest('POST', ApiEndpoints.REQUEST_INTEGRATION, { request_content: integrationRequest });
            message.success({
                key: 'memphisSuccessMessage',
                content: 'Thanks for your feedback',
                duration: 5,
                style: { cursor: 'pointer' },
                onClick: () => message.destroy('memphisSuccessMessage')
            });
            modalFlip(false);
            setIntegrationRequest('');
        } catch (err) {
            return;
        }
    };

    return (
        <div className="alerts-integrations-container">
            <div className="header-preferences">
                <div className="left">
                    <p className="main-header">Integrations</p>
                    <p className="sub-header">Integrations for notifications, monitoring, API calls, and more</p>
                </div>
                <Button
                    width="140px"
                    height="35px"
                    placeholder="Request integration"
                    colorType="white"
                    radiusType="circle"
                    backgroundColorType="purple"
                    border="none"
                    fontSize="12px"
                    fontFamily="InterSemiBold"
                    onClick={() => modalFlip(true)}
                />
            </div>
            <div className="categories-list">
                {Object.keys(CATEGORY_LIST).map((key) => (
                    <Tag tag={CATEGORY_LIST[key]} onClick={(e) => setCategoryFilter(e)} border={categoryFilter === CATEGORY_LIST[key].name} />
                ))}
            </div>
            {!imagesLoaded && (
                <div className="loading">
                    <Loader background={false} />
                </div>
            )}
            {imagesLoaded && (
                <div className="integration-list">
                    {Object.keys(filterList)?.map((integration) =>
                        filterList[integration].comingSoon ? (
                            <div key={filterList[integration].name} className="cloud-wrapper">
                                <div className="dark-background">
                                    <img src={cloudeBadge} />
                                    <div className="cloud-icon">
                                        <CloudQueueRounded />
                                    </div>
                                </div>
                                <IntegrationItem key={filterList[integration].name} value={filterList[integration]} />
                            </div>
                        ) : (
                            <IntegrationItem key={filterList[integration].name} value={filterList[integration]} />
                        )
                    )}
                </div>
            )}
            <Modal
                className="request-integration-modal"
                header={<img src={integrationRequestIcon} alt="errorModal" />}
                height="250px"
                width="450px"
                displayButtons={false}
                clickOutside={() => modalFlip(false)}
                open={modalIsOpen}
            >
                <div className="roll-back-modal">
                    <p className="title">Integrations framework</p>
                    <p className="desc">Until our integrations framework will be released, we can build it for you. Which integration is missing?</p>
                    <Input
                        placeholder="App & reason"
                        type="text"
                        fontSize="12px"
                        radiusType="semi-round"
                        colorType="black"
                        backgroundColorType="none"
                        borderColorType="gray"
                        height="40px"
                        onBlur={(e) => setIntegrationRequest(e.target.value)}
                        onChange={(e) => setIntegrationRequest(e.target.value)}
                        value={integrationRequest}
                    />

                    <div className="buttons">
                        <Button
                            width="150px"
                            height="34px"
                            placeholder="Close"
                            colorType="black"
                            radiusType="circle"
                            backgroundColorType="white"
                            border="gray-light"
                            fontSize="12px"
                            fontFamily="InterSemiBold"
                            onClick={() => modalFlip(false)}
                        />
                        <Button
                            width="150px"
                            height="34px"
                            placeholder="Send"
                            colorType="white"
                            radiusType="circle"
                            backgroundColorType="purple"
                            fontSize="12px"
                            fontFamily="InterSemiBold"
                            disabled={integrationRequest === ''}
                            onClick={() => handleSendRequest()}
                        />
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Integrations;
