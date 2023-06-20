// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useRef} from 'react'
import {useIntl} from 'react-intl'
import {useHotkeys} from 'react-hotkeys-hook'

import IconButton from 'src/widgets/buttons/iconButton'
import CloseIcon from 'src/widgets/icons/close'
import OptionsIcon from 'src/widgets/icons/options'
import MenuWrapper from 'src/widgets/menuWrapper'
import './dialog.scss'

type Props = {
    children: React.ReactNode
    size?: string
    toolsMenu?: React.ReactNode // some dialogs may not  require a toolmenu
    toolbar?: React.ReactNode
    hideCloseButton?: boolean
    className?: string
    title?: JSX.Element
    subtitle?: JSX.Element
    onClose: () => void
}

const Dialog = (props: Props) => {
    const {toolsMenu, toolbar, title, subtitle, size} = props
    const intl = useIntl()

    const closeDialogText = intl.formatMessage({
        id: 'Dialog.closeDialog',
        defaultMessage: 'Close dialog',
    })

    useHotkeys('esc', () => props.onClose())

    const isBackdropClickedRef = useRef(false)

    return (
        <div className={`Dialog dialog-back ${props.className} size--${size || 'medium'}`}>
            <div className='backdrop'/>
            <div
                className='wrapper'
                onClick={(e) => {
                    e.stopPropagation()
                    if (!isBackdropClickedRef.current) {
                        return
                    }
                    isBackdropClickedRef.current = false
                    props.onClose()
                }}
                onMouseDown={(e) => {
                    if (e.target === e.currentTarget) {
                        isBackdropClickedRef.current = true
                    }
                }}
            >
                <div
                    role='dialog'
                    className='dialog'
                >
                    <div className='toolbar'>
                        <div>
                            {<h1 className='dialog-title'>{title || ''}</h1>}
                            {subtitle && <h5 className='dialog-subtitle'>{subtitle}</h5>}
                        </div>
                        <div className='toolbar--right'>
                            {toolbar && <div className='d-flex'>{toolbar}</div>}
                            {toolsMenu && <MenuWrapper>
                                <IconButton
                                    size='medium'
                                    icon={<OptionsIcon/>}
                                />
                                {toolsMenu}
                            </MenuWrapper>
                            }
                            {
                                !props.hideCloseButton &&
                                <IconButton
                                    className='dialog__close'
                                    onClick={props.onClose}
                                    icon={<CloseIcon/>}
                                    title={closeDialogText}
                                    size='medium'
                                />
                            }
                        </div>
                    </div>
                    {props.children}
                </div>
            </div>
        </div>
    )
}

export default React.memo(Dialog)
