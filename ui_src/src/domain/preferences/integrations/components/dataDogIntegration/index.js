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

import React, { useState } from 'react';
import { Collapse } from 'antd';

import { INTEGRATION_LIST } from '../../../../../const/integrationList';
import CollapseArrow from '../../../../../assets/images/collapseArrow.svg';
import datadogMetricsps from '../../../../../assets/images/datadogMetricsps.png';

import Button from '../../../../../components/button';
import Copy from '../../../../../components/copy';
import Modal from '../../../../../components/modal';
import { ZoomInRounded } from '@material-ui/icons';

const { Panel } = Collapse;

const ExpandIcon = ({ isActive }) => <img className={isActive ? 'collapse-arrow open' : 'collapse-arrow close'} src={CollapseArrow} alt="collapse-arrow" />;

const DataDogIntegration = ({ close }) => {
    const dataDogConfiguration = INTEGRATION_LIST[1];
    const [currentStep, setCurrentStep] = useState(0);
    const [showModal, setShowModal] = useState(false);

    const handleToggleModal = () => {
        setShowModal(!showModal);
    };

    const getContent = (key) => {
        switch (key) {
            case 0:
                return (
                    <div className="steps-content">
                        <h3>
                            If you haven't installed Memphis with the <label>exporter.enabled</label> yet - (* <label>websocket.tls</label> are optional for a superior
                            GUI experience)
                        </h3>
                        <div className="editor">
                            <pre>
                                helm install memphis memphis --create-namespace --namespace memphis --wait --set cluster.enabled="true", exporter.enabled="true",
                                websocket.tls.secret.name="tls-secret", websocket.tls.cert="memphis_local.pem", websocket.tls.key="memphis-key_local.pem"
                            </pre>
                            <Copy
                                data={`helm install memphis memphis --create-namespace --namespace memphis --wait --set cluster.enabled="true", exporter.enabled="true", websocket.tls.secret.name="tls-secret", websocket.tls.cert="memphis_local.pem", websocket.tls.key="memphis-key_local.pem"`}
                            />
                        </div>
                        <p>If Memphis is already installed -</p>
                        <span>Get current deployment values.</span>
                        <div className="editor">
                            <pre>helm get values memphis --namespace memphis</pre>
                            <Copy data={`helm get values memphis --namespace memphis`} />
                        </div>
                        <span>Run the following command.</span>
                        <div className="editor">
                            <pre>helm upgrade --set cluster.enabled=true --set exporter.enabled=true memphis --namespace memphis</pre>
                            <Copy data={`helm upgrade --set cluster.enabled=true --set exporter.enabled=true memphis --namespace memphis`} />
                        </div>
                    </div>
                );
            case 1:
                return (
                    <div className="steps-content">
                        <h3>
                            Add Datadog annotation to the <label>memphis-broker</label> statefulset to expose Prometheus metrics to datadog agent:
                        </h3>
                        <span>A one-liner command -</span>
                        <div className="editor">
                            <pre>{`cat <<EOF | kubectl -n memphis patch sts memphis-broker --patch '
spec:
  template:
    metadata:
      annotations:
        ad.datadoghq.com/metrics.checks: |
           {
             "openmetrics": {
               "instances": [
                 {
                   "openmetrics_endpoint": "http://%%host%%:%%port%%/metrics",
                   "namespace": "memphis",
                   "metrics": [".*"]
                 }
               ]
             }
           }'
EOF`}</pre>
                            <Copy
                                data={`cat <<EOF | kubectl -n memphis patch sts memphis-broker --patch '
spec:
  template:
    metadata:
      annotations:
        ad.datadoghq.com/metrics.checks: |
           {
             "openmetrics": {
               "instances": [
                 {
                   "openmetrics_endpoint": "http://%%host%%:%%port%%/metrics",
                   "namespace": "memphis",
                   "metrics": [".*"]
                 }
               ]
             }
           }'
EOF`}
                            />
                        </div>
                    </div>
                );
            case 2:
                return (
                    <div className="steps-content">
                        <h3>{`Reach your Datadog account -> Metrics -> Summary, and check if "memphis" metrics arrives.`}</h3>
                        <div className="img" onClick={handleToggleModal}>
                            <img src={datadogMetricsps} alt="datadogMetricsps" width={400} />
                            <ZoomInRounded />
                        </div>
                    </div>
                );
            case 3:
                return (
                    <div className="steps-content">
                        <h3>
                            A Datadog{' '}
                            <a href="https://docs.datadoghq.com/dashboards/#copy-import-or-export-dashboard-json" target="_blank">
                                tutorial
                            </a>{' '}
                            on how to import a dashboard
                        </h3>
                        <h3>
                            Memphis dashboard .json file to{' '}
                            <a
                                href="https://raw.githubusercontent.com/memphisdev/gitbook-backup/master/dashboard-gui/integrations/monitoring/MemphisDashboard.json"
                                target="_blank"
                            >
                                download
                            </a>
                        </h3>
                    </div>
                );

            default:
                break;
        }
    };

    return (
        <dynamic-integration is="3xd" className="integration-modal-container">
            {dataDogConfiguration?.insideBanner}
            <div className="integrate-header">
                {dataDogConfiguration.header}
                <div className="action-buttons flex-end">
                    <Button
                        width="140px"
                        height="35px"
                        placeholder="Integration guide"
                        colorType="white"
                        radiusType="circle"
                        backgroundColorType="purple"
                        border="none"
                        fontSize="12px"
                        fontFamily="InterSemiBold"
                        onClick={() => window.open('https://docs.memphis.dev/memphis/dashboard-gui/integrations/monitoring/datadog', '_blank')}
                    />
                </div>
            </div>
            {dataDogConfiguration.integrateDesc}
            <div className="datadog-stepper">
                <Collapse
                    activeKey={currentStep}
                    onChange={(key) => setCurrentStep(Number(key))}
                    accordion={true}
                    expandIcon={({ isActive }) => <ExpandIcon isActive={isActive} />}
                >
                    {dataDogConfiguration?.steps?.map((step) => {
                        return (
                            <Panel header={step.title} key={step.key}>
                                {getContent(step.key)}
                            </Panel>
                        );
                    })}
                </Collapse>
                <div className="close-btn">
                    <Button
                        width="300px"
                        height="45px"
                        placeholder="Close"
                        colorType="white"
                        radiusType="circle"
                        backgroundColorType="purple"
                        fontSize="14px"
                        fontFamily="InterSemiBold"
                        onClick={() => close()}
                    />
                </div>
            </div>
            {showModal && (
                <Modal className={'zoomin-modal'} width="1000px" displayButtons={false} clickOutside={() => setShowModal(false)} open={showModal}>
                    <img width={'100%'} src={datadogMetricsps} alt="zoomable" />
                </Modal>
            )}
        </dynamic-integration>
    );
};

export default DataDogIntegration;
