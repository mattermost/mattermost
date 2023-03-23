// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'

import 'isomorphic-fetch'
import {act, render} from '@testing-library/react'

import configureStore from 'redux-mock-store'
import {Provider as ReduxProvider} from 'react-redux'

import userEvent from '@testing-library/user-event'

import {mocked} from 'jest-mock'

import {FetchMock} from 'src/test/fetchMock'
import {TestBlockFactory} from 'src/test/testBlockFactory'

import {mockDOM, wrapDNDIntl, wrapIntl} from 'src/testUtils'

import octoClient from 'src/octoClient'

import {createTextBlock} from 'src/blocks/textBlock'

import CardDetail from './cardDetail'

global.fetch = FetchMock.fn
jest.mock('src/octoClient')

const mockedOctoClient = mocked(octoClient, true)

beforeEach(() => {
    FetchMock.fn.mockReset()
})

// This is needed to run EasyMDE in tests.
// It needs bounding rectangle box property
// on HTML elements, but Jest's HTML engine jsdom
// doesn't provide it.
// So we mock it.
beforeAll(() => {
    mockDOM()
})

describe('components/cardDetail/CardDetail', () => {
    const board = TestBlockFactory.createBoard()

    const view = TestBlockFactory.createBoardView(board)
    view.fields.sortOptions = []
    view.fields.groupById = undefined
    view.fields.hiddenOptionIds = []

    const card = TestBlockFactory.createCard(board)

    const createdAt = Date.parse('01 Jan 2021 00:00:00 GMT')
    const comment1 = TestBlockFactory.createComment(card)
    comment1.type = 'comment'
    comment1.title = 'Comment 1'
    comment1.parentId = card.id
    comment1.createAt = createdAt

    const comment2 = TestBlockFactory.createComment(card)
    comment2.type = 'comment'
    comment2.title = 'Comment 2'
    comment2.parentId = card.id
    comment2.createAt = createdAt

    test('should show comments', async () => {
        const mockStore = configureStore([])
        const store = mockStore({
            users: {
                boardUsers: {
                    'user-id-1': {username: 'username_1'},
                },
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
            cards: {
                cards: {
                    [card.id]: card,
                },
                current: card.id,
            },
            clientConfig: {
                value: {
                    featureFlags: {},
                },
            },
        })

        const component = (
            <ReduxProvider store={store}>
                {wrapIntl(
                    <CardDetail
                        board={board}
                        activeView={view}
                        views={[view]}
                        cards={[card]}
                        card={card}
                        comments={[comment1, comment2]}
                        contents={[]}
                        attachments={[]}
                        readonly={false}
                        onClose={jest.fn()}
                        onDelete={jest.fn()}
                        addAttachment={jest.fn()}
                    />,
                )}
            </ReduxProvider>
        )

        let container: Element | DocumentFragment | null = null

        await act(async () => {
            const result = render(component)
            container = result.container
        })

        expect(container).toBeDefined()

        // Comments show up
        const comments = container!.querySelectorAll('.comment-text')
        expect(comments.length).toBe(2)

        // Add comment option visible when readonly mode is off
        const newCommentSection = container!.querySelectorAll('.newcomment')
        expect(newCommentSection.length).toBe(1)
    })

    test('should show comments in readonly view', async () => {
        const mockStore = configureStore([])
        const store = mockStore({
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
                    'user-id-1': {username: 'username_1'},
                },
            },
            clientConfig: {
                value: {
                    featureFlags: {},
                },
            },
        })

        const component = (
            <ReduxProvider store={store}>
                {wrapIntl(
                    <CardDetail
                        board={board}
                        activeView={view}
                        views={[view]}
                        cards={[card]}
                        card={card}
                        comments={[comment1, comment2]}
                        contents={[]}
                        attachments={[]}
                        readonly={true}
                        onClose={jest.fn()}
                        onDelete={jest.fn()}
                        addAttachment={jest.fn()}
                    />,
                )}
            </ReduxProvider>
        )

        let container: Element | DocumentFragment | null = null

        await act(async () => {
            const result = render(component)
            container = result.container
        })

        expect(container).toBeDefined()

        // comments show up
        const comments = container!.querySelectorAll('.comment-text')
        expect(comments.length).toBe(2)

        // Add comment option is not shown in readonly mode
        const newCommentSection = container!.querySelectorAll('.newcomment')
        expect(newCommentSection.length).toBe(0)
    })

    test('should show add properties tour tip', async () => {
        const mockStore = configureStore([])

        const welcomeBoard = TestBlockFactory.createBoard()
        welcomeBoard.title = 'Welcome to Boards!'

        const welcomeCard = TestBlockFactory.createCard(welcomeBoard)
        welcomeCard.title = 'Create a new card'

        const store = mockStore({
            users: {
                me: {
                    id: 'user_id_1',
                },
                myConfig: {
                    welcomePageViewed: {value: '1'},
                    onboardingTourStarted: {value: true},
                    tourCategory: {value: 'card'},
                    onboardingTourStep: {value: '0'},
                },
                boardUsers: {
                    'user-id-1': {username: 'username_1'},
                },
            },
            teams: {
                current: {id: 'team-id'},
            },
            boards: {
                boards: {
                    [welcomeBoard.id]: welcomeBoard,
                },
                current: welcomeBoard.id,
                myBoardMemberships: {
                    [welcomeBoard.id]: {userId: 'user_id_1', schemeAdmin: true},
                },
            },
            cards: {
                cards: {
                    [welcomeCard.id]: welcomeCard,
                },
                current: welcomeCard.id,
            },
            clientConfig: {
                value: {
                    featureFlags: {},
                },
            },
        })

        const onboardingBoard = TestBlockFactory.createBoard()
        onboardingBoard.title = 'Welcome to Boards!'

        const onboardingCard = TestBlockFactory.createCard(board)
        onboardingCard.title = 'Create a new card'

        const component = (
            <ReduxProvider store={store}>
                {wrapIntl(
                    <CardDetail
                        board={onboardingBoard}
                        activeView={view}
                        views={[view]}
                        cards={[onboardingCard]}
                        card={onboardingCard}
                        comments={[comment1, comment2]}
                        contents={[]}
                        attachments={[]}
                        readonly={false}
                        onClose={jest.fn()}
                        onDelete={jest.fn()}
                        addAttachment={jest.fn()}
                    />,
                )}
            </ReduxProvider>
        )

        let container: Element | DocumentFragment | null = null

        await act(async () => {
            const result = render(component)
            container = result.container
        })

        expect(container).toBeDefined()
        expect(container).not.toBeNull()

        const tourTip = document.querySelectorAll('.AddPropertiesTourStep')
        expect(tourTip.length).toBe(2)
        expect(tourTip[1]).toMatchSnapshot()

        // moving to next step
        mockedOctoClient.patchUserConfig.mockResolvedValueOnce([])

        const nextBtn = document!.querySelector('.tipNextButton')
        expect(nextBtn).toBeDefined()
        expect(nextBtn).not.toBeNull()
        await act(async () => {
            userEvent.click(nextBtn!)
        })
        expect(mockedOctoClient.patchUserConfig).toBeCalledWith(
            'user_id_1',
            {
                updatedFields: {
                    onboardingTourStep: '1',
                },
            },
        )
    })

    test('should show add comments tour tip', async () => {
        const mockStore = configureStore([])

        const welcomeBoard = TestBlockFactory.createBoard()
        welcomeBoard.title = 'Welcome to Boards!'

        const welcomeCard = TestBlockFactory.createCard(welcomeBoard)
        welcomeCard.title = 'Create a new card'

        const store = mockStore({
            users: {
                me: {
                    id: 'user_id_1',
                },
                myConfig: {
                    welcomePageViewed: {value: '1'},
                    onboardingTourStarted: {value: true},
                    tourCategory: {value: 'card'},
                    onboardingTourStep: {value: '1'},
                },
                boardUsers: {
                    'user-id-1': {username: 'username_1'},
                },
            },
            teams: {
                current: {id: 'team-id'},
            },
            boards: {
                boards: {
                    [welcomeBoard.id]: welcomeBoard,
                },
                current: welcomeBoard.id,
                myBoardMemberships: {
                    [welcomeBoard.id]: {userId: 'user_id_1', schemeAdmin: true},
                },
            },
            cards: {
                cards: {
                    [welcomeCard.id]: welcomeCard,
                },
                current: welcomeCard.id,
            },
            clientConfig: {
                value: {
                    featureFlags: {},
                },
            },
        })

        const onboardingBoard = TestBlockFactory.createBoard()
        onboardingBoard.title = 'Welcome to Boards!'

        const onboardingCard = TestBlockFactory.createCard(board)
        onboardingCard.title = 'Create a new card'

        const component = (
            <ReduxProvider store={store}>
                {wrapIntl(
                    <CardDetail
                        board={onboardingBoard}
                        activeView={view}
                        views={[view]}
                        cards={[onboardingCard]}
                        card={onboardingCard}
                        comments={[comment1, comment2]}
                        contents={[]}
                        attachments={[]}
                        readonly={false}
                        onClose={jest.fn()}
                        onDelete={jest.fn()}
                        addAttachment={jest.fn()}
                    />,
                )}
            </ReduxProvider>
        )

        let container: Element | DocumentFragment | null = null

        await act(async () => {
            const result = render(component)
            container = result.container
        })

        expect(container).toBeDefined()
        expect(container).not.toBeNull()

        const tourTip = document.querySelectorAll('.AddCommentTourStep')
        expect(tourTip.length).toBe(2)
        expect(tourTip[1]).toMatchSnapshot()

        // moving to next step
        mockedOctoClient.patchUserConfig.mockResolvedValueOnce([])

        const nextBtn = document!.querySelector('.tipNextButton')
        expect(nextBtn).toBeDefined()
        expect(nextBtn).not.toBeNull()
        await act(async () => {
            userEvent.click(nextBtn!)
        })
        expect(mockedOctoClient.patchUserConfig).toBeCalledWith(
            'user_id_1',
            {
                updatedFields: {
                    onboardingTourStep: '2',
                },
            },
        )
    })

    test('should show add description tour tip', async () => {
        const mockStore = configureStore([])
        const welcomeBoard = TestBlockFactory.createBoard()
        welcomeBoard.title = 'Welcome to Boards!'

        const welcomeCard = TestBlockFactory.createCard(welcomeBoard)
        welcomeCard.title = 'Create a new card'
        const state = {
            users: {
                me: {
                    id: 'user_id_1',
                },
                myConfig: {
                    welcomePageViewed: {value: '1'},
                    onboardingTourStarted: {value: true},
                    tourCategory: {value: 'card'},
                    onboardingTourStep: {value: '2'},
                },
                boardUsers: {
                    'user-id-1': {username: 'username_1'},
                },
            },
            teams: {
                current: {id: 'team-id'},
            },
            boards: {
                boards: {
                    [welcomeBoard.id]: welcomeBoard,
                },
                current: welcomeBoard.id,
                myBoardMemberships: {
                    [welcomeBoard.id]: {userId: 'user_id_1', schemeAdmin: true},
                },
            },
            cards: {
                cards: {
                    [welcomeCard.id]: welcomeCard,
                },
                current: welcomeCard.id,
            },
            clientConfig: {
                value: {
                    featureFlags: {},
                },
            },
        }
        const store = mockStore(state)

        const onboardingBoard = TestBlockFactory.createBoard()
        onboardingBoard.title = 'Welcome to Boards!'

        const onboardingCard = TestBlockFactory.createCard(board)
        onboardingCard.title = 'Create a new card'

        const text = createTextBlock()
        text.title = 'description'
        text.parentId = onboardingCard.id
        onboardingCard.fields.contentOrder = [text.id]

        const component = (
            <ReduxProvider store={store}>
                {wrapDNDIntl(
                    <CardDetail
                        board={onboardingBoard}
                        activeView={view}
                        views={[view]}
                        cards={[onboardingCard]}
                        card={onboardingCard}
                        comments={[comment1, comment2]}
                        contents={[text]}
                        attachments={[]}
                        readonly={false}
                        onClose={jest.fn()}
                        onDelete={jest.fn()}
                        addAttachment={jest.fn()}
                    />,
                )}
            </ReduxProvider>
        )

        let container: Element | DocumentFragment | null = null

        await act(async () => {
            const result = render(component)
            container = result.container
        })

        expect(container).toBeDefined()
        expect(container).not.toBeNull()

        const tourTip = document.querySelectorAll('.AddDescriptionTourStep')
        expect(tourTip.length).toBe(2)
        expect(tourTip[1]).toMatchSnapshot()

        // moving to next step
        mockedOctoClient.patchUserConfig.mockResolvedValueOnce([])

        const nextBtn = document!.querySelector('.tipNextButton')
        expect(nextBtn).toBeDefined()
        expect(nextBtn).not.toBeNull()
        await act(async () => {
            userEvent.click(nextBtn!)
        })
        expect(mockedOctoClient.patchUserConfig).toBeCalledWith(
            'user_id_1',
            {
                updatedFields: {
                    onboardingTourStep: '999',
                },
            },
        )
    })

    test('should render hidden view if limited', async () => {
        const limitedCard = {...card, limited: true}
        const mockStore = configureStore([])
        const store = mockStore({
            users: {
                workspaceUsers: [
                    {username: 'username_1'},
                ],
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
            cards: {
                cards: {
                    [limitedCard.id]: limitedCard,
                },
                current: limitedCard.id,
            },
            clientConfig: {
                value: {
                    featureFlags: {},
                },
            },
        })

        const component = (
            <ReduxProvider store={store}>
                {wrapIntl(
                    <CardDetail
                        board={board}
                        activeView={view}
                        views={[view]}
                        cards={[limitedCard]}
                        card={limitedCard}
                        comments={[comment1, comment2]}
                        contents={[]}
                        attachments={[]}
                        readonly={false}
                        onClose={jest.fn()}
                        onDelete={jest.fn()}
                        addAttachment={jest.fn()}
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
})
