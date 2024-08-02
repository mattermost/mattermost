// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {CSSProperties} from 'react';
import {useIntl} from 'react-intl';

export default function StatusAwayAvatarIcon(props: React.HTMLAttributes<HTMLSpanElement>) {
    const {formatMessage} = useIntl();
    return (
        <span {...props}>
            <svg
                width='13px'
                height='13px'
                viewBox='0 0 12 12'
                style={style}
                role='img'
                aria-label={formatMessage({id: 'mobile.set_status.away.icon', defaultMessage: 'Away Icon'})}
            >
                <path
                    className='away--icon'
                    d='M9.081,5.712C9.267,5.712 9.417,5.863 9.417,6.048L9.417,9.086L11.864,10.499C12.025,10.592 12.08,10.797 11.987,10.958L11.482,11.832C11.39,11.993 11.184,12.048 11.023,11.955L7.904,10.154C7.788,10.087 7.727,9.961 7.737,9.836C7.736,9.827 7.736,9.818 7.736,9.809L7.736,6.048C7.736,5.863 7.886,5.712 8.072,5.712L9.081,5.712ZM4.812,11.513L4.605,11.513C2.325,11.41 0.253,10.374 0.046,9.027C-0.058,8.923 0.046,8.509 0.046,8.405C0.15,7.576 0.357,6.437 0.771,5.815C0.978,5.401 2.015,5.297 2.015,5.297C2.015,5.297 2.015,7.369 4.605,7.369L5.019,7.369C4.915,7.784 4.812,8.198 4.812,8.612C4.812,9.648 5.226,10.581 5.848,11.41C5.537,11.513 5.123,11.513 4.812,11.513ZM4.605,0.117C6.034,0.117 7.195,1.277 7.195,2.707C7.195,4.136 6.034,5.297 4.605,5.297C3.175,5.297 2.015,4.136 2.015,2.707C2.015,1.277 3.175,0.117 4.605,0.117Z'
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
