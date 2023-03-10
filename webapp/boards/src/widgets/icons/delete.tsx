// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'

import CompassIcon from './compassIcon'

import './delete.scss'

export default function DeleteIcon(): JSX.Element {
    return (
        <CompassIcon
            icon='trash-can-outline'
            className='DeleteIcon trash-can-outline'
        />
    )
}
