// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

type SvgProps = {
    width?: number;
    height?: number;
}

export default ({width = 16, height = 16}: SvgProps) => (
    <svg
        width={width}
        height={height}
        viewBox='0 0 16 16'
        fill='none'
        xmlns='http://www.w3.org/2000/svg'
    >
        <path
            d='M7.19989 1.2V15.2L9.59989 14V0L7.19989 1.2Z'
            fill='#F48018'
        />
        <path
            d='M15.6652 5.3302L16.0001 8.80002L11.313 7.85391'
            fill='#AEB0B3'
        />
        <path
            d='M10 4.612V6.19477C11.015 6.37549 12.044 6.71899 12.7681 7.17933L14.4821 6.0904C13.3142 5.34809 11.6861 4.82153 10 4.612ZM2.42381 9.90245C2.42381 8.13663 4.29542 6.64889 6.8457 6.19477V4.612C2.94416 5.09727 2.28882e-05 7.28059 2.28882e-05 9.90245C2.28882e-05 12.5243 3.08944 14.8261 7.20002 15.2V13.6C4.43388 13.2432 2.42381 11.7656 2.42381 9.90245Z'
            fill='#AEB0B3'
        />
    </svg>
);
