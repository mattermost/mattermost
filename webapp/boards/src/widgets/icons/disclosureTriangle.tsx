// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'

import './disclosureTriangle.scss'

export default function DisclosureTriangle(): JSX.Element {
    return (
        <svg
            xmlns='http://www.w3.org/2000/svg'
            className='DisclosureTriangleIcon Icon'
            viewBox='0 0 100 100'
        >
            <polygon points='37,35 37,65 63,50'/>
        </svg>
    )
}
