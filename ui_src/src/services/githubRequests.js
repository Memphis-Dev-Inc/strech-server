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

import { message } from 'antd';
import axios from 'axios';

export async function GithubRequest(serverUrl) {
    try {
        const res = await axios.get(serverUrl);
        const results = res.data;
        return results;
    } catch (err) {
        if (err?.response?.data?.message !== undefined && err?.response?.status === 500) {
            message.error({
                key: 'memphisErrorMessage',
                content: (
                    <>
                        We have some issues. Please open a
                        <a className="a-link" href="https://github.com/memphisdev/memphis" target="_blank">
                            GitHub issue
                        </a>
                    </>
                ),
                duration: 5,
                style: { cursor: 'pointer' },
                onClick: () => message.destroy('memphisErrorMessage')
            });
        }
        throw err.response;
    }
}

export function ExtractAddedFeatures(mdFile) {
    if (!mdFile) {
        return [];
    }
    const regex = /###\s*!\[:sparkles:\].*?Added\s*features\s*(.*?)\s*(?=###|$)/is;
    const match = mdFile.match(regex);
    if (!match) {
        return [];
    }
    const features = match[1]
        .split('\n')
        .map((feature) => {
            const regex = /[*-]\s*(.*)/;
            const match = feature.match(regex);
            if (match) {
                return match[1].trim();
            }
            return null;
        })
        .filter((feature) => !!feature);

    return features;
}
