// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {SVGAttributes} from 'react';

type Props = SVGAttributes<SVGElement> & {
    className?: string;
};

const ClockSendIcon = ({className, ...props}: Props) => (
    <svg
        width='18px'
        height='18px'
        viewBox='0 0 24 24'
        xmlns='http://www.w3.org/2000/svg'
        className={className}
        {...props}
    >
        <g
            fill='none'
            stroke='currentColor'
            strokeWidth='1.6'
            strokeLinecap='round'
            strokeLinejoin='round'
        >
            <path d='M3 12a9 9 0 1 0 18 0a9 9 0 0 0-18 0'/>
            <path d='M12 7v5l3 3'/>
        </g>
    </svg>
);

export default ClockSendIcon;
