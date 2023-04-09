// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ReactNode} from 'react'
import {useIntl} from 'react-intl'

import DeleteIcon from 'src/widgets/icons/delete'
import Menu from 'src/widgets/menu'
import BoardPermissionGate from 'src/components/permissions/boardPermissionGate'
import DuplicateIcon from 'src/widgets/icons/duplicate'
import LinkIcon from 'src/widgets/icons/Link'
import {Utils} from 'src/utils'
import {Permission} from 'src/constants'
import {sendFlashMessage} from 'src/components/flashMessages'
import {IUser} from 'src/user'
import {getMe} from 'src/store/users'
import {useAppSelector} from 'src/store/hooks'
import TelemetryClient, {TelemetryActions, TelemetryCategory} from 'src/telemetry/telemetryClient'

type Props = {
    cardId: string
    boardId: string
    onClickDelete: () => void
    onClickDuplicate?: () => void
    children?: ReactNode
}

export const CardActionsMenu = (props: Props): JSX.Element => {
    const {cardId} = props

    const me = useAppSelector<IUser|null>(getMe)
    const intl = useIntl()

    const handleDeleteCard = () => {
        TelemetryClient.trackEvent(TelemetryCategory, TelemetryActions.DeleteCard, {board: props.boardId, card: props.cardId})
        props.onClickDelete()
    }

    const handleDuplicateCard = () => {
        if (props.onClickDuplicate) {
            TelemetryClient.trackEvent(TelemetryCategory, TelemetryActions.DuplicateCard, {board: props.boardId, card: props.cardId})
            props.onClickDuplicate()
        }
    }

    return (
        <Menu position='left'>
            <BoardPermissionGate permissions={[Permission.ManageBoardCards]}>
                <Menu.Text
                    icon={<DeleteIcon/>}
                    id='delete'
                    name={intl.formatMessage({id: 'CardActionsMenu.delete', defaultMessage: 'Delete'})}
                    onClick={handleDeleteCard}
                />
                {props.onClickDuplicate &&
                <Menu.Text
                    icon={<DuplicateIcon/>}
                    id='duplicate'
                    name={intl.formatMessage({id: 'CardActionsMenu.duplicate', defaultMessage: 'Duplicate'})}
                    onClick={handleDuplicateCard}
                />}
            </BoardPermissionGate>
            {me?.id !== 'single-user' &&
                <Menu.Text
                    icon={<LinkIcon/>}
                    id='copy'
                    name={intl.formatMessage({id: 'CardActionsMenu.copyLink', defaultMessage: 'Copy link'})}
                    onClick={() => {
                        let cardLink = window.location.href

                        if (!cardLink.includes(cardId)) {
                            cardLink += `/${cardId}`
                        }

                        Utils.copyTextToClipboard(cardLink)
                        sendFlashMessage({content: intl.formatMessage({id: 'CardActionsMenu.copiedLink', defaultMessage: 'Copied!'}), severity: 'high'})
                    }}
                />
            }
            {props.children}
        </Menu>
    )
}

export default CardActionsMenu
