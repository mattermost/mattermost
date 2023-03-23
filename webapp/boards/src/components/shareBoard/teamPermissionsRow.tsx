// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react'
import {useIntl} from 'react-intl'

import MenuWrapper from 'src/widgets/menuWrapper'
import Menu from 'src/widgets/menu'

import CheckIcon from 'src/widgets/icons/check'
import CompassIcon from 'src/widgets/icons/compassIcon'

import {
    Board,
    createBoard,
    BoardTypeOpen,
    BoardTypePrivate,
    MemberRole
} from 'src/blocks/board'
import {useAppSelector} from 'src/store/hooks'
import {getCurrentTeam} from 'src/store/teams'
import {getCurrentBoard} from 'src/store/boards'
import {Permission} from 'src/constants'

import BoardPermissionGate from 'src/components/permissions/boardPermissionGate'
import ConfirmationDialogBox from 'src/components/confirmationDialogBox'

import mutator from 'src/mutator'

async function updateBoardType(board: Board, newType: string, newMinimumRole: MemberRole) {
    if (board.type === newType && board.minimumRole === newMinimumRole) {
        return
    }

    const newBoard = createBoard(board)
    newBoard.type = newType
    newBoard.minimumRole = newMinimumRole

    await mutator.updateBoard(newBoard, board, 'update board type')
}

const TeamPermissionsRow = (): JSX.Element => {
    const intl = useIntl()
    const team = useAppSelector(getCurrentTeam)
    const board = useAppSelector(getCurrentBoard)
    const [changeRoleConfirmation, setChangeRoleConfirmation] = useState<MemberRole|null>(null)

    const onChangeRole = async () => {
        if (changeRoleConfirmation !== null) {
            await updateBoardType(board, BoardTypeOpen, changeRoleConfirmation)
            setChangeRoleConfirmation(null)
        }
    }

    let currentRoleName = intl.formatMessage({id: 'BoardMember.schemeNone', defaultMessage: 'None'})
    if (board.type === BoardTypeOpen && board.minimumRole === MemberRole.Admin) {
        currentRoleName = intl.formatMessage({id: 'BoardMember.schemeAdmin', defaultMessage: 'Admin'})
    } else if (board.type === BoardTypeOpen && board.minimumRole === MemberRole.Editor) {
        if (board.isTemplate) {
            currentRoleName = intl.formatMessage({id: 'BoardMember.schemeViewer', defaultMessage: 'Viewer'})
        } else {
            currentRoleName = intl.formatMessage({id: 'BoardMember.schemeEditor', defaultMessage: 'Editor'})
        }
    } else if (board.type === BoardTypeOpen && board.minimumRole === MemberRole.Commenter) {
        currentRoleName = intl.formatMessage({id: 'BoardMember.schemeCommenter', defaultMessage: 'Commenter'})
    } else if (board.type === BoardTypeOpen && board.minimumRole === MemberRole.Viewer) {
        currentRoleName = intl.formatMessage({id: 'BoardMember.schemeViewer', defaultMessage: 'Viewer'})
    }

    const confirmationDialog = (
        <ConfirmationDialogBox
            dialogBox={{
                heading: intl.formatMessage({
                    id: 'shareBoard.confirm-change-team-role.title',
                    defaultMessage: 'Change minimum board role',
                }),
                subText: intl.formatMessage({
                    id: 'shareBoard.confirm-change-team-role.body',
                    defaultMessage: 'Everyone on this board with a lower permission than the "{role}" role will <b>now be promoted to {role}</b>. Are you sure you want to change the minimum role for the board?',
                }, {
                    b: (...chunks) => <b>{chunks}</b>,
                    role: changeRoleConfirmation === MemberRole.Editor ? intl.formatMessage({id: 'BoardMember.schemeEditor', defaultMessage: 'Editor'}) : intl.formatMessage({id: 'BoardMember.schemeCommenter', defaultMessage: 'Commenter'}),
                }),
                confirmButtonText: intl.formatMessage({
                    id: 'shareBoard.confirm-change-team-role.confirmBtnText',
                    defaultMessage: 'Change minimum board role',
                }),
                onConfirm: onChangeRole,
                onClose: () => setChangeRoleConfirmation(null),
            }}
        />
    )

    return (
        <div className='user-item'>
            {changeRoleConfirmation && confirmationDialog}
            <div className='user-item__content'>
                <CompassIcon
                    icon='mattermost'
                    className='user-item__img'
                />
                <div className='ml-3'><strong>{intl.formatMessage({id: 'ShareBoard.teamPermissionsText', defaultMessage: 'Everyone at {teamName} Team'}, {teamName: team?.title})}</strong></div>
            </div>
            <div>
                <BoardPermissionGate permissions={[Permission.ManageBoardType]}>
                    <MenuWrapper>
                        <button className='user-item__button'>
                            {currentRoleName}
                            <CompassIcon
                                icon='chevron-down'
                                className='CompassIcon'
                            />
                        </button>
                        <Menu position='left'>
                            {!board.isTemplate &&
                                <Menu.Text
                                    id={MemberRole.Editor}
                                    check={board.minimumRole === undefined || board.minimumRole === MemberRole.Editor}
                                    icon={board.type === BoardTypeOpen && board.minimumRole === MemberRole.Editor ? <CheckIcon/> : <div className='empty-icon'/>}
                                    name={intl.formatMessage({id: 'BoardMember.schemeEditor', defaultMessage: 'Editor'})}
                                    onClick={() => setChangeRoleConfirmation(MemberRole.Editor)}
                                />}
                            {!board.isTemplate &&
                                <Menu.Text
                                    id={MemberRole.Commenter}
                                    check={board.minimumRole === MemberRole.Commenter}
                                    icon={board.type === BoardTypeOpen && board.minimumRole === MemberRole.Commenter ? <CheckIcon/> : <div className='empty-icon'/>}
                                    name={intl.formatMessage({id: 'BoardMember.schemeCommenter', defaultMessage: 'Commenter'})}
                                    onClick={() => setChangeRoleConfirmation(MemberRole.Commenter)}
                                />}
                            <Menu.Text
                                id={MemberRole.Viewer}
                                check={board.minimumRole === MemberRole.Viewer}
                                icon={board.type === BoardTypeOpen && board.minimumRole === MemberRole.Viewer ? <CheckIcon/> : <div className='empty-icon'/>}
                                name={intl.formatMessage({id: 'BoardMember.schemeViewer', defaultMessage: 'Viewer'})}
                                onClick={() => updateBoardType(board, BoardTypeOpen, MemberRole.Viewer)}
                            />
                            <Menu.Text
                                id={MemberRole.None}
                                check={true}
                                icon={board.type === BoardTypePrivate ? <CheckIcon/> : <div className='empty-icon'/>}
                                name={intl.formatMessage({id: 'BoardMember.schemeNone', defaultMessage: 'None'})}
                                onClick={() => updateBoardType(board, BoardTypePrivate, MemberRole.None)}
                            />
                        </Menu>
                    </MenuWrapper>
                </BoardPermissionGate>
                <BoardPermissionGate
                    permissions={[Permission.ManageBoardType]}
                    invert={true}
                >
                    <span>{currentRoleName}</span>
                </BoardPermissionGate>
            </div>
        </div>
    )
}

export default TeamPermissionsRow
