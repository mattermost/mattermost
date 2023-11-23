// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

export default function LockIcon(props: React.HTMLAttributes<HTMLSpanElement>) {
    const {formatMessage} = useIntl();
    return (
        <span {...props}>
            <svg
                width='12px'
                height='13px'
                viewBox='0 0 13 15'
                role='presentation'
                aria-label={formatMessage({id: 'generic_icons.channel.private', defaultMessage: 'Private Channel Icon'})}
            >
                <g
                    stroke='none'
                    strokeWidth='1'
                    fill='inherit'
                    fillRule='evenodd'
                >
                    <g
                        transform='translate(-116.000000, -175.000000)'
                        fillRule='nonzero'
                        fill='inherit'
                    >
                        <g transform='translate(95.000000, 0.000000)'>
                            <g transform='translate(20.000000, 113.000000)'>
                                <g transform='translate(1.000000, 62.000000)'>
                                    <path d='M12.0714286,6.5 L11.1428571,6.5 L11.1428571,4.64285714 C11.1428571,2.07814286 9.06471429,0 6.5,0 C3.93528571,0 1.85714286,2.07814286 1.85714286,4.64285714 L1.85714286,6.5 L0.928571429,6.5 C0.415071429,6.5 0,7.00792857 0,7.52142857 L0,13.9285714 C0,14.4420714 0.415071429,14.8571429 0.928571429,14.8571429 L12.0714286,14.8571429 C12.5849286,14.8571429 13,14.4420714 13,13.9285714 L13,7.52142857 C13,7.00792857 12.5849286,6.5 12.0714286,6.5 Z M6.5,1.85714286 C8.03585714,1.85714286 9.28571429,3.107 9.28571429,4.64285714 L9.28571429,6.5 L8.35714286,6.5 L4.64285714,6.5 L3.71428571,6.5 L3.71428571,4.64285714 C3.71428571,3.107 4.96414286,1.85714286 6.5,1.85714286 Z'/>
                                </g>
                            </g>
                        </g>
                    </g>
                </g>
            </svg>
        </span>
    );
}
