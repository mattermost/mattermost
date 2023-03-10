// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'

import CompassIcon from './compassIcon'

import './duplicate.scss'

export default function DuplicateIcon(): JSX.Element {
    return (
        <CompassIcon
            icon='content-copy'
            className='content-copy'
        />
    )
}
