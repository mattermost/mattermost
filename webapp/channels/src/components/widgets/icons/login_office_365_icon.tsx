// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

export default function LoginOffice365Icon(props: React.HTMLAttributes<HTMLSpanElement>) {
    const {formatMessage} = useIntl();

    return (
        <span {...props}>
            <svg
                width='16'
                height='16'
                viewBox='0 0 16 16'
                fill='none'
                xmlns='http://www.w3.org/2000/svg'
                aria-label={formatMessage({id: 'generic_icons.login.oneLogin', defaultMessage: 'One Login Icon'})}
            >
                <path
                    d='M1.25 12.5V3.50005L10.25 0.872048L14.75 2.00605V13.616L9.872 15.128L2.006 12.5L10.25 13.616V2.74405L4.256 4.25605V11.366L1.25 12.5Z'
                    fill='#DC3C00'
                />
            </svg>
        </span>
    );
}
