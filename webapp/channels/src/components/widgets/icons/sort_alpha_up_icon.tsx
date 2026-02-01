// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

type Props = {
    className?: string;
};

export default function SortAlphaUpIcon({className}: Props) {
    return (
        <svg
            width='16'
            height='16'
            viewBox='0 0 24 24'
            fill='currentColor'
            xmlns='http://www.w3.org/2000/svg'
            className={className}
        >
            <path d='M19,7H22L18,3L14,7H17V21H19M11,13V15L7.67,19H11V21H5V19L8.33,15H5V13M9,3H7C5.9,3 5,3.9 5,5V11H7V9H9V11H11V5C11,3.9 10.11,3 9,3M9,7H7V5H9Z'/>
        </svg>
    );
}
