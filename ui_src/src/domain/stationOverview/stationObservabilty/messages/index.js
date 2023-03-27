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

import React, { useContext, useEffect, useState } from 'react';
import { InfoOutlined } from '@material-ui/icons';
import { message } from 'antd';

import { messageParser, msToUnits, numberWithCommas } from '../../../../services/valueConvertor';
import deadLetterPlaceholder from '../../../../assets/images/deadLetterPlaceholder.svg';
import waitingMessages from '../../../../assets/images/waitingMessages.svg';
import idempotencyIcon from '../../../../assets/images/idempotencyIcon.svg';
import purgeWrapperIcon from '../../../../assets/images/purgeWrapperIcon.svg';
import purge from '../../../../assets/images/purge.svg';
import dlsEnableIcon from '../../../../assets/images/dls_enable_icon.svg';
import followersImg from '../../../../assets/images/followersDetails.svg';
import leaderImg from '../../../../assets/images/leaderDetails.svg';
import PurgeStationModal from '../components/purgeStationModal';
import CheckboxComponent from '../../../../components/checkBox';
import { ApiEndpoints } from '../../../../const/apiEndpoints';
import DetailBox from '../../../../components/detailBox';
import DlsConfig from '../../../../components/dlsConfig';
import { httpRequest } from '../../../../services/http';
import CustomTabs from '../../../../components/Tabs';
import Button from '../../../../components/button';
import Modal from '../../../../components/modal';
import { StationStoreContext } from '../..';
import pathDomains from '../../../../router';
import MessageDetails from '../components/messageDetails';
import { Virtuoso } from 'react-virtuoso';

