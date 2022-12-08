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

import React, { useEffect, useState } from 'react';

import { ApiEndpoints } from '../../../../const/apiEndpoints';
import typeIcon from '../../../../assets/images/typeIcon.svg';
import createdByIcon from '../../../../assets/images/createdByIcon.svg';
import schemaItemIcon from '../../../../assets/images/schemaItemIcon.svg';

import { httpRequest } from '../../../../services/http';
import Button from '../../../../components/button';
import Copy from '../../../../components/copy';
import SelectComponent from '../../../../components/select';
import Editor, { DiffEditor } from '@monaco-editor/react';

const UpdateSchemaModal = ({ stationName, dispatch, close, schemaSelected }) => {
    const [schemaDetails, setSchemaDetails] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [useschemaLoading, setUseschemaLoading] = useState(false);
    const [activeVersion, setActiveVersion] = useState();
    const [currentVersion, setCurrentversion] = useState();
    const [isDiff, setIsDiff] = useState(false);

    const getUpdateSchema = async () => {
        try {
            setIsLoading(true);
            const data = await httpRequest('GET', `${ApiEndpoints.GET_UPDATE_SCHEMA}?station_name=${stationName}`);
            if (data) {
                let active = data.versions?.findIndex((version) => version?.active === true);
                let current = data.versions?.findIndex((version) => version?.active === false);
                setActiveVersion(data.versions[active]);
                setCurrentversion(data.versions[current]);
                setSchemaDetails(data);
            }
        } catch (error) {}
        setIsLoading(false);
    };

    useEffect(() => {
        getUpdateSchema();
    }, []);

    const useSchema = async () => {
        try {
            setUseschemaLoading(true);
            const data = await httpRequest('POST', ApiEndpoints.USE_SCHEMA, { station_name: stationName, schema_name: schemaSelected });
            if (data) {
                dispatch(data);
                setUseschemaLoading(false);
            }
        } catch (error) {}
        setUseschemaLoading(false);
    };

    return (
        <div className="update-schema-modal-container">
            <div className="scrollable-wrapper">
                <div className="schema-name">
                    <img src={schemaItemIcon} />
                    <div className="name-wrapper">
                        <p className="title">Schema name</p>
                        <p className="name">{schemaSelected}</p>
                    </div>
                </div>
                <div className="type-created">
                    <div className="wrapper">
                        <img src={typeIcon} alt="typeIcon" />
                        <p>Type:</p>
                        {schemaDetails.type === 'json' ? <p className="schema-json-name">JSON schema</p> : <span> {schemaDetails.type}</span>}
                    </div>
                    <div className="wrapper">
                        <img src={createdByIcon} alt="createdByIcon" />
                        <p>Created by:</p>
                        <span>{activeVersion?.created_by_user}</span>
                    </div>
                </div>
                <div className="schema-content">
                    <div className="header">
                        <div className="diff-wrapper">
                            <span>Diff : </span>
                            <div className="switcher">
                                <div className={isDiff ? 'yes-no-wrapper yes' : 'yes-no-wrapper border'} onClick={() => setIsDiff(true)}>
                                    <p>Yes</p>
                                </div>
                                <div className={isDiff ? 'yes-no-wrapper' : 'yes-no-wrapper no'} onClick={() => setIsDiff(false)}>
                                    <p>No</p>
                                </div>
                            </div>
                        </div>
                        <div className="structure-message">
                            {schemaDetails.type === 'protobuf' && (
                                <>
                                    <p className="field-name">Master message :</p>
                                    <SelectComponent
                                        value={activeVersion?.message_struct_name}
                                        colorType="black"
                                        backgroundColorType="white"
                                        borderColorType="gray-light"
                                        radiusType="semi-round"
                                        minWidth="12vw"
                                        width="100px"
                                        height="26px"
                                        options={[]}
                                        iconColor="gray"
                                        popupClassName="message-option"
                                        disabled={true}
                                    />
                                </>
                            )}
                        </div>
                        <div className="copy-icon">
                            <Copy data={activeVersion?.schema_content} />
                        </div>
                    </div>

                    {!isDiff && (
                        <Editor
                            options={{
                                minimap: { enabled: false },
                                scrollbar: { verticalScrollbarSize: 2 },
                                scrollBeyondLastLine: false,
                                roundedSelection: false,
                                formatOnPaste: true,
                                formatOnType: true,
                                readOnly: true,
                                fontSize: '14px'
                            }}
                            language="proto"
                            height="calc(100% - 55px)"
                            value={activeVersion?.schema_content}
                        />
                    )}
                    {isDiff && (
                        <DiffEditor
                            height="calc(100% - 55px)"
                            language="proto"
                            original={currentVersion?.schema_content}
                            modified={activeVersion?.schema_content}
                            options={{
                                renderSideBySide: false,
                                readOnly: true,
                                scrollbar: { verticalScrollbarSize: 2, horizontalScrollbarSize: 0 },
                                renderOverviewRuler: false,
                                colorDecorators: true,
                                fontSize: '14px'
                            }}
                        />
                    )}
                </div>
                <div className="version-number">
                    <p>
                        Active version: <span>{activeVersion?.version_number}</span>
                    </p>
                </div>
            </div>
            <div className="buttons">
                <Button
                    width="150px"
                    height="35px"
                    placeholder="Close"
                    colorType="black"
                    radiusType="circle"
                    backgroundColorType="white"
                    border="gray-light"
                    fontSize="13px"
                    fontFamily="InterSemiBold"
                    onClick={() => close()}
                />
                <Button
                    width="150px"
                    height="35px"
                    placeholder="Update"
                    colorType="white"
                    radiusType="circle"
                    backgroundColorType="purple"
                    fontSize="13px"
                    fontFamily="InterSemiBold"
                    isLoading={useschemaLoading}
                    onClick={useSchema}
                />
            </div>
        </div>
    );
};

export default UpdateSchemaModal;
