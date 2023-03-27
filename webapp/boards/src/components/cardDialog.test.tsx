// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import '@testing-library/jest-dom'
import {act, render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import React from 'react'
import {Provider as ReduxProvider} from 'react-redux'
import {mocked} from 'jest-mock'

import mutator from 'src/mutator'
import {IUser} from 'src/user'
import {Utils} from 'src/utils'
import octoClient from 'src/octoClient'
import {TestBlockFactory} from 'src/test/testBlockFactory'
import {mockDOM, mockStateStore, wrapDNDIntl} from 'src/testUtils'

import CardDialog from './cardDialog'

jest.mock('src/mutator')
jest.mock('src/octoClient')
jest.mock('src/utils')
jest.mock('draft-js/lib/generateRandomKey', () => () => '123')

const mockedUtils = mocked(Utils, true)
const mockedMutator = mocked(mutator, true)
const mockedOctoClient = mocked(octoClient, true)
mockedUtils.createGuid.mockReturnValue('test-id')

beforeAll(() => {
    mockDOM()
})
describe('components/cardDialog', () => {
    const board = TestBlockFactory.createBoard()
    board.cardProperties = []
    board.id = 'test-id'
    board.teamId = 'team-id'
    const boardView = TestBlockFactory.createBoardView(board)
    boardView.id = board.id
    const card = TestBlockFactory.createCard(board)
    card.id = board.id
    card.createdBy = 'user-id-1'

    const state = {
        clientConfig: {
            value: {
                featureFlags: {
                    subscriptions: true,
                },
            },
        },
        comments: {
            comments: {},
            commentsByCard: {},
        },
        contents: {
            contents: {},
            contentsByCard: {},
        },
        cards: {
            cards: {
                [card.id]: card,
            },
            current: card.id,
        },
        teams: {
            current: {id: 'team-id'},
        },
        boards: {
            boards: {
                [board.id]: board,
            },
            current: board.id,
            myBoardMemberships: {
                [board.id]: {userId: 'user_id_1', schemeAdmin: true},
            },
        },
        users: {
            boardUsers: {
                1: {username: 'abc'},
                2: {username: 'd'},
                3: {username: 'e'},
                4: {username: 'f'},
                5: {username: 'g'},
            },
            blockSubscriptions: [],
        },
    }

    mockedOctoClient.searchTeamUsers.mockResolvedValue(Object.values(state.users.boardUsers) as IUser[])
    const store = mockStateStore([], state)
    beforeEach(() => {
        jest.clearAllMocks()
    })
    test('should match snapshot', async () => {
        let container
        await act(async () => {
            const result = render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <CardDialog
                        board={board}
                        activeView={boardView}
                        views={[boardView]}
                        cards={[card]}
                        cardId={card.id}
                        onClose={jest.fn()}
                        showCard={jest.fn()}
                        readonly={false}
                    />
                </ReduxProvider>,
            ))
            container = result.container
        })
        expect(container).toMatchSnapshot()
    })
    test('should match snapshot without permissions', async () => {
        let container
        const localStore = mockStateStore([], {...state, teams: {current: undefined}})
        await act(async () => {
            const result = render(wrapDNDIntl(
                <ReduxProvider store={localStore}>
                    <CardDialog
                        board={board}
                        activeView={boardView}
                        views={[boardView]}
                        cards={[card]}
                        cardId={card.id}
                        onClose={jest.fn()}
                        showCard={jest.fn()}
                        readonly={false}
                    />
                </ReduxProvider>,
            ))
            container = result.container
        })
        expect(container).toMatchSnapshot()
    })
    test('return a cardDialog readonly', async () => {
        let container
        await act(async () => {
            const result = render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <CardDialog
                        board={board}
                        activeView={boardView}
                        views={[boardView]}
                        cards={[card]}
                        cardId={card.id}
                        onClose={jest.fn()}
                        showCard={jest.fn()}
                        readonly={true}
                    />
                </ReduxProvider>,
            ))
            container = result.container
        })
        expect(container).toMatchSnapshot()
    })
    test('return cardDialog and do a close action', async () => {
        const closeFn = jest.fn()
        await act(async () => {
            render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <CardDialog
                        board={board}
                        activeView={boardView}
                        views={[boardView]}
                        cards={[card]}
                        cardId={card.id}
                        onClose={closeFn}
                        showCard={jest.fn()}
                        readonly={false}
                    />
                </ReduxProvider>,
            ))
        })
        const buttonElement = screen.getByRole('button', {name: 'Close dialog'})
        userEvent.click(buttonElement)
        expect(closeFn).toBeCalledTimes(1)
    })
    test('return cardDialog menu content', async () => {
        let container
        await act(async () => {
            const result = render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <CardDialog
                        board={board}
                        activeView={boardView}
                        views={[boardView]}
                        cards={[card]}
                        cardId={card.id}
                        onClose={jest.fn()}
                        showCard={jest.fn()}
                        readonly={false}
                    />
                </ReduxProvider>,
            ))
            container = result.container
        })
        const buttonMenu = screen.getAllByRole('button', {name: 'menuwrapper'})[0]
        userEvent.click(buttonMenu)
        expect(container).toMatchSnapshot()
    })
    test('return cardDialog menu content and verify delete action', async () => {
        await act(async () => {
            render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <CardDialog
                        board={board}
                        activeView={boardView}
                        views={[boardView]}
                        cards={[card]}
                        cardId={card.id}
                        onClose={jest.fn()}
                        showCard={jest.fn()}
                        readonly={false}
                    />
                </ReduxProvider>,
            ))
        })
        const buttonMenu = screen.getAllByRole('button', {name: 'menuwrapper'})[0]
        userEvent.click(buttonMenu)
        const buttonDelete = screen.getByRole('button', {name: 'Delete'})
        userEvent.click(buttonDelete)

        const confirmDialog = screen.getByTitle('Confirmation Dialog Box')
        expect(confirmDialog).toBeDefined()

        const confirmButton = screen.getByTitle('Delete')
        expect(confirmButton).toBeDefined()

        //click delete button
        userEvent.click(confirmButton!)

        // should be called once on confirming delete
        expect(mockedMutator.deleteBlock).toBeCalledTimes(1)
    })

    test('return cardDialog menu content and cancel delete confirmation do nothing', async () => {
        let container
        await act(async () => {
            const result = render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <CardDialog
                        board={board}
                        activeView={boardView}
                        views={[boardView]}
                        cards={[card]}
                        cardId={card.id}
                        onClose={jest.fn()}
                        showCard={jest.fn()}
                        readonly={false}
                    />
                </ReduxProvider>,
            ))
            container = result.container
        })

        const buttonMenu = screen.getAllByRole('button', {name: 'menuwrapper'})[0]
        userEvent.click(buttonMenu)
        const buttonDelete = screen.getByRole('button', {name: 'Delete'})
        userEvent.click(buttonDelete)

        const confirmDialog = screen.getByTitle('Confirmation Dialog Box')
        expect(confirmDialog).toBeDefined()

        const cancelButton = screen.getByTitle('Cancel')
        expect(cancelButton).toBeDefined()

        //click delete button
        userEvent.click(cancelButton!)

        // should do nothing  on cancel delete dialog
        expect(container).toMatchSnapshot()
    })

    test('return cardDialog menu content and do a New template from card', async () => {
        await act(async () => {
            render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <CardDialog
                        board={board}
                        activeView={boardView}
                        views={[boardView]}
                        cards={[card]}
                        cardId={card.id}
                        onClose={jest.fn()}
                        showCard={jest.fn()}
                        readonly={false}
                    />
                </ReduxProvider>,
            ))
        })
        const buttonMenu = screen.getAllByRole('button', {name: 'menuwrapper'})[0]
        userEvent.click(buttonMenu)
        const buttonTemplate = screen.getByRole('button', {name: 'New template from card'})
        userEvent.click(buttonTemplate)
        expect(mockedMutator.duplicateCard).toBeCalledTimes(1)
    })

    test('return cardDialog menu content and do a copy Link', async () => {
        await act(async () => {
            render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <CardDialog
                        board={board}
                        activeView={boardView}
                        views={[boardView]}
                        cards={[card]}
                        cardId={card.id}
                        onClose={jest.fn()}
                        showCard={jest.fn()}
                        readonly={false}
                    />
                </ReduxProvider>,
            ))
        })
        const buttonMenu = screen.getAllByRole('button', {name: 'menuwrapper'})[0]
        userEvent.click(buttonMenu)
        const buttonCopy = screen.getByRole('button', {name: 'Copy link'})
        userEvent.click(buttonCopy)
        expect(mockedUtils.copyTextToClipboard).toBeCalledTimes(1)
    })

    test('already following card', async () => {
        // simply doing {...state} gives a TypeScript error
        // when you try updating it's values.
        const newState = JSON.parse(JSON.stringify(state))
        newState.users.blockSubscriptions = [{blockId: card.id}]
        newState.clientConfig = {
            value: {
                featureFlags: {
                    subscriptions: true,
                },
            },
        }

        const newStore = mockStateStore([], newState)

        let container
        await act(async () => {
            const result = render(wrapDNDIntl(
                <ReduxProvider store={newStore}>
                    <CardDialog
                        board={board}
                        activeView={boardView}
                        views={[boardView]}
                        cards={[card]}
                        cardId={card.id}
                        onClose={jest.fn()}
                        showCard={jest.fn()}
                        readonly={false}
                    />
                </ReduxProvider>,
            ))
            container = result.container
        })
        expect(container).toMatchSnapshot()
    })

    test('limited card shows hidden view (no toolbar)', async () => {
        // simply doing {...state} gives a TypeScript error
        // when you try updating it's values.
        const newState = JSON.parse(JSON.stringify(state))
        const limitedCard = {...card, limited: true}
        newState.cards = {
            cards: {
                [limitedCard.id]: limitedCard,
            },
            current: limitedCard.id,
        }

        const newStore = mockStateStore([], newState)

        let container
        await act(async () => {
            const result = render(wrapDNDIntl(
                <ReduxProvider store={newStore}>
                    <CardDialog
                        board={board}
                        activeView={boardView}
                        views={[boardView]}
                        cards={[limitedCard]}
                        cardId={limitedCard.id}
                        onClose={jest.fn()}
                        showCard={jest.fn()}
                        readonly={false}
                    />
                </ReduxProvider>,
            ))
            container = result.container
        })
        expect(container).toMatchSnapshot()
    })
})
