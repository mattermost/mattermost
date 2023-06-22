// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react'
import {FormattedMessage, useIntl} from 'react-intl'

import MenuWrapper from 'src/widgets/menuWrapper'
import Menu from 'src/widgets/menu'

import {createBoard} from 'src/blocks/board'
import {useAppSelector} from 'src/store/hooks'
import {getCurrentBoard} from 'src/store/boards'
import {getBoardUsers} from 'src/store/users'
import {Channel} from 'src/store/channels'
import {Utils} from 'src/utils'
import mutator from 'src/mutator'
import octoClient from 'src/octoClient'
import {Permission} from 'src/constants'

import PrivateIcon from 'src/widgets/icons/lockOutline'
import PublicIcon from 'src/widgets/icons/globe'
import DeleteIcon from 'src/widgets/icons/delete'
import CompassIcon from 'src/widgets/icons/compassIcon'
import ConfirmationDialogBox from 'src/components/confirmationDialogBox'

import BoardPermissionGate from 'src/components/permissions/boardPermissionGate'

type Props = {
    teammateNameDisplay?: string
}

const ChannelPermissionsRow = (props: Props): JSX.Element => {
    const intl = useIntl()
    const board = useAppSelector(getCurrentBoard)
    const users = useAppSelector(getBoardUsers)
    const [linkedChannel, setLinkedChannel] = useState<Channel|null>(null)
    const [showUnlinkChannelConfirmation, setShowUnlinkChannelConfirmation] = useState<boolean>(false)

    const onUnlinkBoard = async () => {
        const newBoard = createBoard(board)
        newBoard.channelId = ''
        mutator.updateBoard(newBoard, board, 'unlinked channel')
        setShowUnlinkChannelConfirmation(false)
    }

    useEffect(() => {
        if (!board.channelId) {
            setLinkedChannel(null)

            return
        }
        const unknownChannel = {
            id: board.channelId,
            type: 'P',
            name: 'unknown',
            display_name: intl.formatMessage({
                id: 'shareBoard.unknown-channel-display-name',
                defaultMessage: 'Unknown channel',
            }),
        } as Channel
        octoClient.getChannel(board.teamId, board.channelId).then((c) => setLinkedChannel(c || unknownChannel))
    }, [board.channelId])

    if (!linkedChannel) {
        return <></>
    }

    const confirmationDialog = (
        <ConfirmationDialogBox
            dialogBox={{
                heading: intl.formatMessage({
                    id: 'shareBoard.confirm-unlink.title',
                    defaultMessage: 'Unlink channel from board',
                }),
                subText: intl.formatMessage({
                    id: 'shareBoard.confirm-unlink.body',
                    defaultMessage: 'When you unlink a channel from a board, all members of the channel (existing and new) will lose access to it unless they\'re given permission separately.',
                }),
                confirmButtonText: intl.formatMessage({
                    id: 'shareBoard.confirm-unlink.confirmBtnText',
                    defaultMessage: 'Unlink channel',
                }),
                onConfirm: onUnlinkBoard,
                onClose: () => setShowUnlinkChannelConfirmation(false),
            }}
        />
    )

    const getDMName = () => {
        const userIds = linkedChannel.name.split('__')
        if (userIds.length !== 2) {
            Utils.logError('Invalid DM channel name, unable to get user ids')
        }
        let result = Utils.getUserDisplayName(users[userIds[0]], props.teammateNameDisplay || '')
        result += ', '
        result += Utils.getUserDisplayName(users[userIds[1]], props.teammateNameDisplay || '')

        return result
    }

    return (
        <div className='user-item channel-item'>
            {showUnlinkChannelConfirmation && confirmationDialog}
            <div className='user-item__content'>
                <span className='user-item__img'>
                    {linkedChannel.type === 'P' && <PrivateIcon/>}
                    {linkedChannel.type === 'O' && <PublicIcon/>}
                    {linkedChannel.type === 'D' && <PrivateIcon/>}
                    {linkedChannel.type === 'G' && <PrivateIcon/>}
                </span>
                {linkedChannel.type === 'D' && (
                    <div className='ml-3'>
                        <strong>
                            {getDMName()}
                        </strong>
                    </div>
                )}
                {linkedChannel.type !== 'D' && <div className='ml-3'><strong>{linkedChannel.display_name}</strong></div>}
            </div>
            <div>
                <BoardPermissionGate permissions={[Permission.ManageBoardRoles]}>
                    <MenuWrapper>
                        <button className='user-item__button'>
                            <FormattedMessage
                                id='BoardMember.schemeEditor'
                                defaultMessage='Editor'
                            />
                            <CompassIcon
                                icon='chevron-down'
                                className='CompassIcon'
                            />
                        </button>
                        <Menu position='left'>
                            <Menu.Text
                                id='Unlink'
                                icon={<DeleteIcon/>}
                                name={intl.formatMessage({id: 'BoardMember.unlinkChannel', defaultMessage: 'Unlink'})}
                                onClick={() => setShowUnlinkChannelConfirmation(true)}
                            />
                        </Menu>
                    </MenuWrapper>
                </BoardPermissionGate>
                <BoardPermissionGate
                    permissions={[Permission.ManageBoardRoles]}
                    invert={true}
                >
                    <FormattedMessage
                        id='BoardMember.schemeEditor'
                        defaultMessage='Editor'
                    />
                </BoardPermissionGate>
            </div>
        </div>
    )
}

export default ChannelPermissionsRow
