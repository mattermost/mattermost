// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'

import {Constants} from 'src/constants'

import './label.scss'

type Props = {
    color?: string
    title?: string
    children: React.ReactNode
    className?: string
}

// Switch is an on-off style switch / checkbox
function Label(props: Props): JSX.Element {
    let color = 'empty'
    if (props.color && props.color in Constants.menuColors) {
        color = props.color
    }
    return (
        <span
            className={`Label ${color} ${props.className ? props.className : ''}`}
            title={props.title}
        >
            {props.children}
        </span>
    )
}

export default React.memo(Label)
