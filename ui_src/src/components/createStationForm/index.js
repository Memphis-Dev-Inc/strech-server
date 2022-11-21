// Credit for The NATS.IO Authors
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
import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import pathDomains from '../../router';

import { Form } from 'antd';
import TitleComponent from '../titleComponent';
import RadioButton from '../radioButton';
import Switcher from '../switcher';
import Input from '../Input';
import { convertDateToSeconds } from '../../services/valueConvertor';
import { ApiEndpoints } from '../../const/apiEndpoints';
import { httpRequest } from '../../services/http';

import InputNumberComponent from '../InputNumber';
import SelectComponent from '../select';
import SelectSchema from '../selectSchema';

const retanionOptions = [
    {
        id: 1,
        value: 'message_age_sec',
        label: 'Time'
    },
    {
        id: 2,
        value: 'bytes',
        label: 'Size'
    },
    {
        id: 3,
        value: 'messages',
        label: 'Messages'
    }
];

const storageOptions = [
    {
        id: 1,
        value: 'file',
        label: 'Disk'
    },
    {
        id: 2,
        value: 'memory',
        label: 'Memory'
    }
];

const CreateStationForm = ({ createStationFormRef, getStartedStateRef, finishUpdate, updateFormState, getStarted, setLoading }) => {
    const history = useHistory();
    const [creationForm] = Form.useForm();
    const [allowEdit, setAllowEdit] = useState(true);
    const [actualPods, setActualPods] = useState(null);
    const [retentionType, setRetentionType] = useState(retanionOptions[0].value);
    const [storageType, setStorageType] = useState(storageOptions[0].value);
    const [schemas, setSchemas] = useState([]);
    const [useSchema, setUseSchema] = useState(true);

    useEffect(() => {
        getOverviewData();
        getAllSchemas();
        if (getStarted && getStartedStateRef?.completedSteps > 0) setAllowEdit(false);
        if (getStarted && getStartedStateRef?.formFieldsCreateStation?.retention_type) setRetentionType(getStartedStateRef.formFieldsCreateStation.retention_type);
        createStationFormRef.current = onFinish;
    }, []);

    const getRetentionValue = (formFields) => {
        switch (formFields.retention_type) {
            case 'message_age_sec':
                return convertDateToSeconds(formFields.days, formFields.hours, formFields.minutes, formFields.seconds);
            case 'messages':
                return Number(formFields.retentionMessagesValue);
            case 'bytes':
                return Number(formFields.retentionValue);
        }
    };

    const onFinish = async () => {
        const formFields = await creationForm.validateFields();
        const retentionValue = getRetentionValue(formFields);
        const bodyRequest = {
            name: formFields.name,
            retention_type: formFields.retention_type,
            retention_value: retentionValue,
            storage_type: formFields.storage_type,
            replicas: formFields.replicas,
            schema_name: formFields.schemaValue
        };
        if ((getStarted && getStartedStateRef?.completedSteps === 0) || !getStarted) createStation(bodyRequest);
        else finishUpdate();
    };

    const getOverviewData = async () => {
        try {
            const data = await httpRequest('GET', ApiEndpoints.GET_MAIN_OVERVIEW_DATA);
            let indexOfBrokerComponent = data?.system_components.findIndex((item) => item.component.includes('broker'));
            indexOfBrokerComponent = indexOfBrokerComponent !== -1 ? indexOfBrokerComponent : 1;
            data?.system_components[indexOfBrokerComponent]?.actual_pods && setActualPods(data?.system_components[indexOfBrokerComponent]?.actual_pods);
        } catch (error) {}
    };

    const getAllSchemas = async () => {
        try {
            const data = await httpRequest('GET', ApiEndpoints.GET_ALL_SCHEMAS);
            setSchemas(data);
        } catch (error) {}
    };

    const createStation = async (bodyRequest) => {
        try {
            getStarted && setLoading(true);
            const data = await httpRequest('POST', ApiEndpoints.CREATE_STATION, bodyRequest);
            if (data) {
                if (!getStarted) history.push(`${pathDomains.stations}/${data.name}`);
                else finishUpdate(data);
            }
        } catch (error) {
        } finally {
            getStarted && setLoading(false);
        }
    };

    return (
        <Form name="form" form={creationForm} autoComplete="off" className="create-station-form-getstarted">
            <div id="e2e-getstarted-step1" className="station-name-section">
                <TitleComponent
                    headerTitle="Enter station name"
                    typeTitle="sub-header"
                    headerDescription="RabbitMQ has queues, Kafka has topics, and Memphis has stations"
                    required={true}
                ></TitleComponent>
                <Form.Item
                    name="name"
                    rules={[
                        {
                            required: true,
                            message: 'Please input station name!'
                        }
                    ]}
                    style={{ height: '50px' }}
                    initialValue={getStartedStateRef?.formFieldsCreateStation?.name}
                >
                    <Input
                        placeholder="Type station name"
                        type="text"
                        radiusType="semi-round"
                        colorType="black"
                        backgroundColorType="none"
                        borderColorType="gray"
                        width="450px"
                        height="40px"
                        onBlur={(e) => getStarted && updateFormState('name', e.target.value)}
                        onChange={(e) => getStarted && updateFormState('name', e.target.value)}
                        value={getStartedStateRef?.formFieldsCreateStation?.name}
                        disabled={!allowEdit}
                    />
                </Form.Item>
            </div>
            <div className="retention-type-section">
                <TitleComponent
                    headerTitle="Retention policy"
                    typeTitle="sub-header"
                    headerDescription={
                        <span>
                            By which criteria will messages be expelled from the station.&nbsp;
                            <a className="learn-more" href="https://docs.memphis.dev/memphis/memphis/concepts/station" target="_blank">
                                Learn More
                            </a>
                        </span>
                    }
                ></TitleComponent>
                <Form.Item name="retention_type" initialValue={getStarted ? getStartedStateRef?.formFieldsCreateStation?.retention_type : 'message_age_sec'}>
                    <RadioButton
                        className="radio-button"
                        options={retanionOptions}
                        radioValue={getStarted ? getStartedStateRef?.formFieldsCreateStation?.retention_type : retentionType}
                        optionType="button"
                        fontFamily="InterSemiBold"
                        style={{ marginRight: '20px', content: '' }}
                        onChange={(e) => {
                            setRetentionType(e.target.value);
                            if (getStarted) updateFormState('retention_type', e.target.value);
                        }}
                        disabled={!allowEdit}
                    />
                </Form.Item>
                {retentionType === 'message_age_sec' && (
                    <div className="time-value">
                        <div className="days-section">
                            <Form.Item name="days" initialValue={getStartedStateRef?.formFieldsCreateStation?.days || 7}>
                                <InputNumberComponent
                                    min={0}
                                    max={100}
                                    onChange={(e) => getStarted && updateFormState('days', e)}
                                    value={getStartedStateRef?.formFieldsCreateStation?.days}
                                    placeholder={getStartedStateRef?.formFieldsCreateStation?.days || 7}
                                    disabled={!allowEdit}
                                />
                            </Form.Item>
                            <p>days</p>
                        </div>
                        <p className="separator">:</p>
                        <div className="hours-section">
                            <Form.Item name="hours" initialValue={getStartedStateRef?.formFieldsCreateStation?.hours || 0}>
                                <InputNumberComponent
                                    min={0}
                                    max={24}
                                    onChange={(e) => getStarted && updateFormState('hours', e)}
                                    value={getStartedStateRef?.formFieldsCreateStation?.hours}
                                    placeholder={getStartedStateRef?.formFieldsCreateStation?.hours || 0}
                                    disabled={!allowEdit}
                                />
                            </Form.Item>
                            <p>hours</p>
                        </div>
                        <p className="separator">:</p>
                        <div className="minutes-section">
                            <Form.Item name="minutes" initialValue={getStartedStateRef?.formFieldsCreateStation?.minutes || 0}>
                                <InputNumberComponent
                                    min={0}
                                    max={60}
                                    onChange={(e) => getStarted && updateFormState('minutes', e)}
                                    value={getStartedStateRef?.formFieldsCreateStation?.minutes}
                                    placeholder={getStartedStateRef?.formFieldsCreateStation?.minutes || 0}
                                    disabled={!allowEdit}
                                />
                            </Form.Item>
                            <p>minutes</p>
                        </div>
                        <p className="separator">:</p>
                        <div className="seconds-section">
                            <Form.Item name="seconds" initialValue={getStartedStateRef?.formFieldsCreateStation?.seconds || 0}>
                                <InputNumberComponent
                                    min={0}
                                    max={60}
                                    onChange={(e) => getStarted && updateFormState('seconds', e)}
                                    placeholder={getStartedStateRef?.formFieldsCreateStation?.seconds || 0}
                                    value={getStartedStateRef?.formFieldsCreateStation?.seconds}
                                    disabled={!allowEdit}
                                />
                            </Form.Item>
                            <p>seconds</p>
                        </div>
                    </div>
                )}
                {retentionType === 'bytes' && (
                    <div className="retention-type">
                        <Form.Item name="retentionValue" initialValue={getStartedStateRef?.formFieldsCreateStation?.retentionSizeValue || 1000}>
                            <Input
                                placeholder="Type"
                                type="number"
                                radiusType="semi-round"
                                colorType="black"
                                backgroundColorType="none"
                                borderColorType="gray"
                                width="90px"
                                height="38px"
                                onBlur={(e) => getStarted && updateFormState('retentionSizeValue', e.target.value)}
                                onChange={(e) => getStarted && updateFormState('retentionSizeValue', e.target.value)}
                                value={getStartedStateRef?.formFieldsCreateStation?.retentionSizeValue}
                                disabled={!allowEdit}
                            />
                        </Form.Item>
                        <p>bytes</p>
                    </div>
                )}
                {retentionType === 'messages' && (
                    <div className="retention-type">
                        <Form.Item name="retentionMessagesValue" initialValue={getStartedStateRef?.formFieldsCreateStation?.retentionMessagesValue || 10}>
                            <Input
                                placeholder="Type"
                                type="number"
                                radiusType="semi-round"
                                colorType="black"
                                backgroundColorType="none"
                                borderColorType="gray"
                                width="90px"
                                height="38px"
                                onBlur={(e) => getStarted && updateFormState('retentionMessagesValue', e.target.value)}
                                onChange={(e) => getStarted && updateFormState('retentionMessagesValue', e.target.value)}
                                value={getStartedStateRef?.formFieldsCreateStation?.retentionMessagesValue}
                                disabled={!allowEdit}
                            />
                        </Form.Item>
                        <p>messages</p>
                    </div>
                )}
            </div>
            <div className="storage-replicas-container">
                <div className="storage-container">
                    <TitleComponent
                        headerTitle="Storage type"
                        typeTitle="sub-header"
                        headerDescription={
                            <span>
                                By which type of storage will the station be stored.&nbsp;
                                <a className="learn-more" href="https://docs.memphis.dev/memphis/memphis/concepts/storage-and-redundancy" target="_blank">
                                    Learn More
                                </a>
                            </span>
                        }
                    ></TitleComponent>
                    <Form.Item name="storage_type" initialValue={getStarted ? getStartedStateRef?.formFieldsCreateStation?.storage_type : 'file'}>
                        <RadioButton
                            options={storageOptions}
                            fontFamily="InterSemiBold"
                            radioValue={getStarted ? getStartedStateRef?.formFieldsCreateStation?.storage_type : storageType}
                            optionType="button"
                            onChange={(e) => {
                                setStorageType(e.target.value);
                                getStarted && updateFormState('storage_type', e.target.value);
                            }}
                            disabled={!allowEdit}
                        />
                    </Form.Item>
                </div>
                <div className="replicas-container">
                    <TitleComponent
                        headerTitle="Replicas"
                        typeTitle="sub-header"
                        headerDescription="Amount of mirrors per message"
                        style={{ description: { width: '240px' } }}
                    ></TitleComponent>
                    <div>
                        <Form.Item name="replicas" initialValue={getStarted ? getStartedStateRef?.formFieldsCreateStation?.replicas : 1}>
                            <InputNumberComponent
                                min={1}
                                max={actualPods && actualPods <= 5 ? actualPods : 5}
                                value={getStarted ? getStartedStateRef?.formFieldsCreateStation?.replicas : 1}
                                onChange={(e) => getStarted && updateFormState('replicas', e)}
                                disabled={!allowEdit}
                            />
                        </Form.Item>
                    </div>
                </div>
            </div>
            {!getStarted && (
                <div className="schema-type">
                    <Form.Item name="schemaValue">
                        <div className="toggle-add-schema">
                            <TitleComponent headerTitle="Attach schema" typeTitle="sub-header"></TitleComponent>
                            <Switcher onChange={() => setUseSchema(!useSchema)} checked={useSchema} disabled={schemas.length === 0} />
                        </div>
                        {!getStarted && schemas.length > 0 && useSchema && (
                            <SelectSchema
                                placeholder={creationForm.schemaValue || 'Select schema'}
                                value={creationForm.schemaValue}
                                options={schemas}
                                onChange={(e) => creationForm.setFieldsValue({ schemaValue: e })}
                            />
                        )}
                    </Form.Item>
                </div>
            )}
        </Form>
    );
};
export default CreateStationForm;
