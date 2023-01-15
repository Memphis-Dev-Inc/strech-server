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

import React, { useContext, useEffect, useState } from 'react';
import { Link, useHistory } from 'react-router-dom';

import { LOCAL_STORAGE_ALLOW_ANALYTICS, LOCAL_STORAGE_SKIP_GET_STARTED, LOCAL_STORAGE_USER_NAME } from '../../../../const/localStorageConsts';
import slackColors from '../../../../assets/images/slackColors.svg';
import discordLogo from '../../../../assets/images/discordLogo.svg';
import GithubLogo from '../../../../assets/images/githubLogo.svg';
import { ApiEndpoints } from '../../../../const/apiEndpoints';
import docsLogo from '../../../../assets/images/docsLogo.svg';
import { httpRequest } from '../../../../services/http';
import Switcher from '../../../../components/switcher';
import Button from '../../../../components/button';
import { GetStartedStoreContext } from '..';
import pathDomains from '../../../../router';
import Modal from '../../../../components/modal';
import SlackIntegration from '../../../preferences/integrations/components/slackIntegration';

const Finish = ({ createStationFormRef }) => {
    const history = useHistory();
    const [getStartedState, getStartedDispatch] = useContext(GetStartedStoreContext);
    const [allowAnalytics, setAllowAnalytics] = useState(localStorage.getItem(LOCAL_STORAGE_ALLOW_ANALYTICS) || false);
    const [modalIsOpen, modalFlip] = useState(false);
    const [integrateValue, setIntegrateValue] = useState({});

    useEffect(() => {
        createStationFormRef.current = onNext;
        httpRequest('POST', ApiEndpoints.SKIP_GET_STARTED, localStorage.getItem(LOCAL_STORAGE_USER_NAME));
        getIntegration();
    }, []);

    const onNext = () => {
        doneNextSteps();
        window.location.reload(false);
    };

    const onFinish = (e) => {
        e.preventDefault();
        getStartedDispatch({ type: 'INITIAL_STATE', payload: {} });
        doneNextSteps();
        history.push(`${pathDomains.stations}/${getStartedState.stationName}`);
        localStorage.setItem(LOCAL_STORAGE_SKIP_GET_STARTED, true);
    };

    const doneNextSteps = async () => {
        try {
            await httpRequest('POST', ApiEndpoints.DONE_NEXT_STEPS);
        } catch (error) {}
    };

    const getIntegration = async () => {
        try {
            const data = await httpRequest('GET', `${ApiEndpoints.GET_INTEGRATION_DETAILS}?name=slack`);
            setIntegrateValue(data);
        } catch (error) {}
    };

    return (
        <div className="finish-container">
            <div className="btn-container">
                <div className="buttons-wrapper">
                    <Button
                        height="42px"
                        placeholder={
                            <div className="slack-button">
                                <img src={slackColors} />
                                <p>Integrate Slack</p>
                            </div>
                        }
                        radiusType="circle"
                        backgroundColorType="white"
                        colorType="black"
                        border={'gray-light'}
                        borderRadius="31px"
                        boxShadowStyle="none"
                        marginTop="20px"
                        onClick={() => {
                            modalFlip(true);
                        }}
                    />
                    <Button
                        height="42px"
                        placeholder="Go to station overview"
                        radiusType="circle"
                        backgroundColorType="purple"
                        fontSize="16px"
                        fontWeight="bold"
                        colorType="white"
                        borderRadius="31px"
                        boxShadowStyle="none"
                        marginTop="20px"
                        onClick={(e) => {
                            onFinish(e);
                        }}
                    />
                </div>
            </div>
            <div className="container-icons-finish">
                <p className="link-finish-header">Link to our channels</p>
                <Link className="icon-image" to={{ pathname: 'https://docs.memphis.dev' }} target="_blank">
                    <img src={docsLogo} width="25px" height="25px" alt="slack-icon"></img>
                </Link>
                <Link className="icon-image" to={{ pathname: 'https://github.com/memphisdev' }} target="_blank">
                    <img src={GithubLogo} width="25px" height="25px" alt="github-icon"></img>
                </Link>
                <Link className="icon-image" to={{ pathname: 'https://discord.com/invite/WZpysvAeTf' }} target="_blank">
                    <img src={discordLogo} width="25px" height="25px" alt="discord_icon"></img>
                </Link>
            </div>
            <Modal className="integration-modal" height="95vh" width="720px" displayButtons={false} clickOutside={() => modalFlip(false)} open={modalIsOpen}>
                <SlackIntegration
                    close={(data) => {
                        modalFlip(false);
                        setIntegrateValue(data);
                    }}
                    value={integrateValue}
                />
            </Modal>
        </div>
    );
};

export default Finish;
