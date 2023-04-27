// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {HTMLAttributes} from 'react';

const ThreadsIcon = (attrs: HTMLAttributes<SVGElement>) => {
    return (
        <svg
            width='14'
            height='13'
            viewBox='0 0 14 13'
            fill='none'
            xmlns='http://www.w3.org/2000/svg'
            {...attrs}
        >
            <path
                d='M11.7952 0.00524884C12.1312 0.00524884 12.4144 0.125249 12.6448 0.365248C12.8848 0.595648 13.0048 0.878848 13.0048 1.21485V8.41485C13.0048 8.75085 12.8848 9.03405 12.6448 9.26445C12.4144 9.49485 12.1312 9.61005 11.7952 9.61005H3.4L0.9952 12.0148V1.21485C0.9952 0.878848 1.1104 0.595648 1.3408 0.365248C1.5808 0.125249 1.8688 0.00524884 2.2048 0.00524884H11.7952ZM2.2048 1.21485V9.10605L2.896 8.41485H11.7952V1.21485H2.2048ZM3.4 3.01485H10.6V4.21005H3.4V3.01485ZM3.4 5.40525H8.8V6.61485H3.4V5.40525Z'
            />
        </svg>
    );
};

export default ThreadsIcon;
