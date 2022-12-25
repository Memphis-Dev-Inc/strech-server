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
import { Collapse } from 'antd';

import CollapseArrow from '../../../../../assets/images/collapseArrow.svg';
import StatusIndication from '../../../../../components/indication';
import OverflowTip from '../../../../../components/tooltip/overflowtip';
import Copy from '../../../../../components/copy';
import { decodeMessage } from '../../../../../services/decoder';
import { hex_to_ascii } from '../../../../../services/valueConvertor';
import SegmentButton from '../../../../../components/segmentButton';
import TooltipComponent from '../../../../../components/tooltip/tooltip';

const { Panel } = Collapse;

const CustomCollapse = ({ status, data, header, defaultOpen, collapsible, message, tooltip }) => {
    const [activeKey, setActiveKey] = useState(defaultOpen ? ['1'] : []);
    const [parser, setParser] = useState('bytes');
    const [payload, setPayload] = useState(data);

    useEffect(() => {
        if (header === 'Payload') {
            switch (parser) {
                case 'string':
                    setPayload(hex_to_ascii(data));
                    break;
                case 'json':
                    let str = hex_to_ascii(data);
                    if (isJsonString(str)) {
                        setPayload(JSON.stringify(JSON.parse(str), null, 2));
                    } else {
                        setPayload(str);
                    }
                    break;
                case 'protobuf':
                    setPayload(JSON.stringify(decodeMessage(data), null, 2));
                    break;
                case 'bytes':
                    setPayload(data);
                    break;
                default:
                    setPayload(data);
            }
        }
    }, [parser, data]);

    const onChange = (key) => {
        setActiveKey(key);
    };

    const drawHeaders = (headers) => {
        let obj = [];
        for (const property in headers) {
            obj.push(
                <div className="headers-container">
                    <p>{property}</p>
                    <div className="copy-section">
                        <Copy data={headers[property]}></Copy>
                        <OverflowTip text={headers[property]} width={'calc(100% - 10px)'}>
                            {headers[property]}
                        </OverflowTip>
                    </div>
                </div>
            );
        }
        return obj;
    };

    const isJsonString = (str) => {
        try {
            JSON.parse(str);
        } catch (e) {
            return false;
        }
        return true;
    };

    return (
        <Collapse ghost defaultActiveKey={activeKey} onChange={onChange} className="custom-collapse">
            <Panel
                showArrow={false}
                collapsible={collapsible || data?.length === 0 || (data !== undefined && Object?.keys(data)?.length === 0) ? 'disabled' : null}
                className={header === 'Payload' ? 'payload-header' : ''}
                header={
                    <TooltipComponent text={tooltip}>
                        <div className="collapse-header">
                            <div className="first-row">
                                <p className="title">
                                    {header}
                                    {header === 'Headers' && <span className="consumer-number">{data !== undefined ? Object?.keys(data)?.length : ''}</span>}
                                </p>
                                <status is="x3d">
                                    <img className={activeKey[0] === '1' ? 'collapse-arrow open' : 'collapse-arrow close'} src={CollapseArrow} alt="collapse-arrow" />
                                </status>
                            </div>
                        </div>
                    </TooltipComponent>
                }
                key="1"
            >
                {message ? (
                    <div className="message">
                        {header === 'Headers' && drawHeaders(data)}
                        {header === 'Payload' && (
                            <>
                                <Copy data={data} />
                                <div className="second-row">
                                    <SegmentButton options={['bytes', 'string', 'json', 'protobuf']} onChange={(e) => setParser(e)} />
                                </div>
                                {parser === 'json' || parser === 'protobuf' ? <pre>{payload}</pre> : <p>{payload}</p>}
                            </>
                        )}
                    </div>
                ) : (
                    <>
                        {!status &&
                            data?.length > 0 &&
                            data?.map((row) => {
                                return (
                                    <content is="x3d" key={row.name}>
                                        <p>{row.name}</p>
                                        <span>{row.value}</span>
                                    </content>
                                );
                            })}
                        {status &&
                            data?.details?.length > 0 &&
                            data?.details?.map((row) => {
                                return (
                                    <content is="x3d" key={row.name}>
                                        <p>{row.name}</p>
                                        <span>{row.value}</span>
                                    </content>
                                );
                            })}
                    </>
                )}
            </Panel>
        </Collapse>
    );
};

export default CustomCollapse;
