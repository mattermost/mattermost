// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {HTMLAttributes} from 'react';
import React from 'react';

function GiphyIcon(props: HTMLAttributes<HTMLSpanElement>) {
    return (
        <span {...props}>
            <svg
                xmlns='http://www.w3.org/2000/svg'
                width='16px'
                height='16px'
                viewBox='0 0 20 20'
            >
                <path
                    d='M16 10V18H4V2H7.73654L9.73654 0H2V20H18V8L16 10Z'
                    fill='inherit'
                />
                <path
                    d='M11 0H13.3333V2.33325H15.6667V4.66675H18V7.00008H11V0Z'
                    fill='inherit'
                />
            </svg>
        </span>
    );
}

export default GiphyIcon;
