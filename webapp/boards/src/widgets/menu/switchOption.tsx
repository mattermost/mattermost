// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'

import Switch from 'src/widgets/switch'

import {MenuOptionProps} from './menuItem'

type SwitchOptionProps = MenuOptionProps & {
    isOn: boolean
    icon?: React.ReactNode
    suppressItemClicked?: boolean
}

function SwitchOption(props: SwitchOptionProps): JSX.Element {
    const {name, icon, isOn, suppressItemClicked} = props

    return (
        <div
            className='MenuOption SwitchOption menu-option'
            role='button'
            aria-label={name}
            onClick={(e: React.MouseEvent) => {
                if (!suppressItemClicked) {
                    e.target.dispatchEvent(new Event('menuItemClicked'))
                }
                props.onClick(props.id)
                e.stopPropagation()
            }}
        >
            {icon ? <div className='menu-option__icon'>{icon}</div> : <div className='noicon'/>}
            <div className='menu-name'>{name}</div>
            <Switch
                isOn={isOn}
                onChanged={() => {}}
            />
        </div>
    )
}

export default React.memo(SwitchOption)
