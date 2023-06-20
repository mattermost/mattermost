// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'

import './sortDown.scss'

export default function SortDownIcon(): JSX.Element {
    return (
        <svg
            xmlns='http://www.w3.org/2000/svg'
            className='SortDownIcon Icon'
            viewBox='0 0 100 100'
        >
            <polyline points='50,20 50,80'/>
            <polyline points='30,60 50,80 70,60'/>
        </svg>
    )
}
