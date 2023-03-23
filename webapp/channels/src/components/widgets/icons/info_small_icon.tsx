// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

export default function InfoSmallIcon(props: React.HTMLAttributes<HTMLSpanElement>) {
    const {formatMessage} = useIntl();
    return (
        <span {...props}>
            <svg
                className='svg-text-color'
                aria-label={formatMessage({id: 'generic_icons.info', defaultMessage: 'Info Icon'})}
                width='24px'
                height='24px'
                viewBox='0 0 24 24'
                version='1.1'
            >
                <g
                    stroke='none'
                    strokeWidth='1'
                    fill='inherit'
                    fillRule='evenodd'
                >
                    <g
                        transform='translate(-1015.000000, -516.000000)'
                        fill='inherit'
                    >
                        <path d='M1027,540 C1020.37258,540 1015,534.627417 1015,528 C1015,521.372583 1020.37258,516 1027,516 C1033.62742,516 1039,521.372583 1039,528 C1039,534.627417 1033.62742,540 1027,540 Z M1027,527 C1025.89543,527 1025,527.895431 1025,529 L1025,533 C1025,534.104569 1025.89543,535 1027,535 C1028.10457,535 1029,534.104569 1029,533 L1029,529 C1029,527.895431 1028.10457,527 1027,527 Z M1027,525 C1028.10457,525 1029,524.104569 1029,523 C1029,521.895431 1028.10457,521 1027,521 C1025.89543,521 1025,521.895431 1025,523 C1025,524.104569 1025.89543,525 1027,525 Z'/>
                    </g>
                </g>
            </svg>
        </span>
    );
}
