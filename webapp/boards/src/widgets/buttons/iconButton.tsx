// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'

import './iconButton.scss'
import {Utils} from 'src/utils'

type Props = {
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
    title?: string
    icon?: React.ReactNode
    className?: string
    size?: string
    inverted?: boolean
    onMouseDown?: (e: React.MouseEvent<HTMLButtonElement>) => void
}

function IconButton(props: Props): JSX.Element {
    const classNames: Record<string, boolean> = {
        IconButton: true,
        'style--inverted': Boolean(props.inverted),
    }
    classNames[`${props.className}`] = Boolean(props.className)
    classNames[`size--${props.size}`] = Boolean(props.size)

    return (
        <button
            type='button'
            onClick={props.onClick}
            onMouseDown={props.onMouseDown}
            className={Utils.generateClassName(classNames)}
            title={props.title}
            aria-label={props.title}
        >
            {props.icon}
        </button>
    )
}

export default React.memo(IconButton)
