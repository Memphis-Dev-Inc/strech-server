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
import { Form } from 'antd';

import Input from '../../../components/Input';
import RadioButton from '../../../components/radioButton';
import { httpRequest } from '../../../services/http';
import { ApiEndpoints } from '../../../const/apiEndpoints';
import SelectCheckBox from '../../../components/selectCheckBox';
import { generator } from '../../../services/generator';
import { LOCAL_STORAGE_USER_PASS_BASED_AUTH } from '../../../const/localStorageConsts';
import { isCloud } from '../../../services/valueConvertor';

const CreateUserDetails = ({ createUserRef, closeModal, handleLoader }) => {
    const [creationForm] = Form.useForm();
    const [formFields, setFormFields] = useState({
        username: '',
        password: ''
    });
    const [userType, setUserType] = useState('management');
    const [passwordType, setPasswordType] = useState(0);

    const userTypeOptions = [
        {
            id: 1,
            value: 'management',
            label: 'Management',
            desc: 'For management and console access',
            disabled: false
        },
        {
            id: 2,
            value: 'application',
            label: 'Client',
            desc: 'For client-based authentication with the broker',
            disabled: false
        }
    ];
    const passwordOptions = [
        {
            id: 1,
            value: 0,
            label: 'Auto-Generated'
        },
        {
            id: 2,
            value: 1,
            label: 'Custom'
        }
    ];
    const [generatedPassword, setGeneratedPassword] = useState('');

    useEffect(() => {
        createUserRef.current = onFinish;
        generateNewPassword();
    }, []);

    const passwordTypeChange = (e) => {
        setPasswordType(e.target.value);
    };

    const updateFormState = (field, value) => {
        let updatedValue = { ...formFields };
        updatedValue[field] = value;
        setFormFields((formFields) => ({ ...formFields, ...updatedValue }));
    };

    const onFinish = async () => {
        try {
            const fieldsValue = await creationForm.validateFields();
            if (fieldsValue?.errorFields) {
                handleLoader(false);
                return;
            } else {
                if (fieldsValue?.passwordType === 0 ?? passwordType === 0) {
                    fieldsValue['password'] = fieldsValue['generatedPassword'];
                }
                try {
                    const bodyRequest = fieldsValue;
                    const data = await httpRequest('POST', ApiEndpoints.ADD_USER, bodyRequest);
                    if (data) {
                        closeModal(data);
                    }
                } catch (error) {
                    handleLoader(false);
                }
            }
        } catch (error) {
            handleLoader(false);
        }
    };

    const generateNewPassword = () => {
        const newPassword = generator();
        setGeneratedPassword(newPassword);
        creationForm.setFieldsValue({ ['generatedPassword']: newPassword });
    };

    const handleUserTypeChanged = (value) => {
        setUserType(value);
        creationForm.setFieldValue('user_type', value);
    };

    return (
        <div className="create-user-form">
            <Form name="form" form={creationForm} autoComplete="off" onFinish={onFinish}>
                <div className="field user-type">
                    <Form.Item name="user_type" initialValue={userType}>
                        <SelectCheckBox selectOptions={userTypeOptions} handleOnClick={(e) => handleUserTypeChanged(e.value)} selectedOption={userType} />
                    </Form.Item>
                </div>
                <div className="user-details">
                    <p className="fields-title">User details</p>
                    <Form.Item
                        name="username"
                        rules={[
                            {
                                required: true,
                                message: userType === 'management' && isCloud() ? 'Please input email!' : 'Please input username!'
                            },
                            {
                                message:
                                    userType === 'management' && isCloud() ? 'Please enter a valid email address!' : 'Username has to include only letters/numbers and .',
                                pattern: userType === 'management' && isCloud() ? /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,})+$/ : /^[a-zA-Z0-9_.]*$/
                            }
                        ]}
                    >
                        <div className="field username">
                            <p className="field-title">{userType === 'management' && isCloud() ? 'Email*' : 'Username*'}</p>
                            <Input
                                placeholder={userType === 'management' && isCloud() ? 'Type email' : 'Type username'}
                                type="text"
                                radiusType="semi-round"
                                maxLength={20}
                                colorType="black"
                                backgroundColorType="none"
                                borderColorType="gray"
                                height="40px"
                                fontSize="12px"
                                onBlur={(e) => updateFormState('username', e.target.value)}
                                onChange={(e) => updateFormState('username', e.target.value)}
                                value={formFields.name}
                            />
                        </div>
                    </Form.Item>
                    {userType === 'management' && (
                        <>
                            <Form.Item
                                name="full_name"
                                rules={[
                                    {
                                        required: isCloud() ? true : false,
                                        message: 'Please input full name!'
                                    },
                                    {
                                        message: 'Please enter a valid full name!',
                                        pattern: /^[A-Za-z\s]+$/i
                                    }
                                ]}
                            >
                                <div className="field fullname">
                                    <p className="field-title">{isCloud() ? 'Full name*' : 'Full name'}</p>
                                    <Input
                                        placeholder="Type full name"
                                        type="text"
                                        maxLength={30}
                                        radiusType="semi-round"
                                        colorType="black"
                                        backgroundColorType="none"
                                        borderColorType="gray"
                                        height="40px"
                                        fontSize="12px"
                                        onBlur={(e) => updateFormState('full_name', e.target.value)}
                                        onChange={(e) => updateFormState('full_name', e.target.value)}
                                        value={formFields.full_name}
                                    />
                                </div>
                            </Form.Item>
                            <div className="flex-row">
                                <Form.Item name="team">
                                    <div className="field team">
                                        <p className="field-title">Team</p>
                                        <Input
                                            placeholder="Type your team"
                                            type="text"
                                            maxLength={20}
                                            radiusType="semi-round"
                                            colorType="black"
                                            backgroundColorType="none"
                                            borderColorType="gray"
                                            height="40px"
                                            fontSize="12px"
                                            onBlur={(e) => updateFormState('team', e.target.value)}
                                            onChange={(e) => updateFormState('team', e.target.value)}
                                            value={formFields.team}
                                        />
                                    </div>
                                </Form.Item>
                                <Form.Item name="position">
                                    <div className="field position">
                                        <p className="field-title">Position</p>
                                        <Input
                                            placeholder="Type your position"
                                            type="text"
                                            maxLength={30}
                                            radiusType="semi-round"
                                            colorType="black"
                                            backgroundColorType="none"
                                            borderColorType="gray"
                                            height="40px"
                                            fontSize="12px"
                                            onBlur={(e) => updateFormState('position', e.target.value)}
                                            onChange={(e) => updateFormState('position', e.target.value)}
                                            value={formFields.position}
                                        />
                                    </div>
                                </Form.Item>
                            </div>
                        </>
                    )}
                    {userType === 'application' && (
                        <>
                            <Form.Item name="description">
                                <div className="field description">
                                    <p className="field-title">Description</p>
                                    <Input
                                        placeholder="Type your description"
                                        type="text"
                                        maxLength={100}
                                        radiusType="semi-round"
                                        colorType="black"
                                        backgroundColorType="none"
                                        borderColorType="gray"
                                        height="40px"
                                        fontSize="12px"
                                        onBlur={(e) => updateFormState('description', e.target.value)}
                                        onChange={(e) => updateFormState('description', e.target.value)}
                                        value={formFields.description}
                                    />
                                </div>
                            </Form.Item>
                        </>
                    )}
                </div>

                {((userType === 'management' && !isCloud()) || (userType === 'application' && localStorage.getItem(LOCAL_STORAGE_USER_PASS_BASED_AUTH) === 'true')) && (
                    <div className="password-section">
                        <p className="fields-title">Set password</p>
                        <Form.Item name="passwordType" initialValue={passwordType}>
                            <RadioButton
                                className="radio-button"
                                options={passwordOptions}
                                radioValue={passwordType}
                                optionType="button"
                                fontFamily="InterSemiBold"
                                style={{ marginRight: '20px', content: '' }}
                                onChange={(e) => passwordTypeChange(e)}
                            />
                        </Form.Item>
                        {passwordType === 0 && (
                            <Form.Item name="generatedPassword" initialValue={generatedPassword}>
                                <div className="field password">
                                    <p className="field-title">New password</p>
                                    <Input
                                        type="text"
                                        disabled
                                        radiusType="semi-round"
                                        colorType="black"
                                        backgroundColorType="none"
                                        borderColorType="gray"
                                        height="40px"
                                        fontSize="12px"
                                        value={generatedPassword}
                                    />
                                    <p className="generate-password-button" onClick={() => generateNewPassword()}>
                                        Generate again
                                    </p>
                                </div>
                            </Form.Item>
                        )}
                        {passwordType === 1 && (
                            <div>
                                <div className="field password">
                                    <p className="field-title">Type password*</p>
                                    <Form.Item
                                        name="password"
                                        rules={[
                                            {
                                                required: true,
                                                message: 'Password can not be empty'
                                            },
                                            {
                                                pattern: /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!?\-@#$%])[A-Za-z\d!?\-@#$%]{8,}$/,
                                                message:
                                                    'Password must be at least 8 characters long, contain both uppercase and lowercase, and at least one number and one special character(!?-@#$%)'
                                            }
                                        ]}
                                    >
                                        <Input
                                            placeholder="Type Password"
                                            type="password"
                                            maxLength={20}
                                            radiusType="semi-round"
                                            colorType="black"
                                            backgroundColorType="none"
                                            borderColorType="gray"
                                            height="40px"
                                            fontSize="12px"
                                        />
                                    </Form.Item>
                                </div>
                                <div className="field confirm">
                                    <p className="field-title">Confirm Password*</p>
                                    <Form.Item
                                        name="confirm"
                                        validateTrigger="onChange"
                                        dependencies={['password']}
                                        rules={[
                                            {
                                                required: true,
                                                message: 'Confirm password can not be empty'
                                            },
                                            ({ getFieldValue }) => ({
                                                validator(rule, value) {
                                                    if (!value || getFieldValue('password') === value) {
                                                        updateFormState('password', value);
                                                        return Promise.resolve();
                                                    }
                                                    return Promise.reject('Passwords do not match');
                                                }
                                            })
                                        ]}
                                    >
                                        <Input
                                            placeholder="Type Password"
                                            type="password"
                                            maxLength={20}
                                            radiusType="semi-round"
                                            colorType="black"
                                            backgroundColorType="none"
                                            borderColorType="gray"
                                            height="40px"
                                            fontSize="12px"
                                        />
                                    </Form.Item>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Form>
        </div>
    );
};

export default CreateUserDetails;
