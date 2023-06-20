// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'

import CompassIcon from './compassIcon'

import './dropdown.scss'

export default function DropdownIcon(): JSX.Element {
    return (
        <CompassIcon
            icon='chevron-down'
            className='DropdownIcon'
        />
    )
}
