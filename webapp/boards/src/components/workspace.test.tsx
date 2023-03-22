// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {act, render, waitFor} from '@testing-library/react'
import React from 'react'
import {Provider as ReduxProvider} from 'react-redux'
import {MemoryRouter} from 'react-router-dom'
import {mocked} from 'jest-mock'

import userEvent from '@testing-library/user-event'

import thunk from 'redux-thunk'

import {IUser} from 'src/user'
import octoClient from 'src/octoClient'
import {TestBlockFactory} from 'src/test/testBlockFactory'
import {
    mockDOM,
    mockMatchMedia,
    mockStateStore,
    wrapDNDIntl
} from 'src/testUtils'
import {Constants} from 'src/constants'
import {Utils} from 'src/utils'

import Workspace from './workspace'

Object.defineProperty(Constants, 'versionString', {value: '1.0.0'})
jest.useFakeTimers()
jest.mock('src/utils')
jest.mock('src/octoClient')
jest.mock('draft-js/lib/generateRandomKey', () => () => '123')
const mockedUtils = mocked(Utils, true)
const mockedOctoClient = mocked(octoClient, true)
const board = TestBlockFactory.createBoard()
board.id = 'board1'
board.teamId = 'team-id'
board.cardProperties = [
    {
        id: 'property1',
        name: 'Property 1',
        type: 'text',
        options: [
            {
                id: 'value1',
                value: 'value 1',
                color: 'propColorBrown',
            },
        ],
    },
    {
        id: 'property2',
        name: 'Property 2',
        type: 'select',
        options: [
            {
                id: 'value2',
                value: 'value 2',
                color: 'propColorBlue',
            },
        ],
    },
]
const activeView = TestBlockFactory.createBoardView(board)
activeView.id = 'view1'
activeView.fields.hiddenOptionIds = []
activeView.fields.visiblePropertyIds = ['property1']
activeView.fields.visibleOptionIds = ['value1']
const fakeBoard = {id: board.id}
activeView.boardId = fakeBoard.id
const card1 = TestBlockFactory.createCard(board)
card1.id = 'card1'
card1.title = 'card-1'
card1.boardId = fakeBoard.id
const card2 = TestBlockFactory.createCard(board)
card2.id = 'card2'
card2.title = 'card-2'
card2.boardId = fakeBoard.id
const card3 = TestBlockFactory.createCard(board)
card3.id = 'card3'
card3.title = 'card-3'
card3.boardId = fakeBoard.id

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

const categoryAttribute1 = TestBlockFactory.createCategoryBoards()
categoryAttribute1.name = 'Category 1'
categoryAttribute1.boardMetadata = [{boardID: board.id, hidden: false}]

jest.mock('react-router-dom', () => {
    const originalModule = jest.requireActual('react-router-dom')

    return {
        ...originalModule,
        useRouteMatch: jest.fn(() => {
            return {
                params: {
                    boardId: board.id,
                    viewId: activeView.id,
                },
            }
        }),
    }
})

