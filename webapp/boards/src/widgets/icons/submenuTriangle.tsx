// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'

import './submenuTriangle.scss'

export default function SubmenuTriangleIcon(): JSX.Element {
    return (
        <svg
            xmlns='http://www.w3.org/2000/svg'
            className='SubmenuTriangleIcon Icon'
            viewBox='0 0 100 100'
        >
            <polygon points='50,35 75,50 50,65'/>
        </svg>
    )
}
