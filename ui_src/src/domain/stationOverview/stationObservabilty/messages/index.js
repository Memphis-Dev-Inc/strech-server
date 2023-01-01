// Copyright 2021-2022 The Memphis Authors
// Licensed under the Apache License, Version 2.0 (the “License”);
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an “AS IS” BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.package server

import './style.scss';

import React, { useContext, useEffect, useState } from 'react';
import { InfoOutlined } from '@material-ui/icons';
import { message } from 'antd';

import { msToUnits, numberWithCommas } from '../../../../services/valueConvertor';
import deadLetterPlaceholder from '../../../../assets/images/deadLetterPlaceholder.svg';
import waitingMessages from '../../../../assets/images/waitingMessages.svg';
import idempotencyIcon from '../../../../assets/images/idempotencyIcon.svg';
import dlsEnableIcon from '../../../../assets/images/dls_enable_icon.svg';
import followersImg from '../../../../assets/images/followersDetails.svg';
import leaderImg from '../../../../assets/images/leaderDetails.svg';
import CheckboxComponent from '../../../../components/checkBox';
import { ApiEndpoints } from '../../../../const/apiEndpoints';
import DetailBox from '../../../../components/detailBox';
import DlsConfig from '../../../../components/dlsConfig';
import { httpRequest } from '../../../../services/http';
import CustomTabs from '../../../../components/Tabs';
import Button from '../../../../components/button';
import { StationStoreContext } from '../..';
import pathDomains from '../../../../router';
import MessageDetails from '../components/messageDetails';

