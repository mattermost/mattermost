// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {Provider as ReduxProvider} from 'react-redux'
import {act, render, screen} from '@testing-library/react'
import {mocked} from 'jest-mock'
import thunk from 'redux-thunk'

import octoClient from 'src/octoClient'
import {BoardMember, createBoard} from 'src/blocks/board'
import {mockStateStore, wrapIntl} from 'src/testUtils'

import RHSChannelBoards from './rhsChannelBoards'

jest.mock('src/octoClient')
const mockedOctoClient = mocked(octoClient)

describe('components/rhsChannelBoards', () => {
    const board1 = createBoard()
    board1.updateAt = 1657311058157
    const board2 = createBoard()
    const board3 = createBoard()
    board3.updateAt = 1657311058157

    board1.channelId = 'channel-id'
    board3.channelId = 'channel-id'

    const boardMembership1 = {boardId: board1.id, userId: 'user-id'} as BoardMember
    const boardMembership2 = {boardId: board2.id, userId: 'user-id'} as BoardMember
    const boardMembership3 = {boardId: board3.id, userId: 'user-id'} as BoardMember

    const team = {
        id: 'team-id',
        name: 'team',
        display_name: 'Team name',
    }
    const state = {
        teams: {
            allTeams: [team],
            current: team,
            currentId: team.id,
        },
        users: {
            me: {
                id: 'user-id',
                permissions: ['create_post'],
            },
        },
        language: {
            value: 'en',
        },
        boards: {
            boards: {
                [board1.id]: board1,
                [board2.id]: board2,
                [board3.id]: board3,
            },
            myBoardMemberships: {
                [board1.id]: boardMembership1,
                [board2.id]: boardMembership2,
                [board3.id]: boardMembership3,
            },
        },
        channels: {
            current: {
                id: 'channel-id',
                name: 'channel',
                display_name: 'Channel Name',
                type: 'O',
            },
        },
    }

    beforeEach(() => {
        mockedOctoClient.getBoards.mockResolvedValue([board1, board2, board3])
        mockedOctoClient.getMyBoardMemberships.mockResolvedValue([boardMembership1, boardMembership2, boardMembership3])

        jest.clearAllMocks()
    })

    it('renders the RHS for channel boards', async () => {
        const store = mockStateStore([thunk], state)
        let container: Element | DocumentFragment | null = null
        await act(async () => {
            const result = render(wrapIntl(
                <ReduxProvider store={store}>
                    <RHSChannelBoards/>
                </ReduxProvider>
            ))
            container = result.container
        })
        const buttonElement = screen.queryByText('Add')
        expect(buttonElement).not.toBeNull()
        expect(container).toMatchSnapshot()
    })

    it('renders with empty list of boards', async () => {
        const localState = {...state, boards: {...state.boards, boards: {}}}
        const store = mockStateStore([thunk], localState)

        let container: Element | DocumentFragment | null = null
        await act(async () => {
            const result = render(wrapIntl(
                <ReduxProvider store={store}>
                    <RHSChannelBoards/>
                </ReduxProvider>
            ))
            container = result.container
        })

        const buttonElement = screen.queryByText('Link boards to Channel Name')
        expect(buttonElement).not.toBeNull()
        expect(container).toMatchSnapshot()
    })

    it('renders the RHS for channel boards, no add', async () => {
        const localState = {...state, users: {me: {id: 'user-id'}}}
        const store = mockStateStore([thunk], localState)
        let container: Element | DocumentFragment | null = null
        await act(async () => {
            const result = render(wrapIntl(
                <ReduxProvider store={store}>
                    <RHSChannelBoards/>
                </ReduxProvider>
            ))
            container = result.container
        })

        const buttonElement = screen.queryByText('Add')
        expect(buttonElement).toBeNull()
        expect(container).toMatchSnapshot()
    })

    it('renders with empty list of boards, cannot add', async () => {
        const localState = {...state, users: {me: {id: 'user-id'}}, boards: {...state.boards, boards: {}}}
        const store = mockStateStore([thunk], localState)

        let container: Element | DocumentFragment | null = null
        await act(async () => {
            const result = render(wrapIntl(
                <ReduxProvider store={store}>
                    <RHSChannelBoards/>
                </ReduxProvider>
            ))
            container = result.container
        })

        const buttonElement = screen.queryByText('Link boards to Channel Name')
        expect(buttonElement).toBeNull()
        expect(container).toMatchSnapshot()
    })
})
