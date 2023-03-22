// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'

import {Utils} from 'src/utils'

import IconButton from 'src/widgets/buttons/iconButton'
import CloseIcon from 'src/widgets/icons/close'
import Tooltip from 'src/widgets/tooltip'

import './notificationBox.scss'

type Props = {
    title: string
    icon?: React.ReactNode
    children?: React.ReactNode
    onClose?: () => void
    closeTooltip?: string
    className?: string
}

function renderClose(onClose?: () => void, closeTooltip?: string) {
    if (!onClose) {
        return null
    }

    if (closeTooltip) {
        return (
            <Tooltip title={closeTooltip}>
                <IconButton
                    icon={<CloseIcon/>}
                    onClick={onClose}
                />
            </Tooltip>
        )
    }

    return (
        <IconButton
            icon={<CloseIcon/>}
            onClick={onClose}
        />
    )
}

function NotificationBox(props: Props): JSX.Element {
    const className = Utils.generateClassName({
        NotificationBox: true,
        [props.className || '']: Boolean(props.className),
    })

    return (
        <div className={className}>
            {props.icon &&
                <div className='NotificationBox__icon'>
                    {props.icon}
                </div>}
            <div className='content'>
                <p className='title'>{props.title}</p>
                {props.children}
            </div>
            {renderClose(props.onClose, props.closeTooltip)}
        </div>
    )
}

export default React.memo(NotificationBox)
