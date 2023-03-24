// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'

import './divider.scss'

export default function DividerIcon(): JSX.Element {
    return (
        <svg
            xmlns='http://www.w3.org/2000/svg'
            className='DividerIcon Icon'
            viewBox='0 0 448 512'
        >
            <path
                d='M 432,224 H 16 c -8.836556,0 -16,7.16344 -16,16 v 32 c 0,8.83656 7.163444,16 16,16 h 416 c 8.83656,0 16,-7.16344 16,-16 v -32 c 0,-8.83656 -7.16344,-16 -16,-16 z'
            />
        </svg>
    )
}
