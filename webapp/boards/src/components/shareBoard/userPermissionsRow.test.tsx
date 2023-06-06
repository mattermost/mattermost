// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {act, render} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {Provider as ReduxProvider} from 'react-redux'
import thunk from 'redux-thunk'

import React from 'react'
import {MemoryRouter} from 'react-router'

import {BoardMember} from 'src/blocks/board'

import {IUser} from 'src/user'
import {TestBlockFactory} from 'src/test/testBlockFactory'
import {mockStateStore, wrapDNDIntl} from 'src/testUtils'

import UserPermissionsRow from './userPermissionsRow'

const boardId = '1'

jest.mock('src/utils')

const board = TestBlockFactory.createBoard()
board.id = boardId
board.teamId = 'team-id'
board.channelId = 'channel_1'

describe('src/components/shareBoard/userPermissionsRow', () => {
    const me: IUser = {
        id: 'user-id-1',
        username: 'username_1',
        email: '',
        nickname: '',
        firstname: '',
        lastname: '',
        props: {},
        create_at: 0,
        update_at: 0,
        is_bot: false,
        is_guest: false,
        roles: 'system_user',
    }

    const state = {
        teams: {
            current: {id: 'team-id', title: 'Test Team'},
        },
        users: {
            me,
            boardUsers: [me],
            blockSubscriptions: [],
        },
        boards: {
            current: board.id,
            boards: {
                [board.id]: board,
            },
            templates: [],
            membersInBoards: {
                [board.id]: {},
            },
            myBoardMemberships: {
                [board.id]: {userId: me.id, schemeAdmin: true},
            },
        },
    }

    beforeEach(() => {
        jest.clearAllMocks()
    })

    test('should match snapshot in plugin mode', async () => {
        let container: Element | undefined
        const store = mockStateStore([thunk], state)
        await act(async () => {
            const result = render(
                wrapDNDIntl(
                    <ReduxProvider store={store}>
                        <UserPermissionsRow
                            user={me}
                            isMe={true}
                            member={state.boards.myBoardMemberships[board.id] as BoardMember}
                            teammateNameDisplay={'test'}
                            onDeleteBoardMember={() => {}}
                            onUpdateBoardMember={() => {}}
                        />
                    </ReduxProvider>),
                {wrapper: MemoryRouter},
            )
            container = result.container
        })

        const buttonElement = container?.querySelector('.user-item__button')
        expect(buttonElement).toBeDefined()
        await userEvent.click(buttonElement!)

        expect(container).toMatchSnapshot()
    })

    test('should match snapshot in template', async () => {
        let container: Element | undefined
        const testState = {
            ...state,
            boards: {
                ...state.boards,
                boards: {},
                templates: {
                    [board.id]: {...board, isTemplate: true},
                },
            },
        }
        const store = mockStateStore([thunk], testState)
        await act(async () => {
            const result = render(
                wrapDNDIntl(
                    <ReduxProvider store={store}>
                        <UserPermissionsRow
                            user={me}
                            isMe={true}
                            member={state.boards.myBoardMemberships[board.id] as BoardMember}
                            teammateNameDisplay={'test'}
                            onDeleteBoardMember={() => {}}
                            onUpdateBoardMember={() => {}}
                        />
                    </ReduxProvider>),
                {wrapper: MemoryRouter},
            )
            container = result.container
        })

        const buttonElement = container?.querySelector('.user-item__button')
        expect(buttonElement).toBeDefined()
        await userEvent.click(buttonElement!)

        expect(container).toMatchSnapshot()
    })
})
