// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

export default function LoginOpenIdIcon(props: React.HTMLAttributes<HTMLSpanElement>) {
    const {formatMessage} = useIntl();

    return (
        <span {...props}>
            <svg
                width='16'
                height='16'
                viewBox='0 0 16 16'
                fill='none'
                xmlns='http://www.w3.org/2000/svg'
                aria-label={formatMessage({id: 'generic_icons.login.openid', defaultMessage: 'OpenID Icon'})}
            >
                <path
                    d='M7.19995 1.2V15.2L9.59995 14V0L7.19995 1.2Z'
                    fill='#F48018'
                />
                <path
                    d='M15.6652 5.3302L16.0001 8.80002L11.313 7.85391'
                    fill='#AEB0B3'
                />
                <path
                    d='M10 4.61206V6.19484C11.015 6.37555 12.0439 6.71905 12.768 7.17939L14.4821 6.09046C13.3141 5.34815 11.686 4.82159 10 4.61206ZM2.42378 9.90251C2.42378 8.13669 4.2954 6.64895 6.84567 6.19484V4.61206C2.94414 5.09733 0 7.28065 0 9.90251C0 12.5244 3.08942 14.8262 7.2 15.2V13.6001C4.43386 13.2433 2.42378 11.7657 2.42378 9.90251Z'
                    fill='#AEB0B3'
                />
            </svg>

        </span>
    );
}
