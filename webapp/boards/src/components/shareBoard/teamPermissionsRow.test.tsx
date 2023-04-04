// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {render} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {Provider as ReduxProvider} from 'react-redux'
import thunk from 'redux-thunk'

import React from 'react'
import {MemoryRouter} from 'react-router'

import {IUser} from 'src/user'
import {TestBlockFactory} from 'src/test/testBlockFactory'
import {mockStateStore, wrapDNDIntl} from 'src/testUtils'

import {MemberRole} from 'src/blocks/board'

import TeamPermissionsRow from './teamPermissionsRow'

const boardId = '1'

jest.mock('src/utils')

const board = TestBlockFactory.createBoard()
board.id = boardId
board.teamId = 'team-id'
board.channelId = 'channel_1'
board.minimumRole = MemberRole.Editor

describe('src/components/shareBoard/teamPermissionsRow', () => {
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
        const store = mockStateStore([thunk], state)
        const {container} = render(
            wrapDNDIntl(
                <ReduxProvider store={store}>
                    <TeamPermissionsRow/>
                </ReduxProvider>),
            {wrapper: MemoryRouter},
        )

        const buttonElement = container?.querySelector('.user-item__button')
        expect(buttonElement).toBeDefined()
        await userEvent.click(buttonElement!)

        expect(container).toMatchSnapshot()
    })

    test('should match snapshot in template', async () => {
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
        const {container} = render(
            wrapDNDIntl(
                <ReduxProvider store={store}>
                    <TeamPermissionsRow/>
                </ReduxProvider>),
            {wrapper: MemoryRouter},
        )

        const buttonElement = container?.querySelector('.user-item__button')
        expect(buttonElement).toBeDefined()
        await userEvent.click(buttonElement!)

        expect(container).toMatchSnapshot()
    })
})
