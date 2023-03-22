// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

export default function StatusDndAvatarIcon(props: React.HTMLAttributes<HTMLSpanElement>) {
    const {formatMessage} = useIntl();
    return (
        <span {...props}>
            <svg
                x='0px'
                y='0px'
                width='13px'
                height='13px'
                viewBox='-299 391 12 12'
                enableBackground='new -299 391 12 12'
                role='img'
                aria-label={formatMessage({id: 'mobile.set_status.dnd.icon', defaultMessage: 'Do Not Disturb Icon'})}
            >
                <g>
                    <ellipse
                        className='dnd--icon'
                        cx='-294.6'
                        cy='394'
                        rx='2.5'
                        ry='2.5'
                    />
                    <path
                        className='dnd--icon'
                        d='M-293.8,399.4c0-0.4,0.1-0.7,0.2-1c-0.3,0.1-0.6,0.2-1,0.2c-2.5,0-2.5-2-2.5-2s-1,0.1-1.2,0.5c-0.4,0.6-0.6,1.7-0.7,2.5 c0,0.1-0.1,0.5,0,0.6c0.2,1.3,2.2,2.3,4.4,2.4c0,0,0.1,0,0.1,0c0,0,0.1,0,0.1,0c0.7,0,1.4-0.1,2-0.3 C-293.3,401.5-293.8,400.5-293.8,399.4z'
                    />
                </g>
                <path
                    className='dnd--icon'
                    d='M-287,400c0,0.1-0.1,0.1-0.1,0.1l-4.9,0c-0.1,0-0.1-0.1-0.1-0.1v-1.6c0-0.1,0.1-0.1,0.1-0.1l4.9,0c0.1,0,0.1,0.1,0.1,0.1 V400z'
                />
            </svg>
        </span>
    );
}