const Messages = () => {
    const [stationState, stationDispatch] = useContext(StationStoreContext);
    const [selectedRowIndex, setSelectedRowIndex] = useState(null);
    const [modalPurgeIsOpen, modalPurgeFlip] = useState(false);
    const [resendProcced, setResendProcced] = useState(false);
    const [ignoreProcced, setIgnoreProcced] = useState(false);
    const [indeterminate, setIndeterminate] = useState(false);
    const [userScrolled, setUserScrolled] = useState(false);
    const [subTabValue, setSubTabValue] = useState('Unacked');
    const [tabValue, setTabValue] = useState('Messages');
    const [loader, setLoader] = useState(false);
    const [purgeData, setPurgeData] = useState(false);
    const [isCheck, setIsCheck] = useState([]);
    const tabs = ['Messages', 'Dead-letter', 'Details'];
    const subTabs = [
        { name: 'Unacked', disabled: false },
        { name: 'Schema violation', disabled: !stationState?.stationMetaData?.is_native }
    ];
    const url = window.location.href;
    const stationName = url.split('stations/')[1];

    const onSelectedRow = (id) => {
        setUserScrolled(false);
        setSelectedRowIndex(id);
        stationDispatch({ type: 'SET_SELECTED_ROW_ID', payload: id });
    };

    const handleCheckedClick = (e) => {
        const { id, checked } = e.target;
        let checkedList = [];
        if (!checked) {
            setIsCheck(isCheck.filter((item) => item !== id));
            checkedList = isCheck.filter((item) => item !== id);
        }
        if (checked) {
            checkedList = [...isCheck, id];
            setIsCheck(checkedList);
        }
        if (subTabValue === subTabs[0].name) {
            setIndeterminate(!!checkedList.length && checkedList.length < stationState?.stationSocketData?.poison_messages?.length);
        } else {
            setIndeterminate(!!checkedList.length && checkedList.length < stationState?.stationSocketData?.schema_failed_messages?.length);
        }
    };

    const handleChangeMenuItem = (newValue) => {
        stationDispatch({ type: 'SET_SELECTED_ROW_ID', payload: null });
        setSelectedRowIndex(null);
        setIsCheck([]);

        setTabValue(newValue);
        subTabValue === 'Schema violation' && setSubTabValue('Unacked');
    };

    useEffect(() => {
        if (selectedRowIndex && !userScrolled) {
            const element = document.getElementById(selectedRowIndex);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }, [stationState?.stationSocketData]);

    const handleChangeSubMenuItem = (newValue) => {
        stationDispatch({ type: 'SET_SELECTED_ROW_ID', payload: null });
        setSelectedRowIndex(null);
        setSubTabValue(newValue);
        setIsCheck([]);
    };

    const handleDrop = async () => {
        setIgnoreProcced(true);
        let messages;
        try {
            if (tabValue === tabs[0]) {
                await httpRequest('DELETE', `${ApiEndpoints.REMOVE_MESSAGES}`, { station_name: stationName, message_seqs: isCheck });
                messages = stationState?.stationSocketData?.messages;
                isCheck.map((messageId, index) => {
                    messages = messages?.filter((item) => {
                        return item.message_seq !== messageId;
                    });
                });
            } else {
                await httpRequest('POST', `${ApiEndpoints.DROP_DLS_MESSAGE}`, {
                    dls_type: subTabValue === subTabs[0].name ? 'poison' : 'schema',
                    dls_message_ids: isCheck,
                    station_name: stationName
                });
                messages = subTabValue === subTabs[0].name ? stationState?.stationSocketData?.poison_messages : stationState?.stationSocketData?.schema_failed_messages;
                isCheck.map((messageId, index) => {
                    messages = messages?.filter((item) => {
                        return item.id !== messageId;
                    });
                });
            }
            setTimeout(() => {
                setIgnoreProcced(false);
                subTabValue === subTabs[0].name
                    ? stationDispatch({ type: 'SET_POISON_MESSAGES', payload: messages })
                    : stationDispatch({ type: 'SET_FAILED_MESSAGES', payload: messages });
                stationDispatch({ type: 'SET_SELECTED_ROW_ID', payload: null });
                setSelectedRowIndex(null);
                setIsCheck([]);
                setIndeterminate(false);
            }, 1500);
        } catch (error) {
            setIgnoreProcced(false);
        }
    };

    useEffect(() => {
        if (
            (stationState?.stationSocketData?.total_messages === 0 && purgeData.purge_station) ||
            (stationState?.stationSocketData?.total_dls_messages === 0 && purgeData.purge_dls)
        ) {
            modalPurgeFlip(false);
            setLoader(false);
            setPurgeData({});
        }
    }, [stationState?.stationSocketData]);

    const handlePurge = async (purgeData) => {
        setLoader(true);
        setIgnoreProcced(true);
        try {
            let purgeDataPayload = purgeData;
            purgeDataPayload['station_name'] = stationName;
            await httpRequest('DELETE', `${ApiEndpoints.PURGE_STATION}`, purgeDataPayload);
            setIgnoreProcced(false);
            stationDispatch({ type: 'SET_SELECTED_ROW_ID', payload: null });
            let data = stationState?.stationSocketData;
            if (purgeDataPayload['purge_station']) data['total_messages'] = 0;
            if (purgeDataPayload['purge_dls']) data['total_dls_messages'] = 0;
            stationDispatch({ type: 'SET_SOCKET_DATA', payload: data });
            setSelectedRowIndex(null);
            setIsCheck([]);
            setIndeterminate(false);
        } catch (error) {
            setLoader(false);
            setIgnoreProcced(false);
        }
    };

    const handleResend = async () => {
        setResendProcced(true);
        try {
            await httpRequest('POST', `${ApiEndpoints.RESEND_POISON_MESSAGE_JOURNEY}`, { poison_message_ids: isCheck, station_name: stationName });
            setTimeout(() => {
                setResendProcced(false);
                message.success({
                    key: 'memphisSuccessMessage',
                    content: isCheck.length === 1 ? 'The message was sent successfully' : 'The messages were sent successfully',
                    duration: 5,
                    style: { cursor: 'pointer' },
                    onClick: () => message.destroy('memphisSuccessMessage')
                });
                setIsCheck([]);
            }, 1500);
        } catch (error) {
            setResendProcced(false);
        }
    };

    const handleScroll = () => {
        setUserScrolled(true);
    };

    const listGenerator = (index, message) => {
        const id = tabValue === tabs[1] ? message?.id : message?.message_seq;
        return (
            <div className={index % 2 === 0 ? 'even' : 'odd'}>
                <CheckboxComponent className="check-box-message" checked={isCheck?.includes(id)} id={id} onChange={handleCheckedClick} name={id} />

                <div className={selectedRowIndex === id ? 'row-message selected' : 'row-message'} key={id} id={id} onClick={() => onSelectedRow(id)}>
                    {selectedRowIndex === id && <div className="hr-selected"></div>}
                    <span className="preview-message">
                        {tabValue === tabs[1] ? messageParser('string', message?.message?.data) : messageParser('string', message?.data)}
                    </span>
                </div>
            </div>
        );
    };

    const listGeneratorWrapper = () => {
        let isDls = tabValue === tabs[1];
        return (
            <div className={isDls ? 'list-wrapper dls-list' : 'list-wrapper msg-list'}>
                <div className="coulmns-table">
                    <p className="left-coulmn">Messages</p>
                    <p className="right-coulmn">Information</p>
                </div>
                <div className="list">
                    <div className="rows-wrapper">
                        <Virtuoso
                            data={
                                !isDls
                                    ? stationState?.stationSocketData?.messages
                                    : subTabValue === 'Unacked'
                                    ? stationState?.stationSocketData?.poison_messages
                                    : stationState?.stationSocketData?.schema_failed_messages
                            }
                            onScroll={() => handleScroll()}
                            overscan={100}
                            itemContent={(index, message) => listGenerator(index, message)}
                        />
                    </div>
                    <MessageDetails isDls={isDls} isFailedSchemaMessage={subTabValue === 'Schema violation'} />
                </div>
            </div>
        );
    };

    const showLastMsg = () => {
        let amount = 0;
        if (tabValue === tabs[0] && stationState?.stationSocketData?.messages?.length > 0) amount = stationState?.stationSocketData?.messages?.length;
        else if (tabValue === tabs[1] && subTabValue === subTabs[0].name && stationState?.stationSocketData?.poison_messages?.length > 0)
            amount = stationState?.stationSocketData?.poison_messages?.length;
        else if (tabValue === tabs[1] && subTabValue === subTabs[1].name && stationState?.stationSocketData?.schema_failed_messages?.length > 0)
            amount = stationState?.stationSocketData?.schema_failed_messages?.length;
        return (
            amount > 0 && (
                <div className="messages-amount">
                    <InfoOutlined />
                    <p>
                        Showing last {numberWithCommas(amount)} out of{' '}
                        {tabValue === tabs[0]
                            ? numberWithCommas(stationState?.stationSocketData?.total_messages)
                            : numberWithCommas(stationState?.stationSocketData?.total_dls_messages)}{' '}
                        messages
                    </p>
                </div>
            )
        );
    };

    return (
        <div className="messages-container">
            <div className="header">
                <div className="left-side">
                    <p className="title">Station</p>
                    {showLastMsg()}
                </div>
                <div className="right-side">
                    {((tabValue === tabs[0] && stationState?.stationSocketData?.messages?.length > 0) ||
                        (tabValue === tabs[1] &&
                            ((subTabValue === subTabs[0].name && stationState?.stationSocketData?.poison_messages?.length > 0) ||
                                (subTabValue === subTabs[1].name && stationState?.stationSocketData?.schema_failed_messages?.length > 0)))) && (
                        <Button
                            width="80px"
                            height="32px"
                            placeholder="Drop"
                            colorType="white"
                            radiusType="circle"
                            backgroundColorType="purple"
                            fontSize="12px"
                            fontWeight="600"
                            disabled={isCheck.length === 0}
                            isLoading={ignoreProcced}
                            onClick={() => handleDrop()}
                        />
                    )}
                    {tabValue === 'Dead-letter' && subTabValue === 'Unacked' && stationState?.stationSocketData?.poison_messages?.length > 0 && (
                        <Button
                            width="80px"
                            height="32px"
                            placeholder="Resend"
                            colorType="white"
                            radiusType="circle"
                            backgroundColorType="purple"
                            fontSize="12px"
                            fontWeight="600"
                            disabled={isCheck.length === 0 || !stationState?.stationMetaData?.is_native}
                            tooltip={!stationState?.stationMetaData?.is_native && 'Supported only by using Memphis SDKs'}
                            isLoading={resendProcced}
                            onClick={() => handleResend()}
                        />
                    )}
                </div>
            </div>
            <div className="tabs">
                <CustomTabs
                    value={tabValue}
                    onChange={handleChangeMenuItem}
                    tabs={tabs}
                    length={[
                        null,
                        stationState?.stationSocketData?.poison_messages?.length || stationState?.stationSocketData?.schema_failed_messages?.length || null,
                        null
                    ]}
                    icon
                />
            </div>
            {tabValue === tabs[1] && (
                <div className="tabs">
                    <CustomTabs
                        defaultValue
                        value={subTabValue}
                        onChange={handleChangeSubMenuItem}
                        tabs={subTabs}
                        length={[
                            stationState?.stationSocketData?.poison_messages?.length || null,
                            stationState?.stationSocketData?.schema_failed_messages?.length || null
                        ]}
                        tooltip={[null, !stationState?.stationMetaData?.is_native && 'Supported only by using Memphis SDKs']}
                    />
                </div>
            )}
            {tabValue === tabs[0] && stationState?.stationSocketData?.messages?.length > 0 && listGeneratorWrapper()}
            {tabValue === tabs[1] && subTabValue === subTabs[0].name && stationState?.stationSocketData?.poison_messages?.length > 0 && listGeneratorWrapper()}
            {tabValue === tabs[1] && subTabValue === subTabs[1].name && stationState?.stationSocketData?.schema_failed_messages?.length > 0 && listGeneratorWrapper()}

            {tabValue === tabs[0] && stationState?.stationSocketData?.messages === null && (
                <div className="waiting-placeholder msg-plc">
                    <img width={100} src={waitingMessages} alt="waitingMessages" />
                    <p>No messages yet</p>
                    <span className="des">Create your 1st producer and start producing data</span>
                    {process.env.REACT_APP_SANDBOX_ENV && stationName !== 'demo-app' && (
                        <a className="explore-button" href={`${pathDomains.stations}/demo-app`} target="_parent">
                            Explore demo
                        </a>
                    )}
                </div>
            )}
            {tabValue === tabs[1] &&
                ((subTabValue === 'Unacked' && stationState?.stationSocketData?.poison_messages?.length === 0) ||
                    (subTabValue === 'Schema violation' && stationState?.stationSocketData?.schema_failed_messages?.length === 0)) && (
                    <div className="waiting-placeholder msg-plc">
                        <img width={80} src={deadLetterPlaceholder} alt="waitingMessages" />
                        <p>Hooray! No messages</p>
                    </div>
                )}
            {tabValue === tabs[2] && (
                <div className="details">
                    <DetailBox
                        img={dlsEnableIcon}
                        title={'Dead-letter station configuration'}
                        desc="Triggers for storing messages in the dead-letter station."
                        rightSection={false}
                    >
                        <DlsConfig />
                    </DetailBox>
                    <DetailBox img={purge} title={'Purge'}>
                        <div className="purge-container">
                            <label>Clean station from messages.</label>
                            <Button
                                width="80px"
                                height="32px"
                                placeholder="Purge"
                                colorType="white"
                                radiusType="circle"
                                backgroundColorType="purple"
                                fontSize="12px"
                                fontWeight="600"
                                disabled={stationState?.stationSocketData?.total_dls_messages === 0 && stationState?.stationSocketData?.total_messages === 0}
                                onClick={() => modalPurgeFlip(true)}
                            />
                        </div>
                    </DetailBox>
                    <DetailBox
                        img={leaderImg}
                        title={'Leader'}
                        desc={
                            <span>
                                The current leader of this station.{' '}
                                <a href="https://docs.memphis.dev/memphis/memphis/concepts/station#leaders-and-followers" target="_blank">
                                    Learn more
                                </a>
                            </span>
                        }
                        data={[stationState?.stationSocketData?.leader]}
                    />
                    {stationState?.stationSocketData?.followers?.length > 0 && (
                        <DetailBox
                            img={followersImg}
                            title={'Followers'}
                            desc={
                                <span>
                                    The brokers that contain a replica of this station and in case of failure will replace the leader.{' '}
                                    <a href="https://docs.memphis.dev/memphis/memphis/concepts/station#leaders-and-followers" target="_blank">
                                        Learn more
                                    </a>
                                </span>
                            }
                            data={stationState?.stationSocketData?.followers}
                        />
                    )}

                    <DetailBox
                        img={idempotencyIcon}
                        title={'Idempotency'}
                        desc={
                            <span>
                                Ensures messages with the same "msg-id" value will be produced only once for the configured time.{' '}
                                <a href="https://docs.memphis.dev/memphis/memphis/concepts/idempotency" target="_blank">
                                    Learn more
                                </a>
                            </span>
                        }
                        data={[msToUnits(stationState?.stationSocketData?.idempotency_window_in_ms)]}
                    />
                </div>
            )}
            <Modal
                header={<img src={purgeWrapperIcon} alt="deleteWrapperIcon" />}
                width="460px"
                height="320px"
                displayButtons={false}
                clickOutside={() => modalPurgeFlip(false)}
                open={modalPurgeIsOpen}
            >
                <PurgeStationModal
                    title="Purge"
                    desc="This action will clean the station from messages."
                    handlePurgeSelected={(purgeData) => {
                        handlePurge(purgeData);
                        setPurgeData(purgeData);
                    }}
                    cancel={() => modalPurgeFlip(false)}
                    loader={loader}
                    msgsDisabled={stationState?.stationSocketData?.total_messages === 0}
                    dlsDisabled={stationState?.stationSocketData?.total_dls_messages === 0}
                />
            </Modal>
        </div>
    );
};

export default Messages;
