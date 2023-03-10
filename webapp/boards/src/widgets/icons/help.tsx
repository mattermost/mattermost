// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'

import CompassIcon from './compassIcon'

import './help.scss'

export default function HelpIcon(): JSX.Element {
    return (
        <CompassIcon
            icon='help-circle-outline'
            className='HelpIcon'
        />
    )
}
