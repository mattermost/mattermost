// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

export default function MenuIcon(props: React.HTMLAttributes<HTMLSpanElement>) {
    const {formatMessage} = useIntl();
    return (
        <span {...props}>
            <svg
                width='16px'
                height='10px'
                viewBox='0 0 16 10'
                version='1.1'
                role='img'
                aria-label={formatMessage({id: 'generic_icons.menu', defaultMessage: 'Menu Icon'})}
            >
                <g
                    stroke='none'
                    strokeWidth='1'
                    fill='inherit'
                    fillRule='evenodd'
                >
                    <g
                        transform='translate(-188.000000, -38.000000)'
                        fillRule='nonzero'
                        fill='inherit'
                    >
                        <g>
                            <g>
                                <g transform='translate(188.000000, 38.000000)'>
                                    <path d='M15.5,0 C15.776,0 16,0.224 16,0.5 L16,1.5 C16,1.776 15.776,2 15.5,2 L0.5,2 C0.224,2 0,1.776 0,1.5 L0,0.5 C0,0.224 0.224,0 0.5,0 L15.5,0 Z M15.5,4 C15.776,4 16,4.224 16,4.5 L16,5.5 C16,5.776 15.776,6 15.5,6 L0.5,6 C0.224,6 0,5.776 0,5.5 L0,4.5 C0,4.224 0.224,4 0.5,4 L15.5,4 Z M15.5,8 C15.776,8 16,8.224 16,8.5 L16,9.5 C16,9.776 15.776,10 15.5,10 L0.5,10 C0.224,10 0,9.776 0,9.5 L0,8.5 C0,8.224 0.224,8 0.5,8 L15.5,8 Z'/>
                                </g>
                            </g>
                        </g>
                    </g>
                </g>
            </svg>
        </span>
    );
}
