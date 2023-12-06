// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

export default function MailPlusIcon(props: React.HTMLAttributes<HTMLSpanElement>) {
    const {formatMessage} = useIntl();
    return (
        <span {...props}>
            <svg
                width='24px'
                height='24px'
                viewBox='0 0 24 24'
                role='img'
                aria-label={formatMessage({id: 'generic_icons.add-mail', defaultMessage: 'Add Mail Icon'})}
            >
                <path d='M3,4C1.89,4 1,4.89 1,6V18A2,2 0 0,0 3,20H14V18H3V8.37L11,13.36L19,8.37V13H21V6A2,2 0 0,0 19,4H3M3,6H19L11,11L3,6M19,15V18H16V20H19V23H21V20H24V18H21V15H19Z'/>
            </svg>
        </span>
    );
}
