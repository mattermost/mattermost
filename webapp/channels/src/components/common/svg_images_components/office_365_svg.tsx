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
            d='M1.25003 12.5V3.50005L10.25 0.872048L14.75 2.00605V13.616L9.87203 15.128L2.00603 12.5L10.25 13.616V2.74405L4.25603 4.25605V11.366L1.25003 12.5Z'
            fill='#DC3C00'
        />
    </svg>
);
