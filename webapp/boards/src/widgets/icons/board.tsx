// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'

import './board.scss'

export default function BoardIcon(): JSX.Element {
    return (
        <svg
            width='24'
            height='24'
            viewBox='0 0 24 24'
            fill='currentColor'
            xmlns='http://www.w3.org/2000/svg'
            className='BoardIcon Icon'
        >
            <g opacity='0.8'>
                <path
                    fillRule='evenodd'
                    clipRule='evenodd'
                    d='M4 4H20V20H4V4ZM2 4C2 2.89543 2.89543 2 4 2H20C21.1046 2 22 2.89543 22 4V20C22 21.1046 21.1046 22 20 22H4C2.89543 22 2 21.1046 2 20V4ZM8 6H6V12H8V6ZM11 6H13V16H11V6ZM18 6H16V9H18V6Z'
                    fill='currentColor'
                />
            </g>
        </svg>
    )
}
