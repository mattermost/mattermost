// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'

import {MenuOptionProps} from './menuItem'

type TextOptionProps = MenuOptionProps & {
    check?: boolean
    icon?: React.ReactNode
    rightIcon?: React.ReactNode
    className?: string
    subText?: string
    disabled?: boolean
}

function TextOption(props: TextOptionProps): JSX.Element {
    const {name, icon, rightIcon, check, subText, disabled} = props
    let className = 'MenuOption TextOption menu-option'
    if (props.className) {
        className += ' ' + props.className
    }
    if (subText) {
        className += ' menu-option--with-subtext'
    }
    if (disabled) {
        className += ' menu-option--disabled'
    }

    return (
        <div
            role='button'
            aria-label={name}
            className={className}
            onClick={(e: React.MouseEvent) => {
                e.target.dispatchEvent(new Event('menuItemClicked'))
                props.onClick(props.id)
                e.stopPropagation()
            }}
        >
            <div className={`${check ? 'd-flex menu-option__check' : 'd-flex'}`}>{icon ? <div className='menu-option__icon'>{icon}</div> : <div className='noicon'/>}</div>
            <div className='menu-option__content'>
                <div className='menu-name'>{name}</div>
                {subText && <div className='menu-subtext text-75 mt-1'>{subText}</div>}
            </div>
            {rightIcon ?? <div className='noicon'/>}
        </div>
    )
}

export default React.memo(TextOption)
