// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'

import './button.scss'
import {Utils} from 'src/utils'

type Props = {
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
    onMouseOver?: (e: React.MouseEvent<HTMLButtonElement>) => void
    onMouseLeave?: (e: React.MouseEvent<HTMLButtonElement>) => void
    onBlur?: (e: React.FocusEvent<HTMLButtonElement>) => void
    children?: React.ReactNode
    title?: string
    icon?: React.ReactNode
    filled?: boolean
    active?: boolean
    submit?: boolean
    emphasis?: string
    size?: string
    danger?: boolean
    className?: string
    rightIcon?: boolean
    disabled?: boolean
}

function Button(props: Props): JSX.Element {
    const classNames: Record<string, boolean> = {
        Button: true,
        active: Boolean(props.active),
        filled: Boolean(props.filled),
        danger: Boolean(props.danger),
    }
    classNames[`emphasis--${props.emphasis}`] = Boolean(props.emphasis)
    classNames[`size--${props.size}`] = Boolean(props.size)
    classNames[`${props.className}`] = Boolean(props.className)

    return (
        <button
            type={props.submit ? 'submit' : 'button'}
            onClick={props.onClick}
            onMouseOver={props.onMouseOver}
            onMouseLeave={props.onMouseLeave}
            className={Utils.generateClassName(classNames)}
            title={props.title}
            onBlur={props.onBlur}
            disabled={props?.disabled}
        >
            {!props.rightIcon && props.icon}
            <span>{props.children}</span>
            {props.rightIcon && props.icon}
        </button>
    )
}

export default React.memo(Button)
