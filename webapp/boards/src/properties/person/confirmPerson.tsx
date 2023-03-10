// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react'
import {useIntl} from 'react-intl'

import {ActionMeta, SingleValue, MultiValue} from 'react-select'

import {IUser} from 'src/user'
import mutator from 'src/mutator'
import {useAppSelector} from 'src/store/hooks'
import {getBoardUsers, getMe} from 'src/store/users'
import {BoardMember, BoardTypeOpen, MemberRole} from 'src/blocks/board'

import {PropertyProps} from 'src/properties/types'
import {useHasPermissions} from 'src/hooks/permissions'
import {Permission} from 'src/constants'
import ConfirmAddUserForNotifications from 'src/components/confirmAddUserForNotifications'
import PersonSelector from 'src/components/personSelector'

const ConfirmPerson = (props: PropertyProps): JSX.Element => {
    const {card, board, propertyTemplate, propertyValue, property, readOnly} = props
    const [confirmAddUser, setConfirmAddUser] = useState<IUser|null>(null)
    const intl = useIntl()

    const boardUsersById = useAppSelector<{[key: string]: IUser}>(getBoardUsers)

    const me = useAppSelector<IUser|null>(getMe)

    const allowManageBoardRoles = useHasPermissions(board.teamId, board.id, [Permission.ManageBoardRoles])
    const allowAddUsers = !me?.is_guest && (allowManageBoardRoles || board.type === BoardTypeOpen)
    const changePropertyValue = useCallback((newValue) => mutator.changePropertyValue(board.id, card, propertyTemplate.id, newValue), [board.id, card, propertyTemplate.id])
    const emptyDisplayValue = props.showEmptyPlaceholder ? intl.formatMessage({id: 'ConfirmPerson.empty', defaultMessage: 'Empty'}) : ''

    let userIDs: string[] = []
    if (typeof propertyValue === 'string' && propertyValue !== '') {
        userIDs.push(propertyValue as string)
    } else if (Array.isArray(propertyValue) && propertyValue.length > 0) {
        userIDs = propertyValue
    }

    const onChange = (items: SingleValue<IUser> | MultiValue<IUser>, action: ActionMeta<IUser>) => {
        if (Array.isArray(items)) {
            if (action.action === 'select-option') {
                const confirmedIds: string[] = []
                items.forEach((item) => {
                    if (boardUsersById[item.id]) {
                        confirmedIds.push(item.id)
                    } else {
                        setConfirmAddUser(item)
                    }
                })
                changePropertyValue(confirmedIds)
            } else if (action.action === 'clear') {
                changePropertyValue([])
            } else if (action.action === 'remove-value') {
                changePropertyValue(items.filter((a) => a.id !== action.removedValue.id).map((b) => b.id) || [])
            }
        } else {
            const item = items as IUser
            if (action.action === 'select-option') {
                if (boardUsersById[item?.id || '']) {
                    changePropertyValue(item?.id || '')
                } else {
                    setConfirmAddUser(item)
                }
            } else if (action.action === 'clear') {
                changePropertyValue('')
            }
        }
    }

    const addUser = useCallback(async (userId: string, role: string) => {
        const newRole = role || MemberRole.Viewer
        const newMember = {
            boardId: board.id,
            userId,
            roles: role,
            schemeAdmin: newRole === MemberRole.Admin,
            schemeEditor: newRole === MemberRole.Admin || newRole === MemberRole.Editor,
            schemeCommenter: newRole === MemberRole.Admin || newRole === MemberRole.Editor || newRole === MemberRole.Commenter,
            schemeViewer: newRole === MemberRole.Admin || newRole === MemberRole.Editor || newRole === MemberRole.Commenter || newRole === MemberRole.Viewer,
        } as BoardMember

        setConfirmAddUser(null)
        await mutator.createBoardMember(newMember)

        if (propertyTemplate.type === 'multiPerson') {
            await mutator.changePropertyValue(board.id, card, propertyTemplate.id, [...userIDs, newMember.userId])
        } else {
            await mutator.changePropertyValue(board.id, card, propertyTemplate.id, newMember.userId)
        }
    }, [board, card, propertyTemplate, userIDs])

    return (
        <>
            {confirmAddUser &&
                <ConfirmAddUserForNotifications
                    allowManageBoardRoles={allowManageBoardRoles}
                    minimumRole={board.minimumRole}
                    user={confirmAddUser}
                    onConfirm={addUser}
                    onClose={() => setConfirmAddUser(null)}
                />}
            <PersonSelector
                userIDs={userIDs}
                allowAddUsers={allowAddUsers}
                isMulti={propertyTemplate.type === 'multiPerson'}
                readOnly={readOnly}
                emptyDisplayValue={emptyDisplayValue}
                property={property}
                onChange={onChange}
            />
        </>
    )
}

export default ConfirmPerson
