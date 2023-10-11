// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

export default function ArchiveIcon(props: React.HTMLAttributes<HTMLSpanElement>) {
    const {formatMessage} = useIntl();
    return (
        <span {...props}>
            <svg
                width='16px'
                height='16px'
                viewBox='0 0 16 16'
                role='img'
                aria-label={formatMessage({id: 'generic_icons.archive', defaultMessage: 'Archive Icon'})}
            >
                <path d='M13.994 14.75H2.006V6.50599H3.5V13.256H12.5V6.50599H13.994V14.75ZM1.25 1.24999H14.75V5.74999H1.25V1.24999ZM6.128 7.24399H9.872C9.98 7.24399 10.07 7.27999 10.142 7.35199C10.214 7.42399 10.25 7.51399 10.25 7.62199V8.75599H5.75V7.62199C5.75 7.51399 5.786 7.42399 5.858 7.35199C5.93 7.27999 6.02 7.24399 6.128 7.24399ZM2.744 2.74399V4.25599H13.256V2.74399H2.744Z'/>
            </svg>
        </span>
    );
}

