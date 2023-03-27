// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

export default function LockCircleSolidIcon(props: React.HTMLAttributes<HTMLSpanElement>) {
    const {formatMessage} = useIntl();

    return (
        <span {...props}>
            <svg
                width='40'
                height='40'
                viewBox='0 0 40 40'
                xmlns='http://www.w3.org/2000/svg'
                aria-label={formatMessage({id: 'generic_icons.lock.circleSolid', defaultMessage: 'Lock Circle Solid Icon'})}
            >
                <rect
                    width='40'
                    height='40'
                    rx='20'
                    fillOpacity='0.08'
                />
                <path
                    d='M27.2 29.9104V19.1104H12.8V29.9104H27.2ZM27.2 16.72C27.872 16.72 28.4384 16.9504 28.8992 17.4112C29.36 17.872 29.5904 18.4384 29.5904 19.1104V29.9104C29.5904 30.5824 29.3504 31.1488 28.8704 31.6096C28.4096 32.0896 27.8528 32.3296 27.2 32.3296H12.8C12.1472 32.3296 11.5808 32.0896 11.1008 31.6096C10.64 31.1488 10.4096 30.5824 10.4096 29.9104V19.1104C10.4096 18.4384 10.64 17.872 11.1008 17.4112C11.5808 16.9504 12.1472 16.72 12.8 16.72H14.0096V14.3296C14.0096 13.216 14.2688 12.208 14.7872 11.3056C15.3248 10.384 16.0448 9.65442 16.9472 9.11682C17.8688 8.57922 18.8864 8.31042 20 8.31042C21.1136 8.31042 22.1216 8.57922 23.024 9.11682C23.9456 9.65442 24.6656 10.384 25.184 11.3056C25.7216 12.208 25.9904 13.216 25.9904 14.3296V16.72H27.2ZM20 10.7296C19.328 10.7296 18.7136 10.8928 18.1568 11.2192C17.6192 11.5264 17.1872 11.9584 16.8608 12.5152C16.5536 13.0528 16.4 13.6576 16.4 14.3296V16.72H23.6V14.3296C23.6 13.6576 23.4368 13.0528 23.1104 12.5152C22.8032 11.9584 22.3712 11.5264 21.8144 11.2192C21.2768 10.8928 20.672 10.7296 20 10.7296Z'
                />
            </svg>

        </span>
    );
}
