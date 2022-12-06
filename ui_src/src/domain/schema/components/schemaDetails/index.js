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

import { CheckCircleOutlineRounded, ErrorOutlineRounded } from '@material-ui/icons';
import Editor, { DiffEditor } from '@monaco-editor/react';
import React, { useContext, useEffect, useState } from 'react';
import Schema from 'protocol-buffers-schema';
import { message } from 'antd';

import createdDateIcon from '../../../../assets/images/createdDateIcon.svg';
import scrollBackIcon from '../../../../assets/images/scrollBackIcon.svg';
import redirectIcon from '../../../../assets/images/redirectIcon.svg';
import createdByIcon from '../../../../assets/images/createdByIcon.svg';
import verifiedIcon from '../../../../assets/images/verifiedIcon.svg';
import rollBackIcon from '../../../../assets/images/rollBackIcon.svg';
import { getUnique, isThereDiff, parsingDate } from '../../../../services/valueConvertor';
import SelectVersion from '../../../../components/selectVersion';
import typeIcon from '../../../../assets/images/typeIcon.svg';
import { ApiEndpoints } from '../../../../const/apiEndpoints';
import SelectComponent from '../../../../components/select';
import { httpRequest } from '../../../../services/http';
import Button from '../../../../components/button';
import Modal from '../../../../components/modal';
import Copy from '../../../../components/copy';
import TagsList from '../../../../components/tagList';
import { useHistory } from 'react-router-dom';
import pathDomains from '../../../../router';
import { Context } from '../../../../hooks/store';
import Ajv2019 from 'ajv/dist/2019';
import jsonSchemaDraft04 from 'ajv-draft-04';
import draft7MetaSchema from 'ajv/dist/refs/json-schema-draft-07.json';
import Ajv2020 from 'ajv/dist/2020';
import draft6MetaSchema from 'ajv/dist/refs/json-schema-draft-06.json';
import OverflowTip from '../../../../components/tooltip/overflowtip';
import { parse } from 'graphql';

const formatOption = [
    {
        id: 1,
        value: 0,
        label: 'Code'
    },
    {
        id: 2,
        value: 1,
        label: 'Table'
    }
];

