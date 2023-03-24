// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

export default function FlagIcon(props: React.HTMLAttributes<HTMLSpanElement>) {
    const {formatMessage} = useIntl();
    return (
        <span {...props}>
            <svg
                width='16px'
                height='16px'
                viewBox='0 0 16 16'
                role='img'
                aria-label={formatMessage({id: 'generic_icons.flag', defaultMessage: 'Flag Icon'})}
            >
                <path d='M11.744 12.5L8 10.862L4.256 12.5V2.74405H11.744V12.5ZM11.744 1.25005H4.256C3.836 1.25005 3.476 1.40005 3.176 1.70005C2.888 1.98805 2.744 2.33605 2.744 2.74405V14.75L8 12.5L13.256 14.75V2.74405C13.256 2.33605 13.106 1.98805 12.806 1.70005C12.518 1.40005 12.164 1.25005 11.744 1.25005Z'/>
            </svg>
        </span>
    );
}
