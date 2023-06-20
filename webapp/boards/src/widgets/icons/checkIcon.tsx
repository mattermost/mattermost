// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'

import CompassIcon from './compassIcon'

// TODO use this icon instead of check.tsx
export default function Check(): JSX.Element {
    return (
        <CompassIcon
            icon='check'
            className='CheckIconCompass'
        />
    )
}