function SchemaDetails({ schemaName, closeDrawer }) {
    const ajv = new Ajv2019();
    const [state, dispatch] = useContext(Context);

    const [versionSelected, setVersionSelected] = useState();
    const [currentVersion, setCurrentversion] = useState();
    const [updated, setUpdated] = useState(false);
    const [loading, setIsLoading] = useState(false);
    const [rollLoading, setIsRollLoading] = useState(false);
    const [newVersion, setNewVersion] = useState('');
    const [schemaDetails, setSchemaDetails] = useState({
        schema_name: '',
        type: '',
        version: [],
        tags: []
    });
    const [rollBackModal, setRollBackModal] = useState(false);
    const [activateVersionModal, setActivateVersionModal] = useState(false);
    const [isDiff, setIsDiff] = useState(true);
    const [validateLoading, setValidateLoading] = useState(false);
    const [validateError, setValidateError] = useState('');
    const [validateSuccess, setValidateSuccess] = useState(false);
    const [messageStructName, setMessageStructName] = useState('');
    const [messagesStructNameList, setMessagesStructNameList] = useState([]);
    const [editable, setEditable] = useState(false);
    const [latestVersion, setLatest] = useState({});
    const history = useHistory();

    const goToStation = (stationName) => {
        history.push(`${pathDomains.stations}/${stationName}`);
    };

    const arrangeData = (schema) => {
        let index = schema.versions?.findIndex((version) => version?.active === true);
        setCurrentversion(schema.versions[index]);
        setVersionSelected(schema.versions[index]);
        setNewVersion(schema.versions[index].schema_content);
        setSchemaDetails(schema);
        if (schema.type === 'protobuf') {
            let parser = Schema.parse(schema.versions[index].schema_content).messages;
            setMessageStructName(schema.versions[index].message_struct_name);
            if (parser.length === 1) {
                setEditable(false);
            } else {
                setEditable(true);
                setMessageStructName(schema.versions[index].message_struct_name);
                setMessagesStructNameList(parser);
            }
        }
    };

    const getScemaDetails = async () => {
        try {
            const data = await httpRequest('GET', `${ApiEndpoints.GET_SCHEMA_DETAILS}?schema_name=${schemaName}`);
            arrangeData(data);
        } catch (err) {}
    };

    useEffect(() => {
        getScemaDetails();
    }, []);

    const handleSelectVersion = (e) => {
        let index = schemaDetails?.versions?.findIndex((version) => version.version_number === e);
        setVersionSelected(schemaDetails?.versions[index]);
        setMessageStructName(schemaDetails?.versions[index].message_struct_name);
        setNewVersion('');
    };

    const createNewVersion = async () => {
        try {
            setIsLoading(true);
            const data = await httpRequest('POST', ApiEndpoints.CREATE_NEW_VERSION, {
                schema_name: schemaName,
                schema_content: newVersion,
                message_struct_name: messageStructName
            });
            if (data) {
                arrangeData(data);
                setLatest(data);
                setActivateVersionModal(true);
                setIsLoading(false);
            }
        } catch (err) {
            if (err.status === 555) {
                setValidateSuccess('');
                setValidateError(err.data.message);
            }
        }
        setIsLoading(false);
    };

    const rollBackVersion = async (latest = false) => {
        try {
            setIsLoading(true);
            const data = await httpRequest('PUT', ApiEndpoints.ROLL_BACK_VERSION, {
                schema_name: schemaName,
                version_number: latest ? latestVersion?.versions[0]?.version_number : versionSelected?.version_number
            });
            if (data) {
                arrangeData(data);
                message.success({
                    key: 'memphisSuccessMessage',
                    content: 'Your selected version is now the primary version',
                    duration: 5,
                    style: { cursor: 'pointer' },
                    onClick: () => message.destroy('memphisSuccessMessage')
                });
                setRollBackModal(false);
                setActivateVersionModal(false);
            }
        } catch (err) {}
        setIsLoading(false);
    };

    const validateJsonSchemaContent = (value, ajv) => {
        const isValid = ajv.validateSchema(value);
        if (isValid) {
            setValidateSuccess('');
            setValidateError('');
        } else {
            setValidateError('Your schema is invalid');
        }
    };

    const validateGraphQlSchema = (value) => {
        try {
            parse(value);
            setValidateSuccess('');
            setValidateError('');
        } catch (error) {
            setValidateSuccess('');
            setValidateError(error.message);
        }
    };

    const validateJsonSchema = (value) => {
        try {
            value = JSON.parse(value);
            ajv.addMetaSchema(draft7MetaSchema);
            validateJsonSchemaContent(value, ajv);
        } catch (error) {
            try {
                const ajv = new jsonSchemaDraft04();
                validateJsonSchemaContent(value, ajv);
            } catch (error) {
                try {
                    const ajv = new Ajv2020();
                    validateJsonSchemaContent(value, ajv);
                } catch (error) {
                    try {
                        ajv.addMetaSchema(draft6MetaSchema);
                        validateJsonSchemaContent(value, ajv);
                    } catch (error) {
                        setValidateSuccess('');
                        setValidateError(error.message);
                    }
                }
            }
        }
    };

    const checkContent = (value) => {
        const { type } = schemaDetails;
        if (value === ' ' || value === '') {
            setValidateSuccess('');
            setValidateError('Schema content cannot be empty');
        }
        if (value && value.length > 0) {
            if (type === 'protobuf') {
                try {
                    let parser = Schema.parse(value).messages;
                    if (parser.length > 1) {
                        setEditable(true);
                        setMessagesStructNameList(getUnique(parser));
                    } else {
                        setMessageStructName(parser[0].name);
                        setEditable(false);
                    }
                } catch (error) {
                    setValidateSuccess('');
                    setValidateError(error.message);
                }
            } else if (type === 'json') {
                validateJsonSchema(value);
            } else if (type === 'graphql') {
                validateGraphQlSchema(value);
            }
        }
    };

    const handleEditVersion = (value) => {
        setValidateSuccess('');
        setNewVersion(value);
        setUpdated(isThereDiff(versionSelected?.schema_content, value));
        checkContent(value);
    };

    const handleValidateSchema = async () => {
        setValidateLoading(true);
        try {
            const data = await httpRequest('POST', ApiEndpoints.VALIDATE_SCHEMA, {
                schema_type: schemaDetails?.type,
                schema_content: newVersion || versionSelected?.schema_content
            });
            if (data.is_valid) {
                setValidateError('');
                setTimeout(() => {
                    setValidateSuccess('Schema is valid');
                    setValidateLoading(false);
                }, 1000);
            }
        } catch (error) {
            if (error.status === 555) {
                setValidateSuccess('');
                setValidateError(error.data.message);
            }
            setValidateLoading(false);
        }
    };

    const removeTag = async (tagName) => {
        try {
            await httpRequest('DELETE', `${ApiEndpoints.REMOVE_TAG}`, { name: tagName, entity_type: 'schema', entity_name: schemaName });
            let tags = schemaDetails?.tags;
            let updatedTags = tags.filter((tag) => tag.name !== tagName);
            updateTags(updatedTags);
            dispatch({ type: 'SET_SCHEMA_TAGS', payload: { schemaName: schemaName, tags: updatedTags } });
        } catch (error) {}
    };

    const updateTags = (newTags) => {
        let updatedValue = { ...schemaDetails };
        updatedValue['tags'] = newTags;
        setSchemaDetails((schemaDetails) => ({ ...schemaDetails, ...updatedValue }));
        dispatch({ type: 'SET_SCHEMA_TAGS', payload: { schemaName: schemaName, tags: newTags } });
    };

    return (
        <schema-details is="3xd">
            <div className="scrollable-wrapper">
                <div className="type-created">
                    <div className="wrapper">
                        <img src={typeIcon} alt="typeIcon" />
                        <p>Type:</p>
                        {schemaDetails?.type === 'json' ? <span>JSON schema</span> : <span> {schemaDetails?.type}</span>}
                    </div>
                    <div className="wrapper">
                        <img src={createdByIcon} alt="createdByIcon" />
                        <p>Created by:</p>
                        <OverflowTip text={currentVersion?.created_by_user} maxWidth={'150px'}>
                            <span>{currentVersion?.created_by_user}</span>
                        </OverflowTip>
                    </div>
                    <div className="wrapper">
                        <img src={createdDateIcon} alt="typeIcon" />
                        <span>{parsingDate(currentVersion?.creation_date)}</span>
                    </div>
                </div>
                <div className="tags">
                    <TagsList
                        tagsToShow={5}
                        className="tags-list"
                        tags={schemaDetails?.tags}
                        addNew={true}
                        editable={true}
                        handleDelete={(tag) => removeTag(tag)}
                        entityType={'schema'}
                        entityName={schemaName}
                        handleTagsUpdate={(tags) => {
                            updateTags(tags);
                        }}
                    />
                </div>
                <div className="schema-fields">
                    <div className="left">
                        <p className={!versionSelected?.active ? 'tlt seperator' : 'tlt'}>Schema structure</p>
                        {!versionSelected?.active && (
                            <>
                                <span>Diff : </span>
                                <div className="switcher">
                                    <div className={isDiff ? 'yes-no-wrapper yes' : 'yes-no-wrapper border'} onClick={() => setIsDiff(true)}>
                                        <p>Yes</p>
                                    </div>
                                    <div className={isDiff ? 'yes-no-wrapper' : 'yes-no-wrapper no'} onClick={() => setIsDiff(false)}>
                                        <p>No</p>
                                    </div>
                                </div>
                            </>
                        )}
                        {/* <RadioButton options={formatOption} radioValue={passwordType} onChange={(e) => passwordTypeChange(e)} /> */}
                    </div>
                    <SelectVersion value={versionSelected?.version_number} options={schemaDetails?.versions} onChange={(e) => handleSelectVersion(e)} />
                </div>
                <div className="schema-content">
                    <div className="header">
                        <div className="structure-message">
                            {schemaDetails.type === 'protobuf' && (
                                <>
                                    <p className="field-name">Master message :</p>
                                    <SelectComponent
                                        value={messageStructName}
                                        colorType="black"
                                        backgroundColorType="white"
                                        borderColorType="gray-light"
                                        radiusType="semi-round"
                                        minWidth="12vw"
                                        width="250px"
                                        height="30px"
                                        options={messagesStructNameList}
                                        iconColor="gray"
                                        popupClassName="message-option"
                                        onChange={(e) => {
                                            setMessageStructName(e);
                                            setUpdated(true);
                                        }}
                                        disabled={!editable}
                                    />
                                </>
                            )}
                        </div>
                        <div className="validation">
                            <Button
                                width="100px"
                                height="28px"
                                placeholder={
                                    <div className="validate-placeholder">
                                        <img src={verifiedIcon} alt="verifiedIcon" />
                                        <p>Validate</p>
                                    </div>
                                }
                                colorType="white"
                                radiusType="circle"
                                backgroundColorType="purple"
                                fontSize="12px"
                                fontFamily="InterMedium"
                                disabled={updated && newVersion === ''}
                                isLoading={validateLoading}
                                onClick={() => handleValidateSchema()}
                            />
                        </div>
                        <div className="copy-icon">
                            <Copy data={newVersion || versionSelected?.schema_content} />
                        </div>
                    </div>
                    {versionSelected?.active && (
                        <Editor
                            options={{
                                minimap: { enabled: false },
                                scrollbar: { verticalScrollbarSize: 3 },
                                scrollBeyondLastLine: false,
                                roundedSelection: false,
                                formatOnPaste: true,
                                formatOnType: true,
                                fontSize: '14px'
                            }}
                            language="proto"
                            height="calc(100% - 104px)"
                            defaultValue={versionSelected?.schema_content}
                            value={newVersion}
                            onChange={(value) => {
                                handleEditVersion(value);
                            }}
                        />
                    )}
                    {!versionSelected?.active && (
                        <>
                            {!isDiff && (
                                <Editor
                                    options={{
                                        minimap: { enabled: false },
                                        scrollbar: { verticalScrollbarSize: 3 },
                                        scrollBeyondLastLine: false,
                                        roundedSelection: false,
                                        formatOnPaste: true,
                                        formatOnType: true,
                                        readOnly: true,
                                        fontSize: '14px'
                                    }}
                                    language="proto"
                                    height="calc(100% - 100px)"
                                    value={versionSelected?.schema_content}
                                />
                            )}
                            {isDiff && (
                                <DiffEditor
                                    height="calc(100% - 100px)"
                                    language="proto"
                                    original={currentVersion?.schema_content}
                                    modified={versionSelected?.schema_content}
                                    options={{
                                        renderSideBySide: false,
                                        readOnly: true,
                                        scrollbar: { verticalScrollbarSize: 3, horizontalScrollbarSize: 0 },
                                        renderOverviewRuler: false,
                                        colorDecorators: true,
                                        fontSize: '14px'
                                    }}
                                />
                            )}
                        </>
                    )}
                    {(validateError || validateSuccess) && (
                        <div className={validateSuccess ? 'validate-note success' : 'validate-note error'}>
                            {validateError && <ErrorOutlineRounded />}
                            {validateSuccess && <CheckCircleOutlineRounded />}
                            <p>{validateError || validateSuccess}</p>
                        </div>
                    )}
                </div>
                <div className="used-stations">
                    {schemaDetails?.used_stations?.length > 0 ? (
                        <>
                            <p className="title">Used by stations</p>
                            <div className="stations-list">
                                {schemaDetails.used_stations?.map((station, index) => {
                                    return (
                                        <div className="station-wrapper" key={index} onClick={() => goToStation(station)}>
                                            <p>{station}</p>
                                            <div className="redirect-img">
                                                <img src={redirectIcon} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    ) : (
                        <p className="title">Not in use</p>
                    )}
                </div>
            </div>
            <div className="footer">
                <div className="left-side">
                    <Button
                        width="105px"
                        height="34px"
                        placeholder={'Close'}
                        colorType="black"
                        radiusType="circle"
                        backgroundColorType="white"
                        border="gray-light"
                        fontSize="12px"
                        fontWeight="600"
                        onClick={() => closeDrawer()}
                    />
                    {!versionSelected?.active ? (
                        <Button
                            width="115px"
                            height="34px"
                            placeholder={
                                <div className="placeholder-button">
                                    <img src={scrollBackIcon} alt="scrollBackIcon" />
                                    <p>Activate</p>
                                </div>
                            }
                            colorType="white"
                            radiusType="circle"
                            backgroundColorType="purple"
                            fontSize="12px"
                            fontWeight="600"
                            onClick={() => setRollBackModal(true)}
                        />
                    ) : (
                        <Button
                            width="115px"
                            height="34px"
                            placeholder={'Create version'}
                            colorType="white"
                            radiusType="circle"
                            backgroundColorType="purple"
                            fontSize="12px"
                            fontWeight="600"
                            loading={loading}
                            disabled={!updated || (updated && newVersion === '')}
                            onClick={() => createNewVersion()}
                        />
                    )}
                </div>
            </div>
            <Modal
                header={<img src={rollBackIcon} alt="rollBackIcon" />}
                width="400px"
                height="160px"
                displayButtons={false}
                clickOutside={() => setRollBackModal(false)}
                open={rollBackModal}
            >
                <div className="roll-back-modal">
                    <p className="title">Are you sure you want to activate this version?</p>
                    <p className="desc">Your current schema will be changed to this version.</p>
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
                            onClick={() => setRollBackModal(false)}
                        />
                        <Button
                            width="150px"
                            height="34px"
                            placeholder="Confirm"
                            colorType="white"
                            radiusType="circle"
                            backgroundColorType="purple"
                            fontSize="12px"
                            fontFamily="InterSemiBold"
                            loading={rollLoading}
                            onClick={() => rollBackVersion()}
                        />
                    </div>
                </div>
            </Modal>
            <Modal
                header={<img src={rollBackIcon} alt="rollBackIcon" />}
                width="430px"
                height="200px"
                displayButtons={false}
                clickOutside={() => setActivateVersionModal(false)}
                open={activateVersionModal}
            >
                <div className="roll-back-modal">
                    <p className="title">You have created a new version - do you want to activate it?</p>
                    <p className="desc">Your current schema will be changed to the new version.</p>
                    <div className="buttons">
                        <Button
                            width="150px"
                            height="34px"
                            placeholder="No"
                            colorType="black"
                            radiusType="circle"
                            backgroundColorType="white"
                            border="gray-light"
                            fontSize="12px"
                            fontFamily="InterSemiBold"
                            onClick={() => setActivateVersionModal(false)}
                        />
                        <Button
                            width="150px"
                            height="34px"
                            placeholder="Yes"
                            colorType="white"
                            radiusType="circle"
                            backgroundColorType="purple"
                            fontSize="12px"
                            fontFamily="InterSemiBold"
                            loading={rollLoading}
                            onClick={() => rollBackVersion(true)}
                        />
                    </div>
                </div>
            </Modal>
        </schema-details>
    );
}

export default SchemaDetails;
