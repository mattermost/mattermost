// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

export default function MenuIcon(props: React.HTMLAttributes<HTMLSpanElement>) {
    const {formatMessage} = useIntl();
    return (
        <span {...props}>
            <svg
                width='20'
                height='20'
                viewBox='0 0 24 24'
                version='1.1'
                role='img'
                aria-label={formatMessage({id: 'generic_icons.menu', defaultMessage: 'Menu Icon'})}
            >
                <path d='M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z'/>
            </svg>
        </span>
    );
}
