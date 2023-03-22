// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

export default function UnarchiveIcon(props: React.HTMLAttributes<HTMLSpanElement>) {
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
                <path d='M13.994 14.75H2.006V6.50605H3.5V13.256H12.5V6.50605H13.994V14.75ZM1.25 1.25005H14.75V5.75005H1.25V1.25005ZM2.744 2.74405V4.25605H13.256V2.74405H2.744ZM6.884 11.744V9.49405H4.994L8 6.50605L11.006 9.49405H9.134V11.744H6.884Z'/>
            </svg>
        </span>
    );
}
