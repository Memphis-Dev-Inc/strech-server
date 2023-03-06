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
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { Form } from 'antd';

import { convertDateToSeconds, generateName, idempotencyValidator } from '../../services/valueConvertor';
import { ApiEndpoints } from '../../const/apiEndpoints';
import { httpRequest } from '../../services/http';
import InputNumberComponent from '../InputNumber';
import TitleComponent from '../titleComponent';
import SelectSchema from '../selectSchema';
import RadioButton from '../radioButton';
import SelectComponent from '../select';
import pathDomains from '../../router';
import Switcher from '../switcher';
import CustomTabs from '../Tabs';
import Button from '../button';
import Input from '../Input';
import OverflowTip from '../tooltip/overflowtip';
import Modal from '../modal';
import S3Integration from '../../domain/administration/integrations/components/s3Integration';

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
const storageTierOneOptions = [
    {
        id: 1,
        value: 'file',
        label: 'Disk',
        desc: 'Disk is perfect for higher availability and lower cost'
    },
    {
        id: 2,
        value: 'memory',
        label: 'Memory',
        desc: 'Memory can boost your performance. Lower availability'
    }
];
const storageTierTwoOptions = [
    {
        id: 1,
        value: 's3',
        label: 'S3',
        desc: 'Use object storage as a 2nd tier storage for archiving and post-stream analysis'
    }
];

const idempotencyOptions = ['Milliseconds', 'Seconds', 'Minutes', 'Hours'];

