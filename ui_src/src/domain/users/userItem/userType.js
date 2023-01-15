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

import React, { useEffect, useState } from 'react';

function UserType({ userType }) {
    const [fontColor, setFontColor] = useState('#FD79A8');
    const [backgroundColor, setBackgroundColor] = useState('rgba(253, 121, 168, 0.2)');

    useEffect(() => {
        createTypeWrapperStyle(userType);
    }, [userType]);

    const createTypeWrapperStyle = (userType) => {
        switch (userType) {
            case 'management':
                setFontColor('#36DEDE');
                setBackgroundColor('rgba(54, 222, 222, 0.2)');
                break;
            case 'application':
                setFontColor('#419FFE');
                setBackgroundColor('rgba(65, 159, 254, 0.2)');
                break;
            default:
                setFontColor('#FD79A8');
                setBackgroundColor('rgba(253, 121, 168, 0.2))');
                break;
        }
    };

    return (
        <div className="user-typep-wrapper" style={{ background: backgroundColor, color: fontColor }}>
            {userType}
        </div>
    );
}

export default UserType;
