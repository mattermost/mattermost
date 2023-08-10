// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import type {CSSProperties} from 'react';

export default function StatusAwayIcon(props: React.HTMLAttributes<HTMLSpanElement>) {
    const {formatMessage} = useIntl();
    return (
        <span {...props}>
            <svg
                width='100%'
                height='100%'
                viewBox='0 0 20 20'
                style={style}
                role='img'
                aria-label={formatMessage({id: 'mobile.set_status.away.icon', defaultMessage: 'Away Icon'})}
            >
                <path
                    className='away--icon'
                    d='M10,0C15.519,0 20,4.481 20,10C20,15.519 15.519,20 10,20C4.481,20 0,15.519 0,10C0,4.481 4.481,0 10,0ZM10.27,3C10.949,3 11.5,3.586 11.5,4.307L11.5,9.379L15.002,12.881C15.492,13.37 15.499,14.158 15.019,14.638L14.638,15.019C14.158,15.499 13.37,15.492 12.881,15.002L8.887,11.008C8.739,10.861 8.636,10.686 8.576,10.501C8.528,10.402 8.5,10.299 8.5,10.193L8.5,4.307C8.5,3.586 9.051,3 9.73,3L10.27,3Z'
                />
            </svg>
        </span>
    );
}

const style: CSSProperties = {
    fillRule: 'evenodd',
    clipRule: 'evenodd',
    strokeLinejoin: 'round',
    strokeMiterlimit: 1.41421,
};
