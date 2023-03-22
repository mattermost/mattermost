// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'

import DropdownIcon from 'src/widgets/icons/dropdown'
import MenuWrapper from 'src/widgets/menuWrapper'

import './buttonWithMenu.scss'

type Props = {
    onClick?: (e: React.MouseEvent<HTMLDivElement>) => void
    children?: React.ReactNode
    title?: string
    text: React.ReactNode
}

function ButtonWithMenu(props: Props): JSX.Element {
    return (
        <div
            onClick={props.onClick}
            className='ButtonWithMenu'
            title={props.title}
        >
            <div className='button-text'>
                {props.text}
            </div>
            <MenuWrapper stopPropagationOnToggle={true}>
                <div className='button-dropdown'>
                    <DropdownIcon/>
                </div>
                {props.children}
            </MenuWrapper>
        </div>
    )
}

export default React.memo(ButtonWithMenu)
