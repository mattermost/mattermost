// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react'
import {useIntl} from 'react-intl'
import Select from 'react-select/async'
import {CSSObject} from '@emotion/serialize'

import {ActionMeta} from 'react-select'

import {getSelectBaseStyle} from 'src/theme'
import {IUser} from 'src/user'
import {Utils} from 'src/utils'
import {useAppSelector} from 'src/store/hooks'
import {getBoardUsers, getBoardUsersList, getMe} from 'src/store/users'

import {ClientConfig} from 'src/config/clientConfig'
import {getClientConfig} from 'src/store/clientConfig'
import client from 'src/octoClient'

import GuestBadge from 'src/widgets/guestBadge'
import {PropertyType} from 'src/properties/types'

import './personSelector.scss'

const imageURLForUser = (window as any).Components?.imageURLForUser

type Props = {
    readOnly: boolean
    userIDs: string[]
    allowAddUsers: boolean
    property?: PropertyType
    emptyDisplayValue: string
    isMulti: boolean
    closeMenuOnSelect?: boolean
    showMe?: boolean
    onChange: (items: any, action: ActionMeta<IUser>) => void
}

const selectStyles = {
    ...getSelectBaseStyle(),
    option: (provided: CSSObject, state: {isFocused: boolean}): CSSObject => ({
        ...provided,
        background: state.isFocused ? 'rgba(var(--center-channel-color-rgb), 0.1)' : 'rgb(var(--center-channel-bg-rgb))',
        color: state.isFocused ? 'rgb(var(--center-channel-color-rgb))' : 'rgb(var(--center-channel-color-rgb))',
        padding: '8px',
    }),
    control: (): CSSObject => ({
        border: 0,
        width: '100%',
        margin: '0',
    }),
    valueContainer: (provided: CSSObject): CSSObject => ({
        ...provided,
        padding: 'unset',
        overflow: 'unset',
    }),
    singleValue: (provided: CSSObject): CSSObject => ({
        ...provided,
        position: 'static',
        top: 'unset',
        transform: 'unset',
    }),
    menu: (provided: CSSObject): CSSObject => ({
        ...provided,
        width: 'unset',
        background: 'rgb(var(--center-channel-bg-rgb))',
        minWidth: '260px',
    }),
}

const PersonSelector = (props: Props): JSX.Element => {
    const {readOnly, userIDs, allowAddUsers, isMulti, closeMenuOnSelect = true, emptyDisplayValue, showMe = false, onChange} = props

    const clientConfig = useAppSelector<ClientConfig>(getClientConfig)
    const intl = useIntl()

    const boardUsersById = useAppSelector<{[key: string]: IUser}>(getBoardUsers)
    const boardUsers = useAppSelector<IUser[]>(getBoardUsersList)
    const boardUsersKey = Object.keys(boardUsersById) ? Utils.hashCode(JSON.stringify(Object.keys(boardUsersById))) : 0
    const me = useAppSelector<IUser|null>(getMe)

    const formatOptionLabel = (user: any): JSX.Element => {
        if (!user) {
            return <div/>
        }
        let profileImg
        if (imageURLForUser) {
            profileImg = imageURLForUser(user.id)
        }

        return (
            <div
                key={user.id}
                className={isMulti ? 'MultiPerson-item' : 'Person-item'}
            >
                {profileImg && (
                    <img
                        alt='Person-avatar'
                        src={profileImg}
                    />
                )}
                {Utils.getUserDisplayName(user, clientConfig.teammateNameDisplay)}
                <GuestBadge show={Boolean(user?.is_guest)}/>
            </div>
        )
    }

    let users: IUser[] = []
    if (Object.keys(boardUsersById).length > 0) {
        users = userIDs.map((id) => boardUsersById[id])
    }

    const loadOptions = useCallback(async (value: string) => {
        if (!allowAddUsers) {
            const returnUsers: IUser[] = []
            if (showMe && me) {
                returnUsers.push({
                    id: me.id,
                    username: intl.formatMessage({id: 'PersonProperty.me', defaultMessage: 'Me'}),
                    email: '',
                    nickname: '',
                    firstname: '',
                    lastname: '',
                    props: {},
                    create_at: me.create_at,
                    update_at: me.update_at,
                    is_bot: false,
                    is_guest: me.is_guest,
                    roles: me.roles,
                })
                returnUsers.push(...boardUsers.filter((u) => u.id !== me.id))
            } else {
                returnUsers.push(...boardUsers)
            }
            if (value) {
                return returnUsers.filter((u) => {
                    return u.username.toLowerCase().includes(value.toLowerCase()) ||
                        u.lastname.toLowerCase().includes(value.toLowerCase()) ||
                        u.firstname.toLowerCase().includes(value.toLowerCase()) ||
                        u.nickname.toLowerCase().includes(value.toLowerCase())
                })
            }
            return returnUsers
        }
        const excludeBots = true
        const allUsers = await client.searchTeamUsers(value, excludeBots)
        const usersInsideBoard: IUser[] = []
        const usersOutsideBoard: IUser[] = []
        for (const u of allUsers) {
            if (boardUsersById[u.id]) {
                usersInsideBoard.push(u)
            } else {
                usersOutsideBoard.push(u)
            }
        }
        return [
            {label: intl.formatMessage({id: 'PersonProperty.board-members', defaultMessage: 'Board members'}), options: usersInsideBoard},
            {label: intl.formatMessage({id: 'PersonProperty.non-board-members', defaultMessage: 'Not board members'}), options: usersOutsideBoard},
        ]
    }, [boardUsers, allowAddUsers, boardUsersById, me])

    let primaryClass = 'Person'
    if (isMulti) {
        primaryClass = 'MultiPerson'
    }
    let secondaryClass = ''
    if (props.property) {
        secondaryClass = ` ${props.property.valueClassName(readOnly)}`
    }

    if (readOnly) {
        return (
            <div className={`${primaryClass}${secondaryClass}`}>
                {users.map((user) => formatOptionLabel(user))}
            </div>
        )
    }

    return (
        <>
            <Select
                key={boardUsersKey}
                loadOptions={loadOptions}
                isMulti={isMulti}
                defaultOptions={true}
                isSearchable={true}
                isClearable={true}
                backspaceRemovesValue={true}
                closeMenuOnSelect={closeMenuOnSelect}
                className={`${primaryClass}${secondaryClass}`}
                classNamePrefix={'react-select'}
                formatOptionLabel={formatOptionLabel}
                styles={selectStyles}
                placeholder={emptyDisplayValue}
                getOptionLabel={(o: IUser) => o.username}
                getOptionValue={(a: IUser) => a.id}
                value={users}
                onChange={onChange}
            />
        </>
    )
}

export default PersonSelector
