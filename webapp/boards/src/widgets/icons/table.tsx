// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'

import './table.scss'

export default function TableIcon(): JSX.Element {
    return (
        <svg
            width='24'
            height='24'
            viewBox='0 0 24 24'
            fill='currentColor'
            xmlns='http://www.w3.org/2000/svg'
            className='TableIcon Icon'
        >
            <g opacity='0.8'>
                <path
                    fillRule='evenodd'
                    clipRule='evenodd'
                    d='M20 4H10V8L20 8V4ZM8 4V8H4V4H8ZM4 14L4 10H8V14H4ZM4 16L4 20H8V16H4ZM10 16V20H20V16L10 16ZM20 14V10L10 10V14L20 14ZM4 2C2.89543 2 2 2.89543 2 4V20C2 21.1046 2.89543 22 4 22H20C21.1046 22 22 21.1046 22 20V4C22 2.89543 21.1046 2 20 2H4Z'
                    fill='currentColor'
                />
            </g>
        </svg>
    )
}