const Messages = () => {
    const [stationState, stationDispatch] = useContext(StationStoreContext);
    const [selectedRowIndex, setSelectedRowIndex] = useState(null);
    const [resendProcced, setResendProcced] = useState(false);
    const [ignoreProcced, setIgnoreProcced] = useState(false);
    const [indeterminate, setIndeterminate] = useState(false);
    const [userScrolled, setUserScrolled] = useState(false);
    const [subTabValue, setSubTabValue] = useState('Poison');
    const [isCheckAll, setIsCheckAll] = useState(false);
    const [tabValue, setTabValue] = useState('All');
    const [isCheck, setIsCheck] = useState([]);
    const tabs = ['All', 'Dead-letter', 'Details'];
    const subTabs = ['Poison', 'Failed schema'];
    const url = window.location.href;
    const stationName = url.split('stations/')[1];

    const onSelectedRow = (messageSeq, id) => {
        setUserScrolled(false);
        setSelectedRowIndex(messageSeq);
        stationDispatch({ type: 'SET_SELECTED_ROW_ID', payload: { seq: messageSeq, id: id } });
        const element = document.getElementById(messageSeq);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    };

    const onCheckedAll = () => {
        setIsCheckAll(!isCheckAll);
        subTabValue === 'Poison'
            ? setIsCheck(stationState?.stationSocketData?.poison_messages.map((li) => li._id))
            : setIsCheck(stationState?.stationSocketData?.schema_failed_messages.map((li) => li._id));
        setIndeterminate(false);
        if (isCheckAll) {
            setIsCheck([]);
        }
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
        if (subTabValue === 'Poison') {
            setIsCheckAll(checkedList.length === stationState?.stationSocketData?.poison_messages?.length);
            setIndeterminate(!!checkedList.length && checkedList.length < stationState?.stationSocketData?.poison_messages?.length);
        } else {
            setIsCheckAll(checkedList.length === stationState?.stationSocketData?.schema_failed_messages?.length);
            setIndeterminate(!!checkedList.length && checkedList.length < stationState?.stationSocketData?.schema_failed_messages?.length);
        }
    };

    const handleChangeMenuItem = (newValue) => {
        stationDispatch({ type: 'SET_SELECTED_ROW_ID', payload: null });
        setSelectedRowIndex(null);
        setTabValue(newValue);
        subTabValue === 'Failed schema' && setSubTabValue('Poison');
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
        setIsCheckAll(false);
        stationDispatch({ type: 'SET_DLS_TYPE', payload: newValue });
    };

    const handleDrop = async () => {
        setIgnoreProcced(true);
        const isCheckLength = isCheck.length;
        try {
            await httpRequest('POST', `${ApiEndpoints.DROP_DLS_MESSAGE}`, { dls_type: subTabValue === 'Poison' ? 'poison' : 'schema', dls_message_ids: isCheck });
            let messages = subTabValue === 'Poison' ? stationState?.stationSocketData?.poison_messages : stationState?.stationSocketData?.schema_failed_messages;
            isCheck.map((messageId, index) => {
                messages = messages?.filter((item) => {
                    return item._id !== messageId;
                });
            });
            setTimeout(() => {
                setIgnoreProcced(false);
                subTabValue === 'Poison'
                    ? stationDispatch({ type: 'SET_POISON_MESSAGES', payload: messages })
                    : stationDispatch({ type: 'SET_FAILED_MESSAGES', payload: messages });
                stationDispatch({ type: 'REDUCE_COUNTER', payload: isCheckLength });
                setIsCheck([]);
                setIsCheckAll(false);
                setIndeterminate(false);
            }, 1500);
        } catch (error) {
            setIgnoreProcced(false);
        }
    };

    const handleResend = async () => {
        setResendProcced(true);
        try {
            await httpRequest('POST', `${ApiEndpoints.RESEND_POISON_MESSAGE_JOURNEY}`, { poison_message_ids: isCheck });
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
                setIsCheckAll(false);
            }, 1500);
        } catch (error) {
            setResendProcced(false);
        }
    };

    const handleScroll = () => {
        setUserScrolled(true);
    };

    const listGenerator = (message) => {
        const messageSeq = tabValue === 'Dead-letter' ? message?._id : message?.message_seq;
        const id = tabValue === 'Dead-letter' ? message?._id : null;
        return (
            <div
                className={selectedRowIndex === messageSeq ? 'row-message selected' : 'row-message'}
                key={messageSeq}
                id={messageSeq}
                onClick={() => onSelectedRow(messageSeq, id)}
            >
                {selectedRowIndex === messageSeq && <div className="hr-selected"></div>}
                {tabValue === 'Dead-letter' && (
                    <CheckboxComponent checked={isCheck.includes(messageSeq)} id={messageSeq} onChange={handleCheckedClick} name={messageSeq} />
                )}
                <span className="preview-message">{tabValue === 'Dead-letter' ? message?.message?.data : message?.data}</span>
            </div>
        );
    };

    const listGeneratorWrapper = () => {
        let isDls = tabValue === 'Dead-letter';
        return (
            <div className={isDls ? 'list-wrapper dls-list' : 'list-wrapper msg-list'}>
                <div className="coulmns-table">
                    <div className={isDls ? 'left-coulmn' : 'left-coulmn all'}>
                        {tabValue === 'Dead-letter' && (
                            <CheckboxComponent indeterminate={indeterminate} checked={isCheckAll} id={'selectAll'} onChange={onCheckedAll} name={'selectAll'} />
                        )}
                        <p>Messages</p>
                    </div>
                    <p className="right-coulmn">Details</p>
                </div>
                <div className="list">
                    <div className={isDls ? 'rows-wrapper' : 'rows-wrapper all'} onScroll={() => handleScroll()}>
                        {!isDls
                            ? stationState?.stationSocketData?.messages?.map((message) => {
                                  return listGenerator(message);
                              })
                            : subTabValue === 'Poison'
                            ? stationState?.stationSocketData?.poison_messages?.map((message, id) => {
                                  return listGenerator(message);
                              })
                            : subTabValue === 'Failed schema' &&
                              stationState?.stationSocketData?.schema_failed_messages?.map((message, id) => {
                                  return listGenerator(message);
                              })}
                    </div>
                    <MessageDetails isDls={isDls} isFailedSchemaMessage={subTabValue === 'Failed schema'} />
                </div>
            </div>
        );
    };

    const showLastMsg = () => {
        let amount = 0;
        if (tabValue === 'All' && stationState?.stationSocketData?.messages?.length > 0) amount = stationState?.stationSocketData?.messages?.length;
        else if (tabValue === 'Dead-letter' && subTabValue === 'Poison' && stationState?.stationSocketData?.poison_messages?.length > 0)
            amount = stationState?.stationSocketData?.poison_messages?.length;
        else if (tabValue === 'Dead-letter' && subTabValue === 'Failed schema' && stationState?.stationSocketData?.schema_failed_messages?.length > 0)
            amount = stationState?.stationSocketData?.schema_failed_messages?.length;
        return (
            amount > 0 && (
                <div className="messages-amount">
                    <InfoOutlined />
                    <p>
                        Showing last {numberWithCommas(amount)} out of{' '}
                        {tabValue === 'All'
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
                {tabValue === 'Dead-letter' &&
                    (stationState?.stationSocketData?.poison_messages?.length > 0 || stationState?.stationSocketData?.schema_failed_messages?.length > 0) && (
                        <div className="right-side">
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
                            {subTabValue === 'Poison' && (
                                <Button
                                    width="100px"
                                    height="32px"
                                    placeholder="Resend"
                                    colorType="white"
                                    radiusType="circle"
                                    backgroundColorType="purple"
                                    fontSize="12px"
                                    fontWeight="600"
                                    disabled={isCheck.length === 0 || !stationState?.stationMetaData?.is_native}
                                    tooltip={!stationState?.stationMetaData?.is_native && 'Not supported without using the native Memphis SDK’s'}
                                    isLoading={resendProcced}
                                    onClick={() => handleResend()}
                                />
                            )}
                        </div>
                    )}
            </div>
            <div className="tabs">
                <CustomTabs
                    value={tabValue}
                    onChange={handleChangeMenuItem}
                    tabs={tabs}
                    length={[null, stationState?.stationSocketData?.total_dls_messages || null]}
                ></CustomTabs>
            </div>
            {tabValue === 'Dead-letter' && (
                <div className="tabs">
                    <CustomTabs defaultValue value={subTabValue} onChange={handleChangeSubMenuItem} tabs={subTabs}></CustomTabs>
                </div>
            )}
            {tabValue === 'All' && stationState?.stationSocketData?.messages?.length > 0 && listGeneratorWrapper()}
            {tabValue === 'Dead-letter' && subTabValue === 'Poison' && stationState?.stationSocketData?.poison_messages?.length > 0 && listGeneratorWrapper()}
            {tabValue === 'Dead-letter' &&
                subTabValue === 'Failed schema' &&
                stationState?.stationSocketData?.schema_failed_messages?.length > 0 &&
                listGeneratorWrapper()}

            {tabValue === 'All' && stationState?.stationSocketData?.messages === null && (
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
            {tabValue === 'Dead-letter' &&
                ((subTabValue === 'Poison' && stationState?.stationSocketData?.poison_messages?.length === 0) ||
                    (subTabValue === 'Failed schema' && stationState?.stationSocketData?.schema_failed_messages?.length === 0)) && (
                    <div className="waiting-placeholder msg-plc">
                        <img width={100} src={deadLetterPlaceholder} alt="waitingMessages" />
                        <p>Hooray! No messages</p>
                    </div>
                )}
            {tabValue === 'Details' && (
                <div className="details">
                    <DetailBox
                        img={leaderImg}
                        title={'Leader'}
                        desc={
                            <span>
                                The current leader of this station.{' '}
                                <a href="https://docs.memphis.dev/memphis/memphis/concepts/station#leaders-and-followers" target="_blank">
                                    Learn More
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
                                        Learn More
                                    </a>
                                </span>
                            }
                            data={stationState?.stationSocketData?.followers}
                        />
                    )}
                    <DetailBox img={dlsEnableIcon} title={'DLS configuration'} desc="By which event, messages will be stored in the dead-letter station.">
                        <DlsConfig />
                    </DetailBox>
                    <DetailBox
                        img={idempotencyIcon}
                        title={'Idempotency'}
                        desc={
                            <span>
                                Ensures messages will be produced once.{' '}
                                <a href="https://docs.memphis.dev/memphis/memphis/concepts/idempotency" target="_blank">
                                    Learn More
                                </a>
                            </span>
                        }
                        data={[msToUnits(stationState?.stationSocketData?.idempotency_window_in_ms)]}
                    />
                </div>
            )}
        </div>
    );
};

export default Messages;
