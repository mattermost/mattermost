// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef} from 'react'
import {useIntl} from 'react-intl'

import MenuWrapper from 'src/widgets/menuWrapper'
import Menu from 'src/widgets/menu'

import CheckIcon from 'src/widgets/icons/check'
import CompassIcon from 'src/widgets/icons/compassIcon'

import {BoardMember, MemberRole} from 'src/blocks/board'
import {IUser} from 'src/user'
import {Utils} from 'src/utils'
import {Permission} from 'src/constants'
import GuestBadge from 'src/widgets/guestBadge'
import AdminBadge from 'src/widgets/adminBadge/adminBadge'
import {useAppSelector} from 'src/store/hooks'
import {getCurrentBoard} from 'src/store/boards'

import BoardPermissionGate from 'src/components/permissions/boardPermissionGate'

type Props = {
    user: IUser
    member: BoardMember
    isMe: boolean
    teammateNameDisplay: string
    onDeleteBoardMember: (member: BoardMember) => void
    onUpdateBoardMember: (member: BoardMember, permission: string) => void
}

const UserPermissionsRow = (props: Props): JSX.Element => {
    const intl = useIntl()
    const board = useAppSelector(getCurrentBoard)
    const {user, member, isMe, teammateNameDisplay} = props
    let currentRole = MemberRole.Viewer
    let displayRole = intl.formatMessage({id: 'BoardMember.schemeViewer', defaultMessage: 'Viewer'})
    if (member.schemeAdmin) {
        currentRole = MemberRole.Admin
        displayRole = intl.formatMessage({id: 'BoardMember.schemeAdmin', defaultMessage: 'Admin'})
    } else if (member.schemeEditor || member.minimumRole === MemberRole.Editor) {
        currentRole = MemberRole.Editor
        displayRole = intl.formatMessage({id: 'BoardMember.schemeEditor', defaultMessage: 'Editor'})
    } else if (member.schemeCommenter || member.minimumRole === MemberRole.Commenter) {
        currentRole = MemberRole.Commenter
        displayRole = intl.formatMessage({id: 'BoardMember.schemeCommenter', defaultMessage: 'Commenter'})
    }

    const menuWrapperRef = useRef<HTMLDivElement>(null)

    return (
        <div
            className='user-item'
            ref={menuWrapperRef}
        >
            <div className='user-item__content'>
                <img
                    src={Utils.getProfilePicture(user.id)}
                    className='user-item__img'
                />
                <div className='ml-3'>
                    <strong>{Utils.getUserDisplayName(user, teammateNameDisplay)}</strong>
                    <strong className='ml-2 text-light'>{`@${user.username}`}</strong>
                    {isMe && <strong className='ml-2 text-light'>{intl.formatMessage({id: 'ShareBoard.userPermissionsYouText', defaultMessage: '(You)'})}</strong>}
                    <GuestBadge show={user.is_guest}/>
                    <AdminBadge permissions={user.permissions}/>
                </div>
            </div>
            <div>
                <BoardPermissionGate permissions={[Permission.ManageBoardRoles]}>
                    <MenuWrapper>
                        <button className='user-item__button'>
                            {displayRole}
                            <CompassIcon
                                icon='chevron-down'
                                className='CompassIcon'
                            />
                        </button>
                        <Menu
                            position='left'
                            parentRef={menuWrapperRef}
                        >
                            {(board.minimumRole === MemberRole.Viewer || board.minimumRole === MemberRole.None) &&
                                <Menu.Text
                                    id={MemberRole.Viewer}
                                    check={true}
                                    icon={currentRole === MemberRole.Viewer ? <CheckIcon/> : <div className='empty-icon'/>}
                                    name={intl.formatMessage({id: 'BoardMember.schemeViewer', defaultMessage: 'Viewer'})}
                                    onClick={() => props.onUpdateBoardMember(member, MemberRole.Viewer)}
                                />}
                            {!board.isTemplate && (board.minimumRole === MemberRole.None || board.minimumRole === MemberRole.Commenter || board.minimumRole === MemberRole.Viewer) &&
                                <Menu.Text
                                    id={MemberRole.Commenter}
                                    check={true}
                                    icon={currentRole === MemberRole.Commenter ? <CheckIcon/> : <div className='empty-icon'/>}
                                    name={intl.formatMessage({id: 'BoardMember.schemeCommenter', defaultMessage: 'Commenter'})}
                                    onClick={() => props.onUpdateBoardMember(member, MemberRole.Commenter)}
                                />}
                            <Menu.Text
                                id={MemberRole.Editor}
                                check={true}
                                icon={currentRole === MemberRole.Editor ? <CheckIcon/> : <div className='empty-icon'/>}
                                name={intl.formatMessage({id: 'BoardMember.schemeEditor', defaultMessage: 'Editor'})}
                                onClick={() => props.onUpdateBoardMember(member, MemberRole.Editor)}
                            />
                            {user.is_guest !== true &&
                                <Menu.Text
                                    id={MemberRole.Admin}
                                    check={true}
                                    icon={currentRole === MemberRole.Admin ? <CheckIcon/> : <div className='empty-icon'/>}
                                    name={intl.formatMessage({id: 'BoardMember.schemeAdmin', defaultMessage: 'Admin'})}
                                    onClick={() => props.onUpdateBoardMember(member, MemberRole.Admin)}
                                />}
                            <Menu.Separator/>
                            <Menu.Text
                                id='Remove'
                                name={intl.formatMessage({id: 'ShareBoard.userPermissionsRemoveMemberText', defaultMessage: 'Remove member'})}
                                onClick={() => props.onDeleteBoardMember(member)}
                            />
                        </Menu>
                    </MenuWrapper>
                </BoardPermissionGate>
                <BoardPermissionGate
                    permissions={[Permission.ManageBoardRoles]}
                    invert={true}
                >
                    {displayRole}
                </BoardPermissionGate>
            </div>
        </div>
    )
}

export default UserPermissionsRow
