// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'

import './hideSidebar.scss'

export default function HideSidebarIcon(): JSX.Element {
    return (
        <svg
            xmlns='http://www.w3.org/2000/svg'
            className='HideSidebarIcon Icon'
            viewBox='0 0 100 100'
        >
            <polyline points='80,20 50,50 80,80'/>
            <polyline points='50,20 20,50, 50,80'/>
        </svg>
    )
}
