// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'

import './logo.scss'
import CompassIcon from './compassIcon'

export default React.forwardRef<HTMLElement>((_, ref) => {
    return (
        <CompassIcon
            ref={ref}
            data-testid='boardsIcon'
            icon='product-boards'
            className='boards-rhs-icon'
        />
    )
})
