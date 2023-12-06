// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

export default function CheckCircleIcon(props: React.HTMLAttributes<HTMLSpanElement>) {
    const {formatMessage} = useIntl();

    return (
        <span {...props}>
            <svg
                width='22'
                height='22'
                viewBox='0 0 22 22'
                xmlns='http://www.w3.org/2000/svg'
                aria-label={formatMessage({id: 'generic_icons.check.circle', defaultMessage: 'Check Circle Icon'})}
            >
                <path
                    d='M11 0.992024C9.192 0.992024 7.512 1.44802 5.96 2.36002C4.44 3.24002 3.24 4.44002 2.36 5.96002C1.448 7.51202 0.992 9.19202 0.992 11C0.992 12.808 1.448 14.488 2.36 16.04C3.24 17.56 4.44 18.76 5.96 19.64C7.512 20.552 9.192 21.008 11 21.008C12.808 21.008 14.488 20.552 16.04 19.64C17.56 18.76 18.76 17.56 19.64 16.04C20.552 14.488 21.008 12.808 21.008 11C21.008 9.19202 20.552 7.51202 19.64 5.96002C18.76 4.44002 17.56 3.24002 16.04 2.36002C14.488 1.44802 12.808 0.992024 11 0.992024ZM9.248 15.68L7.832 14.288L5 11.456L6.416 10.04L9.248 12.872L15.608 6.48802L17.024 7.90402L9.248 15.68Z'
                />
            </svg>
        </span>
    );
}
