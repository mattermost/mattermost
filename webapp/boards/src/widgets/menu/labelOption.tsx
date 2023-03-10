// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'

import './labelOption.scss'

type LabelOptionProps = {
    icon?: string
    children: React.ReactNode
}

function LabelOption(props: LabelOptionProps): JSX.Element {
    return (
        <div className='MenuOption LabelOption menu-option'>
            {props.icon ?? <div className='noicon'/>}
            <div className='menu-name'>{props.children}</div>
            <div className='noicon'/>
        </div>
    )
}

export default React.memo(LabelOption)
