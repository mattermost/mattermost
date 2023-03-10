// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {useIntl} from 'react-intl'

import {MenuOptionProps} from './menuItem'

import './colorOption.scss'

type ColorOptionProps = MenuOptionProps & {
    icon?: React.ReactNode
}

function ColorOption(props: ColorOptionProps): JSX.Element {
    const {id, name, icon} = props
    const intl = useIntl()
    return (
        <div
            role='button'
            aria-label={intl.formatMessage({id: 'ColorOption.selectColor', defaultMessage: 'Select {color} Color'}, {color: name})}
            className='MenuOption ColorOption menu-option'
            onClick={(e: React.MouseEvent): void => {
                e.target.dispatchEvent(new Event('menuItemClicked'))
                props.onClick(props.id)
                e.stopPropagation()
            }}
        >
            {icon ?? <div className='noicon'/>}
            <div className='menu-name'>{name}</div>
            <div className={`menu-colorbox ${id}`}/>
        </div>
    )
}

export default React.memo(ColorOption)
