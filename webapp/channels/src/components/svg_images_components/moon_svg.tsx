// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

type Props = {
    title?: string;
    className?: string;
}

export default function Moon(props: Props) {
    return (
        <span
            title={props.title}
            className={props.className}
        >
            <svg
                width='24px'
                height='24px'
                viewBox='0 0 24 24'
                version='1.1'
                role='img'
            >
                <path d='M18.73,18C15.4,21.69 9.71,22 6,18.64C2.33,15.31 2.04,9.62 5.37,5.93C6.9,4.25 9,3.2 11.27,3C7.96,6.7 8.27,12.39 12,15.71C13.63,17.19 15.78,18 18,18C18.25,18 18.5,18 18.73,18Z'/>
            </svg>
        </span>
    );
}
