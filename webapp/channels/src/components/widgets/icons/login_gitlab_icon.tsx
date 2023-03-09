// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

export default function LoginGitlabIcon(props: React.HTMLAttributes<HTMLSpanElement>) {
    const {formatMessage} = useIntl();

    return (
        <span {...props}>
            <svg
                width='17'
                height='16'
                viewBox='0 0 17 16'
                fill='none'
                xmlns='http://www.w3.org/2000/svg'
                aria-label={formatMessage({id: 'generic_icons.login.gitlab', defaultMessage: 'Gitlab Icon'})}
            >
                <path
                    fillRule='evenodd'
                    clipRule='evenodd'
                    d='M8.83325 15.4909L11.7793 6.45337H5.88745L8.83334 15.4909H8.83325Z'
                    fill='#E24329'
                />
                <path
                    fillRule='evenodd'
                    clipRule='evenodd'
                    d='M8.83339 15.4909L5.88737 6.45337H1.75854L8.83347 15.4908L8.83339 15.4909Z'
                    fill='#FC6D26'
                />
                <path
                    fillRule='evenodd'
                    clipRule='evenodd'
                    d='M1.75846 6.45329L0.863125 9.19966C0.781518 9.45021 0.870921 9.72467 1.08477 9.87941L8.83325 15.4908L1.75846 6.45325V6.45329Z'
                    fill='#FCA326'
                />
                <path
                    fillRule='evenodd'
                    clipRule='evenodd'
                    d='M1.75859 6.45333H5.88742L4.11296 1.01011C4.02169 0.73003 3.62418 0.73003 3.53296 1.01011L1.75854 6.45333H1.75859Z'
                    fill='#E24329'
                />
                <path
                    fillRule='evenodd'
                    clipRule='evenodd'
                    d='M8.83325 15.4909L11.7793 6.45337H15.9081L8.83334 15.4908L8.83325 15.4909Z'
                    fill='#FC6D26'
                />
                <path
                    fillRule='evenodd'
                    clipRule='evenodd'
                    d='M15.908 6.45329L16.8034 9.19966C16.885 9.45021 16.7956 9.72467 16.5817 9.87941L8.83325 15.4908L15.908 6.45325V6.45329Z'
                    fill='#FCA326'
                />
                <path
                    fillRule='evenodd'
                    clipRule='evenodd'
                    d='M15.9081 6.45333H11.7793L13.5538 1.01011C13.6451 0.73003 14.0426 0.73003 14.1338 1.01011L15.9082 6.45333H15.9081Z'
                    fill='#E24329'
                />
            </svg>
        </span>
    );
}
