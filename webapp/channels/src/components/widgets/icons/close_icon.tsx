// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

export default function CloseIcon(props: React.HTMLAttributes<HTMLSpanElement>) {
    const {formatMessage} = useIntl();
    return (
        <span {...props}>
            <svg
                width='24px'
                height='24px'
                viewBox='0 0 24 24'
                role='img'
                aria-label={formatMessage({id: 'generic_icons.close', defaultMessage: 'Close Icon'})}
            >
                <path
                    fillRule='nonzero'
                    d='M18 7.209L16.791 6 12 10.791 7.209 6 6 7.209 10.791 12 6 16.791 7.209 18 12 13.209 16.791 18 18 16.791 13.209 12z'
                />
            </svg>
        </span>
    );
}
