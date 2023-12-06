// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

export default function UnreadAboveIcon(props: React.HTMLAttributes<HTMLSpanElement>) {
    const {formatMessage} = useIntl();
    return (
        <span
            {...props}
        >
            {/* TODO: should replace transform css to svg */}
            <svg
                style={{transform: 'scaleY(-1)'}}
                xmlns='http://www.w3.org/2000/svg'
                width='16'
                height='16'
                viewBox='0 0 16 16'
                role='img'
                aria-label={formatMessage({id: 'generic_icons.arrow.up', defaultMessage: 'Up Arrow Icon'})}
            >
                <path d='M8.696 2H7.184V11L3.062 6.878L2 7.94L7.94 13.88L13.88 7.94L12.818 6.878L8.696 11V2Z'/>
            </svg>
        </span>
    );
}
