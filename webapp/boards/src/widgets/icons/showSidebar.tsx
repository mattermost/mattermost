// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'

import './showSidebar.scss'

export default function ShowSidebarIcon(): JSX.Element {
    return (
        <svg
            xmlns='http://www.w3.org/2000/svg'
            className='ShowSidebarIcon Icon'
            viewBox='0 0 100 100'
        >
            <polyline points='20,20 50,50 20,80'/>
            <polyline points='50,20 80,50, 50,80'/>
        </svg>
    )
}
