// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

export default function LoginGoggleIcon(props: React.HTMLAttributes<HTMLSpanElement>) {
    const {formatMessage} = useIntl();

    return (
        <span {...props}>
            <svg
                width='17'
                height='16'
                viewBox='0 0 17 16'
                fill='none'
                xmlns='http://www.w3.org/2000/svg'
                aria-label={formatMessage({id: 'generic_icons.login.google', defaultMessage: 'Google Icon'})}
            >
                <path
                    fillRule='evenodd'
                    clipRule='evenodd'
                    d='M15.5787 8.16364C15.5787 7.6531 15.5329 7.16219 15.4478 6.69092H8.66675V9.47601H12.5417C12.3747 10.376 11.8675 11.1386 11.1049 11.6491V13.4556H13.4318C14.7933 12.2022 15.5787 10.3564 15.5787 8.16364Z'
                    fill='#4285F4'
                />
                <path
                    fillRule='evenodd'
                    clipRule='evenodd'
                    d='M8.66685 15.2C10.6108 15.2 12.2407 14.5553 13.4319 13.4557L11.105 11.6491C10.4603 12.0811 9.63558 12.3364 8.66685 12.3364C6.79158 12.3364 5.2043 11.0699 4.63812 9.36804H2.23267V11.2335C3.41739 13.5866 5.8523 15.2 8.66685 15.2Z'
                    fill='#34A853'
                />
                <path
                    fillRule='evenodd'
                    clipRule='evenodd'
                    d='M4.63807 9.36806C4.49407 8.93606 4.41225 8.4746 4.41225 8.00006C4.41225 7.52551 4.49407 7.06406 4.63807 6.63206V4.7666H2.23261C1.74498 5.7386 1.4668 6.83824 1.4668 8.00006C1.4668 9.16187 1.74498 10.2615 2.23261 11.2335L4.63807 9.36806Z'
                    fill='#FBBC05'
                />
                <path
                    fillRule='evenodd'
                    clipRule='evenodd'
                    d='M8.66685 3.66369C9.72394 3.66369 10.673 4.02696 11.4192 4.74041L13.4843 2.67532C12.2374 1.5135 10.6076 0.800049 8.66685 0.800049C5.8523 0.800049 3.41739 2.4135 2.23267 4.76659L4.63812 6.63205C5.2043 4.93023 6.79158 3.66369 8.66685 3.66369Z'
                    fill='#EA4335'
                />
            </svg>
        </span>
    );
}
