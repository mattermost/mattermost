// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {act, render} from '@testing-library/react'

import configureStore from 'redux-mock-store'

import {Provider as ReduxProvider} from 'react-redux'

import {mocked} from 'jest-mock'

import {Utils} from 'src/utils'
import {createCard} from 'src/blocks/card'
import {createBoard} from 'src/blocks/board'
import octoClient from 'src/octoClient'
import {wrapIntl} from 'src/testUtils'

import {createBoardView} from 'src/blocks/boardView'

import BoardsUnfurl from './boardsUnfurl'

jest.mock('src/octoClient')
jest.mock('src/utils')
const mockedOctoClient = mocked(octoClient)
const mockedUtils = mocked(Utils)
mockedUtils.createGuid = jest.requireActual('src/utils').Utils.createGuid
mockedUtils.blockTypeToIDType = jest.requireActual('src/utils').Utils.blockTypeToIDType
mockedUtils.displayDateTime = jest.requireActual('src/utils').Utils.displayDateTime

describe('components/boardsUnfurl/BoardsUnfurl', () => {
    const team = {
        id: 'team-id',
        name: 'team',
        display_name: 'Team name',
    }

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('renders normally', async () => {
        const mockStore = configureStore([])
        const store = mockStore({
            language: {
                value: 'en',
            },
            teams: {
                allTeams: [team],
                current: team,
            },
        })

        const cards = [{...createCard(), title: 'test card', updateAt: 12345}]
        const board = {...createBoard(), title: 'test board'}

        mockedOctoClient.getBlocksWithBlockID.mockResolvedValueOnce(cards)
        mockedOctoClient.getBoard.mockResolvedValueOnce(board)

        const component = (
            <ReduxProvider store={store}>
                {wrapIntl(
                    <BoardsUnfurl
                        embed={{data: JSON.stringify({workspaceID: 'foo', cardID: cards[0].id, boardID: board.id, readToken: 'abc', originalPath: '/test'})}}
                    />,
                )}
            </ReduxProvider>
        )

        let container: Element | DocumentFragment | null = null

        await act(async () => {
            const result = render(component)
            container = result.container
        })
        expect(mockedOctoClient.getBoard).toBeCalledWith(board.id)
        expect(mockedOctoClient.getBlocksWithBlockID).toBeCalledWith(cards[0].id, board.id, 'abc')

        expect(container).toMatchSnapshot()
    })

    it('renders when limited', async () => {
        const mockStore = configureStore([])
        const store = mockStore({
            language: {
                value: 'en',
            },
            teams: {
                allTeams: [team],
                current: team,
            },
        })

        const cards = [{...createCard(), title: 'test card', limited: true, updateAt: 12345}]
        const board = {...createBoard(), title: 'test board'}

        mockedOctoClient.getBlocksWithBlockID.mockResolvedValueOnce(cards)
        mockedOctoClient.getBoard.mockResolvedValueOnce(board)

        const component = (
            <ReduxProvider store={store}>
                {wrapIntl(
                    <BoardsUnfurl
                        embed={{data: JSON.stringify({workspaceID: 'foo', cardID: cards[0].id, boardID: board.id, readToken: 'abc', originalPath: '/test'})}}
                    />,
                )}
            </ReduxProvider>
        )

        let container: Element | DocumentFragment | null = null

        await act(async () => {
            const result = render(component)
            container = result.container
        })

        expect(container).toMatchSnapshot()
    })

    it('test no card', async () => {
        const mockStore = configureStore([])
        const store = mockStore({
            language: {
                value: 'en',
            },
            teams: {
                allTeams: [team],
                current: team,
            },
        })

        const board = {...createBoard(), title: 'test board'}

        // mockedOctoClient.getBoard.mockResolvedValueOnce(board)

        const component = (
            <ReduxProvider store={store}>
                {wrapIntl(
                    <BoardsUnfurl
                        embed={{data: JSON.stringify({workspaceID: 'foo', cardID: '', boardID: board.id, readToken: 'abc', originalPath: '/test'})}}
                    />,
                )}
            </ReduxProvider>
        )

        let container: Element | DocumentFragment | null = null

        await act(async () => {
            const result = render(component)
            container = result.container
        })
        expect(container).toMatchSnapshot()
    })

    it('test invalid card, valid block', async () => {
        const mockStore = configureStore([])
        const store = mockStore({
            language: {
                value: 'en',
            },
            teams: {
                allTeams: [team],
                current: team,
            },
        })

        const cards = [{...createBoardView(), title: 'test view', updateAt: 12345}]
        const board = {...createBoard(), title: 'test board'}

        mockedOctoClient.getBlocksWithBlockID.mockResolvedValueOnce(cards)
        mockedOctoClient.getBoard.mockResolvedValueOnce(board)

        const component = (
            <ReduxProvider store={store}>
                {wrapIntl(
                    <BoardsUnfurl
                        embed={{data: JSON.stringify({workspaceID: 'foo', cardID: cards[0].id, boardID: board.id, readToken: 'abc', originalPath: '/test'})}}
                    />,
                )}
            </ReduxProvider>
        )

        let container: Element | DocumentFragment | null = null

        await act(async () => {
            const result = render(component)
            container = result.container
        })
        expect(mockedOctoClient.getBoard).toBeCalledWith(board.id)
        expect(mockedOctoClient.getBlocksWithBlockID).toBeCalledWith(cards[0].id, board.id, 'abc')

        expect(container).toMatchSnapshot()
    })

    it('test invalid card, invalid block', async () => {
        const mockStore = configureStore([])
        const store = mockStore({
            language: {
                value: 'en',
            },
            teams: {
                allTeams: [team],
                current: team,
            },
        })

        const board = {...createBoard(), title: 'test board'}

        mockedOctoClient.getBlocksWithBlockID.mockResolvedValueOnce([])
        mockedOctoClient.getBoard.mockResolvedValueOnce(board)

        const component = (
            <ReduxProvider store={store}>
                {wrapIntl(
                    <BoardsUnfurl
                        embed={{data: JSON.stringify({workspaceID: 'foo', cardID: 'invalidCard', boardID: board.id, readToken: 'abc', originalPath: '/test'})}}
                    />,
                )}
            </ReduxProvider>
        )

        let container: Element | DocumentFragment | null = null

        await act(async () => {
            const result = render(component)
            container = result.container
        })
        expect(mockedOctoClient.getBoard).toBeCalledWith(board.id)
        expect(mockedOctoClient.getBlocksWithBlockID).toBeCalledWith('invalidCard', board.id, 'abc')

        expect(container).toMatchSnapshot()
    })
})