const CreateStationForm = ({ createStationFormRef, getStartedStateRef, finishUpdate, updateFormState, getStarted, setLoading }) => {
    const history = useHistory();
    const [creationForm] = Form.useForm();
    const [allowEdit, setAllowEdit] = useState(true);
    const [actualPods, setActualPods] = useState(['1']);
    const [retentionType, setRetentionType] = useState(retanionOptions[0].value);
    const [idempotencyType, setIdempotencyType] = useState(idempotencyOptions[2]);
    const [schemas, setSchemas] = useState([]);
    const [useSchema, setUseSchema] = useState(false);
    const [dlsConfiguration, setDlsConfiguration] = useState(true);
    const [tabValue, setTabValue] = useState('Local storage tier');
    const [selectedOption, setSelectedOption] = useState(getStartedStateRef?.formFieldsCreateStation?.storage_type || 'file');
    const [selectedTier2Option, setSelectedTier2Option] = useState(getStartedStateRef?.formFieldsCreateStation?.tiered_storage_enabled || false);
    const [parserName, setParserName] = useState('');
    const [integrateValue, setIntegrateValue] = useState(null);
    const [modalIsOpen, modalFlip] = useState(false);
    const [dedupEnabled, setDedupEnabled] = useState(true);
    const tabs = [
        { name: 'Local storage tier', checked: true },
        { name: 'Remote storage tier', checked: selectedTier2Option || false }
    ];
    useEffect(() => {
        getAvailableReplicas();
        getAllSchemas();
        getIntegration();
        if (getStarted && getStartedStateRef?.completedSteps > 0) setAllowEdit(false);
        if (getStarted && getStartedStateRef?.formFieldsCreateStation?.retention_type) setRetentionType(getStartedStateRef.formFieldsCreateStation.retention_type);
        createStationFormRef.current = onFinish;
    }, []);

    const getRetentionValue = (formFields) => {
        switch (formFields.retention_type || retentionType) {
            case 'message_age_sec':
                return convertDateToSeconds(formFields.days, formFields.hours, formFields.minutes, formFields.seconds);
            case 'messages':
                return Number(formFields.retentionMessagesValue);
            case 'bytes':
                return Number(formFields.retentionValue);
        }
    };

    const getIdempotencyValue = (formFields) => {
        switch (formFields.idempotency_type) {
            case 'Milliseconds':
                return Number(formFields.idempotency_number);
            case 'Seconds':
                return formFields.idempotency_number * 1000;
            case 'Minutes':
                return formFields.idempotency_number * 60000;
            case 'Hours':
                return formFields.idempotency_number * 3600000;
        }
    };

    const getDedupEnabledValue = (formFields) => {
        return formFields.dedup_configuration;
    };

    const onFinish = async () => {
        const formFields = await creationForm.validateFields();
        const retentionValue = getRetentionValue(formFields);
        const idempotencyValue = getIdempotencyValue(formFields);
        const dedupEnabledValue = getDedupEnabledValue(formFields);
        const bodyRequest = {
            name: generateName(formFields.station_name),
            retention_type: formFields.retention_type || retentionType,
            retention_value: retentionValue,
            storage_type: formFields.storage_type,
            replicas: Number(formFields.replicas),
            schema_name: formFields.schemaValue,
            tiered_storage_enabled: formFields.tiered_storage_enabled,
            idempotency_window_in_ms: idempotencyValue,
            dedup_configuration: dedupEnabledValue,
            dls_configuration: {
                poison: dlsConfiguration,
                schemaverse: dlsConfiguration
            }
        };
        if ((getStarted && getStartedStateRef?.completedSteps === 0) || !getStarted) createStation(bodyRequest);
        else finishUpdate();
    };

    const getAvailableReplicas = async () => {
        try {
            const data = await httpRequest('GET', ApiEndpoints.GET_AVAILABLE_REPLICAS);
            setActualPods(Array.from({ length: data?.available_replicas }, (_, i) => i + 1));
        } catch (error) {}
    };

    const getAllSchemas = async () => {
        try {
            const data = await httpRequest('GET', ApiEndpoints.GET_ALL_SCHEMAS);
            setSchemas(data);
        } catch (error) {}
    };

    const getIntegration = async () => {
        try {
            const data = await httpRequest('GET', `${ApiEndpoints.GET_INTEGRATION_DETAILS}?name=s3`);
            setIntegrateValue(data);
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

    const stationNameChange = (e) => {
        let generatedName = generateName(e.target.value);
        getStarted && updateFormState('name', generatedName);
        if (parserName === '') {
            setTimeout(() => {
                setParserName(generatedName);
            }, 100);
        } else {
            setParserName(generatedName);
        }
    };

    const SelectedLocalStorageOption = (value) => {
        if (allowEdit) {
            setSelectedOption(value);
            creationForm.setFieldValue('storage_type', value);
            if (getStarted) updateFormState('storage_type', value);
        }
    };
    const SelectedRemoteStorageOption = (value, enabled) => {
        if (allowEdit) {
            setSelectedTier2Option(value);
            creationForm.setFieldValue('tiered_storage_enabled', enabled);
            if (getStarted) updateFormState('tiered_storage_enabled', enabled);
        }
    };

    return (
        <Form name="form" form={creationForm} autoComplete="off" className={'create-station-form-getstarted'}>
            <div className={getStarted ? 'left-side left-gs' : 'left-side'}>
                <div className="station-name-section">
                    <TitleComponent
                        headerTitle="Enter station name"
                        typeTitle="sub-header"
                        headerDescription="RabbitMQ has queues, Kafka has topics, and Memphis has stations"
                        required={true}
                    />
                    <Form.Item
                        name="station_name"
                        rules={[
                            {
                                validator: (_, value) => {
                                    return new Promise((resolve, reject) => {
                                        if (value === '' || value === undefined) {
                                            setTimeout(() => {
                                                return reject('Please input station name!');
                                            }, 100);
                                        } else {
                                            return resolve();
                                        }
                                    });
                                }
                            }
                        ]}
                        style={{ height: '50px' }}
                        initialValue={getStartedStateRef?.formFieldsCreateStation?.name}
                    >
                        <Input
                            placeholder="Type station name"
                            type="text"
                            maxLength="128"
                            radiusType="semi-round"
                            colorType="black"
                            backgroundColorType="none"
                            borderColorType="gray"
                            height="40px"
                            onBlur={(e) => stationNameChange(e)}
                            onChange={(e) => stationNameChange(e)}
                            value={getStartedStateRef?.formFieldsCreateStation?.name}
                            disabled={!allowEdit}
                        />
                    </Form.Item>
                    {parserName !== '' && (
                        <div className="name-and-hint">
                            <OverflowTip text={`station name: ${parserName}`} maxWidth="400px">
                                station name: {parserName}
                            </OverflowTip>
                        </div>
                    )}
                </div>
                <div className="replicas-container">
                    <TitleComponent
                        headerTitle="Replicas"
                        typeTitle="sub-header"
                        headerDescription="Amount of mirrors per message."
                        learnMore={true}
                        link="https://docs.memphis.dev/memphis/memphis/concepts/station#replicas-mirroring"
                    />
                    <div>
                        <Form.Item name="replicas" initialValue={getStartedStateRef?.formFieldsCreateStation?.replicas || actualPods[0]} style={{ height: '50px' }}>
                            <SelectComponent
                                colorType="black"
                                backgroundColorType="none"
                                borderColorType="gray"
                                radiusType="semi-round"
                                height="40px"
                                popupClassName="select-options"
                                options={actualPods}
                                value={getStartedStateRef?.formFieldsCreateStation?.replicas || actualPods[0]}
                                onChange={(e) => getStarted && updateFormState('replicas', e)}
                                disabled={!allowEdit}
                            />
                        </Form.Item>
                    </div>
                </div>
                <div className="idempotency-type">
                    <Form.Item name="idempotency">
                        <div>
                            <TitleComponent
                                headerTitle="Idempotency"
                                typeTitle="sub-header"
                                headerDescription={
                                    <span>
                                        Ensures producers will not produce the same message.&nbsp;
                                        <a className="learn-more" href="https://docs.memphis.dev/memphis/memphis/concepts/idempotency" target="_blank">
                                            Learn more
                                        </a>
                                    </span>
                                }
                            />
                        </div>
                        <div className="idempotency-value">
                            <Form.Item
                                name="idempotency_number"
                                initialValue={getStartedStateRef?.formFieldsCreateStation?.idempotency_number || 2}
                                rules={[
                                    {
                                        validator: (_, value) => {
                                            return idempotencyValidator(value, idempotencyType);
                                        }
                                    }
                                ]}
                                style={{ height: '10px' }}
                            >
                                <Input
                                    placeholder="Type"
                                    type="number"
                                    radiusType="semi-round"
                                    colorType="black"
                                    backgroundColorType="none"
                                    borderColorType="gray"
                                    height="40px"
                                    onBlur={(e) => getStarted && updateFormState('idempotency_number', e.target.value)}
                                    onChange={(e) => getStarted && updateFormState('idempotency_number', e.target.value)}
                                    value={getStartedStateRef?.formFieldsCreateStation?.idempotency_number}
                                    disabled={!allowEdit}
                                />
                            </Form.Item>
                            <Form.Item name="idempotency_type" initialValue={getStartedStateRef?.formFieldsCreateStation?.idempotency_type || idempotencyOptions[2]}>
                                <SelectComponent
                                    colorType="black"
                                    backgroundColorType="none"
                                    fontFamily="Inter"
                                    borderColorType="gray"
                                    radiusType="semi-round"
                                    height="40px"
                                    popupClassName="select-options"
                                    options={idempotencyOptions}
                                    value={getStarted ? getStartedStateRef?.formFieldsCreateStation?.idempotency_type : idempotencyOptions[2]}
                                    onChange={(e) => {
                                        setIdempotencyType(e);
                                        if (getStarted) updateFormState('idempotency_type', e);
                                    }}
                                    disabled={!allowEdit}
                                />
                            </Form.Item>
                        </div>
                    </Form.Item>
                </div>
                {!getStarted && (
                    <div className="schema-type">
                        <div className="toggle-add-schema">
                            <TitleComponent headerTitle="Attach schema" typeTitle="sub-header" headerDescription="Enforcing schema will increase produced data quality" />
                            <Switcher onChange={() => setUseSchema(!useSchema)} checked={useSchema} />
                        </div>
                        {!getStarted && useSchema && (
                            <Form.Item name="schemaValue" initialValue={schemas?.length > 0 ? schemas[0]?.name : null}>
                                <SelectSchema
                                    placeholder={creationForm.schemaValue || 'Select schema'}
                                    value={creationForm.schemaValue || schemas[0]}
                                    options={schemas}
                                    onChange={(e) => creationForm.setFieldsValue({ schemaValue: e })}
                                />
                            </Form.Item>
                        )}
                    </div>
                )}
                <div className="toggle-add-schema">
                    <TitleComponent
                        headerTitle="Dead-letter station"
                        typeTitle="sub-header"
                        headerDescription="Dead-letter stations are useful for debugging your application"
                    />
                    <Switcher onChange={() => setDlsConfiguration(!dlsConfiguration)} checked={dlsConfiguration} />
                </div>
                <div className="toggle-add-schema">
                    <TitleComponent
                        headerTitle="Deduplication"
                        typeTitle="sub-header"
                        headerDescription="Deduplication drops redundant messages with same message payload and header"
                    />
                    <Form.Item name="dedup_configuration" initialValue={true}>
                        <Switcher onChange={() => setDedupEnabled(!dedupEnabled)} checked={dedupEnabled} />
                    </Form.Item>
                </div>
            </div>
            <div className="right-side">
                <TitleComponent headerTitle="Retention policy" typeTitle="sub-header" />
                <div className="retention-storage-box">
                    <div className="header">
                        <CustomTabs value={tabValue} onChange={(tabValue) => setTabValue(tabValue)} tabs={tabs} checkbox={true} />
                    </div>
                    <div className="content">
                        {tabValue === tabs[0].name && (
                            <p className="description">
                                The criteria for which messages will be expelled from the station.&nbsp;
                                <a className="learn-more" href="https://docs.memphis.dev/memphis/memphis/concepts/station#retention" target="_blank">
                                    Learn more
                                </a>
                            </p>
                        )}
                        {tabValue === tabs[1].name && (
                            <p className="description">
                                *Optional* For archiving and higher retention of ingested data. <br />
                                Once a message passes the 1st storage tier, it will automatically be migrated to the 2nd storage tier, if defined.&nbsp;
                            </p>
                        )}
                        <div className="retention-type-section" style={{ display: tabValue === tabs[0].name ? 'block' : 'none' }}>
                            <Form.Item name="retention_type" initialValue={getStarted ? getStartedStateRef?.formFieldsCreateStation?.retention_type : retentionType}>
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
                                                max={1000}
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
                        <div className="storage-container">
                            <TitleComponent
                                headerTitle="Storage type"
                                typeTitle="sub-header"
                                headerDescription={
                                    tabValue === tabs[0].name ? (
                                        <span>
                                            Type of storage for short retention.&nbsp;
                                            <a
                                                className="learn-more"
                                                href="https://docs.memphis.dev/memphis/memphis/concepts/storage-and-redundancy#tier-1-hot-storage"
                                                target="_blank"
                                            >
                                                Learn more
                                            </a>
                                        </span>
                                    ) : (
                                        <span>
                                            Type of storage for long retention.&nbsp;
                                            <a
                                                className="learn-more"
                                                href="https://docs.memphis.dev/memphis/memphis/concepts/storage-and-redundancy#tier-2-cold-storage"
                                                target="_blank"
                                            >
                                                Learn more
                                            </a>
                                        </span>
                                    )
                                }
                            />
                            <Form.Item
                                name="storage_type"
                                initialValue={getStarted ? getStartedStateRef?.formFieldsCreateStation?.storage_type : 'file'}
                                style={{ display: tabValue === tabs[0].name ? 'block' : 'none' }}
                            >
                                {tabValue === tabs[0].name &&
                                    storageTierOneOptions.map((value) => {
                                        return (
                                            <div
                                                key={value.id}
                                                className={
                                                    selectedOption === value.value
                                                        ? 'option-wrapper selected'
                                                        : allowEdit
                                                        ? 'option-wrapper allowed'
                                                        : 'option-wrapper not-allowed'
                                                }
                                                onClick={() => SelectedLocalStorageOption(value.value)}
                                            >
                                                <div className="check-and-content">
                                                    {selectedOption === value.value && <CheckCircleIcon className="check-icon" />}
                                                    {selectedOption !== value.value && <div className="uncheck-icon" />}
                                                    <div className="option-content">
                                                        <p>{value.label}</p>
                                                        <span>{value.desc}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </Form.Item>
                            <Form.Item
                                name="tiered_storage_enabled"
                                initialValue={getStarted ? getStartedStateRef?.formFieldsCreateStation?.tiered_storage_enabled : false}
                                style={{ display: tabValue === tabs[1].name ? 'block' : 'none' }}
                            >
                                {tabValue === tabs[1].name &&
                                    storageTierTwoOptions.map((value) => {
                                        return (
                                            <div
                                                key={value.id}
                                                className={
                                                    selectedTier2Option ? 'option-wrapper selected' : allowEdit ? 'option-wrapper allowed' : 'option-wrapper not-allowed'
                                                }
                                                onClick={() =>
                                                    integrateValue && allowEdit
                                                        ? selectedTier2Option
                                                            ? SelectedRemoteStorageOption(false, false)
                                                            : SelectedRemoteStorageOption(true, true)
                                                        : modalFlip(true)
                                                }
                                            >
                                                <div className="check-and-content">
                                                    {selectedTier2Option ? <CheckCircleIcon className="check-icon" /> : <div className="uncheck-icon" />}
                                                    <div className="option-content">
                                                        <p>{value.label}</p>
                                                        <span>{value.desc}</span>
                                                    </div>
                                                </div>
                                                <Button
                                                    width="90px"
                                                    height="30px"
                                                    placeholder={integrateValue ? (selectedTier2Option ? 'Disable' : 'Enable') : 'Connect'}
                                                    colorType="white"
                                                    border="none"
                                                    radiusType="circle"
                                                    backgroundColorType="purple"
                                                    fontSize="12px"
                                                    fontWeight="bold"
                                                    boxShadowStyle="none"
                                                    disabled={!allowEdit}
                                                    onClick={() => null}
                                                />
                                            </div>
                                        );
                                    })}
                            </Form.Item>
                        </div>
                    </div>
                </div>
            </div>
            <Modal className="integration-modal" height="95vh" width="720px" displayButtons={false} clickOutside={() => modalFlip(false)} open={modalIsOpen}>
                <S3Integration
                    close={(data) => {
                        modalFlip(false);
                        setIntegrateValue(data);
                    }}
                    value={integrateValue}
                />
            </Modal>
        </Form>
    );
};
export default CreateStationForm;