describe('src/components/workspace', () => {
    const state = {
        teams: {
            current: {id: 'team-id', title: 'Test Team'},
        },
        users: {
            me,
            boardUsers: {[me.id]: me},
            blockSubscriptions: [],
        },
        boards: {
            current: board.id,
            boards: {
                [board.id]: board,
            },
            templates: [],
            myBoardMemberships: {
                [board.id]: {userId: 'user_id_1', schemeAdmin: true},
            },
        },
        limits: {
            limits: {
                cards: 0,
                used_cards: 0,
                card_limit_timestamp: 0,
                views: 0,
            },
        },
        globalTemplates: {
            value: [],
        },
        views: {
            views: {
                [activeView.id]: activeView,
            },
            current: activeView.id,
        },
        cards: {
            templates: [],
            cards: [card1, card2, card3],
        },
        searchText: {},
        clientConfig: {
            value: {
                telemetry: true,
                telemetryid: 'telemetry',
                enablePublicSharedBoards: true,
                teammateNameDisplay: 'username',
                featureFlags: {},
            },
        },
        contents: {
            contents: {},
        },
        comments: {
            comments: {},
        },
        sidebar: {
            categoryAttributes: [
                categoryAttribute1,
            ],
            hiddenBoardIDs: [],
        },
    }
    mockedOctoClient.searchTeamUsers.mockResolvedValue(Object.values(state.users.boardUsers))
    const store = mockStateStore([thunk], state)
    beforeAll(() => {
        mockDOM()
        mockMatchMedia({matches: true})
    })
    beforeEach(() => {
        jest.clearAllMocks()
        mockedUtils.createGuid.mockReturnValue('test-id')
    })
    test('should match snapshot', async () => {
        let container
        await act(async () => {
            const result = render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <Workspace readonly={false}/>
                </ReduxProvider>,
            ), {wrapper: MemoryRouter})
            container = result.container
            jest.runOnlyPendingTimers()
        })
        expect(container).toMatchSnapshot()
    })
    test('should match snapshot with readonly', async () => {
        let container
        await act(async () => {
            const result = render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <Workspace readonly={true}/>
                </ReduxProvider>,
            ), {wrapper: MemoryRouter})
            container = result.container
            jest.runOnlyPendingTimers()
        })
        expect(container).toMatchSnapshot()
    })

    test('return workspace and showcard', async () => {
        let container: Element | undefined
        await act(async () => {
            const result = render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <Workspace readonly={false}/>
                </ReduxProvider>,
            ), {wrapper: MemoryRouter})
            container = result.container
            jest.runOnlyPendingTimers()
            const cardElements = container!.querySelectorAll('.KanbanCard')
            expect(cardElements).toBeDefined()
            const cardElement = cardElements[0]
            userEvent.click(cardElement)
        })
        expect(container).toMatchSnapshot()
    })

    test('return workspace readonly and showcard', async () => {
        let container: Element | undefined
        await act(async () => {
            const result = render(wrapDNDIntl(
                <ReduxProvider store={store}>
                    <Workspace readonly={true}/>
                </ReduxProvider>,
            ), {wrapper: MemoryRouter})
            container = result.container
            jest.runOnlyPendingTimers()
            const cardElements = container!.querySelectorAll('.KanbanCard')
            expect(cardElements).toBeDefined()
            const cardElement = cardElements[0]
            userEvent.click(cardElement)
        })
        expect(container).toMatchSnapshot()
        expect(mockedUtils.getReadToken).toBeCalledTimes(1)
    })

    test('return workspace with BoardTemplateSelector component', async () => {
        const emptyStore = mockStateStore([], {
            users: {
                me,
                boardUsers: {[me.id]: me},
            },
            teams: {
                current: {id: 'team-id', title: 'Test Team'},
            },
            boards: {
                current: board.id,
                boards: {
                    [board.id]: board,
                },
                templates: [],
                myBoardMemberships: {
                    [board.id]: {userId: 'user_id_1', schemeAdmin: true},
                },
            },
            views: {
                views: {},
            },
            cards: {
                cards: [],
            },
            globalTemplates: {
                value: [],
            },
            searchText: {},
            clientConfig: {
                value: {
                    telemetry: true,
                    telemetryid: 'telemetry',
                    enablePublicSharedBoards: true,
                    teammateNameDisplay: 'username',
                    featureFlags: {},
                },
            },
            sidebar: {
                categoryAttributes: [
                    categoryAttribute1,
                ],
                hiddenBoardIDs: [],
            },
        })
        let container: Element | undefined
        await act(async () => {
            const result = render(wrapDNDIntl(
                <ReduxProvider store={emptyStore}>
                    <Workspace readonly={true}/>
                </ReduxProvider>,
            ), {wrapper: MemoryRouter})
            container = result.container
            jest.runOnlyPendingTimers()
        })

        expect(container).toMatchSnapshot()
    })

    test('show open card tooltip', async () => {
        const welcomeBoard = TestBlockFactory.createBoard()
        welcomeBoard.title = 'Welcome to Boards!'

        const onboardingCard = TestBlockFactory.createCard(welcomeBoard)
        onboardingCard.id = 'card1'
        onboardingCard.title = 'Create a new card'
        onboardingCard.boardId = welcomeBoard.id

        const localState = {
            teams: {
                current: {id: 'team-id', title: 'Test Team'},
            },
            users: {
                me: {
                    id: 'user-id-1',
                    username: 'username_1',
                    email: '',
                    nickname: '',
                    firstname: '',
                    lastname: '',
                    create_at: 0,
                    update_at: 0,
                    is_bot: false,
                    roles: 'system_user',
                },
                boardUsers: {[me.id]: me},
                blockSubscriptions: [],
                myConfig: {
                    welcomePageViewed: {value: '1'},
                    onboardingTourStarted: {value: true},
                    tourCategory: {value: 'onboarding'},
                    onboardingTourStep: {value: '0'},
                },
            },
            boards: {
                current: welcomeBoard.id,
                boards: {
                    [welcomeBoard.id]: welcomeBoard,
                },
                templates: [],
                myBoardMemberships: {
                    [welcomeBoard.id]: {userId: 'user_id_1', schemeAdmin: true},
                },
            },
            limits: {
                limits: {
                    cards: 0,
                    used_cards: 0,
                    card_limit_timestamp: 0,
                    views: 0,
                },
            },
            globalTemplates: {
                value: [],
            },
            views: {
                views: {
                    [activeView.id]: activeView,
                },
                current: activeView.id,
            },
            cards: {
                templates: [],
                cards: [onboardingCard, card1, card2, card3],
            },
            searchText: {},
            clientConfig: {
                value: {
                    telemetry: true,
                    telemetryid: 'telemetry',
                    enablePublicSharedBoards: true,
                    teammateNameDisplay: 'username',
                    featureFlags: {},
                },
            },
            contents: {
                contents: {},
            },
            comments: {
                comments: {},
            },
            sidebar: {
                categoryAttributes: [
                    categoryAttribute1,
                ],
                hiddenBoardIDs: [],
            },
        }
        const localStore = mockStateStore([thunk], localState)

        await act(async () => {
            render(wrapDNDIntl(
                <ReduxProvider store={localStore}>
                    <Workspace readonly={false}/>
                </ReduxProvider>,
            ), {wrapper: MemoryRouter})
            jest.runOnlyPendingTimers()
        })

        const elements = document.querySelectorAll('.OpenCardTourStep')
        expect(elements.length).toBe(2)
        expect(elements[1]).toMatchSnapshot()
    })

    test('show add new view tooltip', async () => {
        const welcomeBoard = TestBlockFactory.createBoard()
        welcomeBoard.title = 'Welcome to Boards!'

        const onboardingCard = TestBlockFactory.createCard(welcomeBoard)
        onboardingCard.id = 'card1'
        onboardingCard.title = 'Create a new card'
        onboardingCard.boardId = welcomeBoard.id

        const localState = {
            teams: {
                current: {id: 'team-id', title: 'Test Team'},
            },
            users: {
                me: {
                    id: 'user-id-1',
                    username: 'username_1',
                    email: '',
                    nickname: '',
                    firstname: '',
                    lastname: '',
                    create_at: 0,
                    update_at: 0,
                    is_bot: false,
                    roles: 'system_user',
                },
                myConfig: {
                    welcomePageViewed: {value: '1'},
                    onboardingTourStarted: {value: true},
                    tourCategory: {value: 'board'},
                    onboardingTourStep: {value: '0'},
                },
                boardUsers: {[me.id]: me},
                blockSubscriptions: [],
            },
            boards: {
                current: welcomeBoard.id,
                boards: {
                    [welcomeBoard.id]: welcomeBoard,
                },
                templates: [],
                myBoardMemberships: {
                    [welcomeBoard.id]: {userId: 'user_id_1', schemeAdmin: true},
                },
            },
            limits: {
                limits: {
                    cards: 0,
                    used_cards: 0,
                    card_limit_timestamp: 0,
                    views: 0,
                },
            },
            globalTemplates: {
                value: [],
            },
            views: {
                views: {
                    [activeView.id]: activeView,
                },
                current: activeView.id,
            },
            cards: {
                templates: [],
                cards: [onboardingCard, card1, card2, card3],
            },
            searchText: {},
            clientConfig: {
                value: {
                    telemetry: true,
                    telemetryid: 'telemetry',
                    enablePublicSharedBoards: true,
                    teammateNameDisplay: 'username',
                    featureFlags: {},
                },
            },
            contents: {
                contents: {},
            },
            comments: {
                comments: {},
            },
            sidebar: {
                categoryAttributes: [
                    categoryAttribute1,
                ],
                hiddenBoardIDs: [],
            },
        }
        const localStore = mockStateStore([thunk], localState)

        await act(async () => {
            render(wrapDNDIntl(
                <ReduxProvider store={localStore}>
                    <Workspace readonly={false}/>
                </ReduxProvider>,
            ), {wrapper: MemoryRouter})
        })

        jest.runOnlyPendingTimers()

        await waitFor(() => expect(document.querySelectorAll('.AddViewTourStep')).toBeDefined(), {timeout: 5000})

        const elements = document.querySelectorAll('.AddViewTourStep')
        expect(elements.length).toBe(2)
        expect(elements[1]).toMatchSnapshot()
    })

    test('show copy link tooltip', async () => {
        const welcomeBoard = TestBlockFactory.createBoard()
        welcomeBoard.title = 'Welcome to Boards!'

        const onboardingCard = TestBlockFactory.createCard(welcomeBoard)
        onboardingCard.id = 'card1'
        onboardingCard.title = 'Create a new card'
        onboardingCard.boardId = welcomeBoard.id

        const localState = {
            teams: {
                current: {id: 'team-id', title: 'Test Team'},
            },
            users: {
                me: {
                    id: 'user-id-1',
                    username: 'username_1',
                    email: '',
                    nickname: '',
                    firstname: '',
                    lastname: '',
                    create_at: 0,
                    update_at: 0,
                    is_bot: false,
                    roles: 'system_user',
                },
                myConfig: {
                    welcomePageViewed: {value: '1'},
                    onboardingTourStarted: {value: true},
                    tourCategory: {value: 'board'},
                    onboardingTourStep: {value: '1'},
                },
                boardUsers: {[me.id]: me},
                blockSubscriptions: [],
            },
            boards: {
                current: welcomeBoard.id,
                boards: {
                    [welcomeBoard.id]: welcomeBoard,
                },
                templates: [],
                myBoardMemberships: {
                    [welcomeBoard.id]: {userId: 'user_id_1', schemeAdmin: true},
                },
            },
            limits: {
                limits: {
                    cards: 0,
                    used_cards: 0,
                    card_limit_timestamp: 0,
                    views: 0,
                },
            },
            globalTemplates: {
                value: [],
            },
            views: {
                views: {
                    [activeView.id]: activeView,
                },
                current: activeView.id,
            },
            cards: {
                templates: [],
                cards: [onboardingCard, card1, card2, card3],
            },
            searchText: {},
            clientConfig: {
                value: {
                    telemetry: true,
                    telemetryid: 'telemetry',
                    enablePublicSharedBoards: true,
                    teammateNameDisplay: 'username',
                    featureFlags: {},
                },
            },
            contents: {
                contents: {},
            },
            comments: {
                comments: {},
            },
            sidebar: {
                categoryAttributes: [
                    categoryAttribute1,
                ],
                hiddenBoardIDs: [],
            },
        }
        const localStore = mockStateStore([thunk], localState)

        await act(async () => {
            render(wrapDNDIntl(
                <ReduxProvider store={localStore}>
                    <Workspace readonly={false}/>
                </ReduxProvider>,
            ), {wrapper: MemoryRouter})
            jest.runOnlyPendingTimers()
        })

        const elements = document.querySelectorAll('.CopyLinkTourStep')
        expect(elements).toBeDefined()
        expect(elements.length).toBe(2)
        expect(elements[1]).toMatchSnapshot()
    })
})
