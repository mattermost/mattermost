// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import configureStore from 'redux-mock-store'

import {createMemoryHistory} from 'history'
import {Provider as ReduxProvider} from 'react-redux'
import {Router} from 'react-router-dom'

import {render} from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import thunk from 'redux-thunk'

import {mocked} from 'jest-mock'

import {mockMatchMedia, wrapIntl} from 'src/testUtils'

import {TestBlockFactory} from 'src/test/testBlockFactory'
import octoClient from 'src/octoClient'

import Sidebar from './sidebar'

jest.mock('src/octoClient')
const mockedOctoClient = mocked(octoClient)

beforeAll(() => {
    mockMatchMedia({matches: true})
})

describe('components/sidebarSidebar', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    const mockStore = configureStore([thunk])

    const board = TestBlockFactory.createBoard()
    board.id = 'board1'

    const categoryAttribute1 = TestBlockFactory.createCategoryBoards()
    categoryAttribute1.id = 'category1'
    categoryAttribute1.name = 'Category 1'
    categoryAttribute1.boardMetadata = [{boardID: board.id, hidden: false}]

    const defaultCategory = TestBlockFactory.createCategoryBoards()
    defaultCategory.id = 'default_category'
    defaultCategory.name = 'Boards'
    defaultCategory.boardMetadata = []

    test('sidebar hidden', async () => {
        const store = mockStore({
            teams: {
                current: {id: 'team-id'},
            },
            boards: {
                current: board.id,
                boards: {
                    [board.id]: board,
                },
                myBoardMemberships: {
                    [board.id]: board,
                },
            },
            cards: {
                cards: {
                    card_id_1: {title: 'Card'},
                },
                current: 'card_id_1',
            },
            views: {
                views: [],
            },
            users: {
                me: {
                    id: 'user_id_1',
                    props: {},
                },
            },
            sidebar: {
                categoryAttributes: [
                    categoryAttribute1,
                ],
                hiddenBoardIDs: [],
            },
        })

        const history = createMemoryHistory()
        const onBoardTemplateSelectorOpen = jest.fn()

        const component = wrapIntl(
            <ReduxProvider store={store}>
                <Router history={history}>
                    <Sidebar onBoardTemplateSelectorOpen={onBoardTemplateSelectorOpen}/>
                </Router>
            </ReduxProvider>,
        )
        const {container} = render(component)
        expect(container).toMatchSnapshot()

        const hideSidebar = container.querySelector('button > .HideSidebarIcon')
        expect(hideSidebar).toBeDefined()

        await userEvent.click(hideSidebar as Element)
        expect(container).toMatchSnapshot()

        const showSidebar = container.querySelector('button > .ShowSidebarIcon')
        expect(showSidebar).toBeDefined()
    })

    test('sidebar expect hidden', () => {
        const customGlobal = global as any

        customGlobal.innerWidth = 500

        const localCategoryAttribute = TestBlockFactory.createCategoryBoards()
        localCategoryAttribute.id = 'category1'
        localCategoryAttribute.name = 'Category 1'
        categoryAttribute1.boardMetadata = [{boardID: board.id, hidden: false}]

        const store = mockStore({
            teams: {
                current: {id: 'team-id'},
            },
            boards: {
                current: board.id,
                boards: {
                    [board.id]: board,
                },
                myBoardMemberships: {
                    [board.id]: board,
                },
            },
            cards: {
                cards: {
                    card_id_1: {title: 'Card'},
                },
                current: 'card_id_1',
            },
            views: {
                views: [],
            },
            users: {
                me: {
                    id: 'user_id_1',
                    props: {},
                },
            },
            sidebar: {
                categoryAttributes: [
                    categoryAttribute1,
                ],
                hiddenBoardIDs: [],
            },
        })

        const history = createMemoryHistory()
        const onBoardTemplateSelectorOpen = jest.fn()

        const component = wrapIntl(
            <ReduxProvider store={store}>
                <Router history={history}>
                    <Sidebar onBoardTemplateSelectorOpen={onBoardTemplateSelectorOpen}/>
                </Router>
            </ReduxProvider>,
        )
        const {container} = render(component)
        expect(container).toMatchSnapshot()

        const hideSidebar = container.querySelector('button > .HideSidebarIcon')
        expect(hideSidebar).toBeNull()

        const showSidebar = container.querySelector('button > .ShowSidebarIcon')
        expect(showSidebar).toBeDefined()

        customGlobal.innerWidth = 1024
    })

    test('dont show hidden boards', () => {
        const localCategoryAttribute = TestBlockFactory.createCategoryBoards()
        localCategoryAttribute.id = 'category1'
        localCategoryAttribute.name = 'Category 1'
        localCategoryAttribute.boardMetadata = [{boardID: board.id, hidden: true}]

        const store = mockStore({
            teams: {
                current: {id: 'team-id'},
            },
            boards: {
                current: board.id,
                boards: {
                    [board.id]: board,
                },
                myBoardMemberships: {
                    [board.id]: board,
                },
            },
            cards: {
                cards: {
                    card_id_1: {title: 'Card'},
                },
                current: 'card_id_1',
            },
            views: {
                views: [],
            },
            users: {
                me: {
                    id: 'user_id_1',
                },
                myConfig: {
                    hiddenBoardIDs: {value: {
                        [board.id]: true,
                    }},
                },
            },
            sidebar: {
                categoryAttributes: [
                    localCategoryAttribute,
                ],
                hiddenBoardIDs: [board.id],
            },
        })

        const history = createMemoryHistory()
        const onBoardTemplateSelectorOpen = jest.fn()

        const component = wrapIntl(
            <ReduxProvider store={store}>
                <Router history={history}>
                    <Sidebar onBoardTemplateSelectorOpen={onBoardTemplateSelectorOpen}/>
                </Router>
            </ReduxProvider>,
        )
        const {container, getAllByText} = render(component)
        expect(container).toMatchSnapshot()

        const sidebarBoards = container.getElementsByClassName('SidebarBoardItem')

        // The only board in redux store is hidden, so there should
        // be no boards visible in sidebar
        expect(sidebarBoards.length).toBe(0)

        const noBoardsText = getAllByText('No boards inside')
        expect(noBoardsText.length).toBe(1)
    })

    test('some categories hidden', () => {
        const collapsedCategory = TestBlockFactory.createCategoryBoards()
        collapsedCategory.id = 'categoryCollapsed'
        collapsedCategory.name = 'Category 2'
        collapsedCategory.collapsed = true
        collapsedCategory.boardMetadata = []

        const store = mockStore({
            teams: {
                current: {id: 'team-id'},
            },
            boards: {
                current: board.id,
                boards: {
                    [board.id]: board,
                },
                myBoardMemberships: {
                    [board.id]: board,
                },
            },
            cards: {
                cards: {
                    card_id_1: {title: 'Card'},
                },
                current: 'card_id_1',
            },
            views: {
                views: [],
            },
            users: {
                me: {
                    id: 'user_id_1',
                    props: {},
                },
            },
            sidebar: {
                categoryAttributes: [
                    categoryAttribute1,
                    collapsedCategory,
                ],
                hiddenBoardIDs: [],
            },
        })

        const history = createMemoryHistory()
        const onBoardTemplateSelectorOpen = jest.fn()

        const component = wrapIntl(
            <ReduxProvider store={store}>
                <Router history={history}>
                    <Sidebar onBoardTemplateSelectorOpen={onBoardTemplateSelectorOpen}/>
                </Router>
            </ReduxProvider>,
        )
        const {container} = render(component)
        expect(container).toMatchSnapshot()

        const sidebarCollapsedCategory = container.querySelectorAll('.octo-sidebar-item.category.collapsed')
        expect(sidebarCollapsedCategory.length).toBe(1)
    })

    test('should assign default category if current board doesnt have a category', () => {
        const board2 = TestBlockFactory.createBoard()
        board2.id = 'board2'

        const store = mockStore({
            teams: {
                current: {id: 'team-id'},
            },
            boards: {
                current: board2.id,
                boards: {
                    [board2.id]: board2,
                },
                myBoardMemberships: {
                    [board2.id]: board2,
                },
            },
            cards: {
                cards: {
                    card_id_1: {title: 'Card'},
                },
                current: 'card_id_1',
            },
            views: {
                views: [],
            },
            users: {
                me: {
                    id: 'user_id_1',
                    props: {},
                },
            },
            sidebar: {
                categoryAttributes: [
                    categoryAttribute1,
                    defaultCategory,
                ],
                hiddenBoardIDs: [],
            },
        })

        const history = createMemoryHistory()
        const onBoardTemplateSelectorOpen = jest.fn()

        mockedOctoClient.moveBoardToCategory.mockResolvedValueOnce({} as Response)

        const component = wrapIntl(
            <ReduxProvider store={store}>
                <Router history={history}>
                    <Sidebar onBoardTemplateSelectorOpen={onBoardTemplateSelectorOpen}/>
                </Router>
            </ReduxProvider>,
        )
        const {container} = render(component)
        expect(container).toMatchSnapshot()

        expect(mockedOctoClient.moveBoardToCategory).toBeCalledWith('team-id', 'board2', 'default_category', '')
    })

    test('shouldnt do any category assignment is board is in a category', () => {
        const board2 = TestBlockFactory.createBoard()
        board2.id = 'board2'

        const categoryAttribute2 = TestBlockFactory.createCategoryBoards()
        categoryAttribute2.id = 'category2'
        categoryAttribute2.name = 'Category 2'
        categoryAttribute2.boardMetadata = [{boardID: board2.id, hidden: false}]

        const store = mockStore({
            teams: {
                current: {id: 'team-id'},
            },
            boards: {
                current: board2.id,
                boards: {
                    [board2.id]: board2,
                },
                myBoardMemberships: {
                    [board2.id]: board2,
                },
            },
            cards: {
                cards: {
                    card_id_1: {title: 'Card'},
                },
                current: 'card_id_1',
            },
            views: {
                views: [],
            },
            users: {
                me: {
                    id: 'user_id_1',
                    props: {},
                },
            },
            sidebar: {
                categoryAttributes: [
                    categoryAttribute1,
                    categoryAttribute2,
                    defaultCategory,
                ],
            },
        })

        const history = createMemoryHistory()
        const onBoardTemplateSelectorOpen = jest.fn()

        const component = wrapIntl(
            <ReduxProvider store={store}>
                <Router history={history}>
                    <Sidebar onBoardTemplateSelectorOpen={onBoardTemplateSelectorOpen}/>
                </Router>
            </ReduxProvider>,
        )
        const {container} = render(component)
        expect(container).toMatchSnapshot()

        expect(mockedOctoClient.moveBoardToCategory).toBeCalledTimes(0)
    })

    // TODO: Fix this later
    // test('global templates', () => {
    //     const store = mockStore({
    //         teams: {
    //             current: {id: 'team-id'},
    //         },
    //         boards: {
    //             boards: [],
    //             templates: [
    //                 {id: '1', title: 'Template 1', fields: {icon: '🚴🏻‍♂️'}},
    //                 {id: '2', title: 'Template 2', fields: {icon: '🚴🏻‍♂️'}},
    //                 {id: '3', title: 'Template 3', fields: {icon: '🚴🏻‍♂️'}},
    //                 {id: '4', title: 'Template 4', fields: {icon: '🚴🏻‍♂️'}},
    //             ],
    //         },
    //         views: {
    //             views: [],
    //         },
    //         users: {
    //             me: {},
    //         },
    //         globalTemplates: {
    //             value: [],
    //         },
    //         sidebar: {
    //             categoryAttributes: [
    //                 categoryAttribute1,
    //             ],
    //         },
    //     })

    //     const history = createMemoryHistory()

    //     const component = wrapIntl(
    //         <ReduxProvider store={store}>
    //             <Router history={history}>
    //                 <Sidebar onBoardTemplateSelectorOpen={onBoardTemplateSelectorOpen}/>
    //             </Router>
    //         </ReduxProvider>,
    //     )
    //     const {container} = render(component)
    //     expect(container).toMatchSnapshot()

    //     const addBoardButton = container.querySelector('.SidebarAddBoardMenu > .MenuWrapper')
    //     expect(addBoardButton).toBeDefined()
    //     userEvent.click(addBoardButton as Element)
    //     const templates = container.querySelectorAll('.SidebarAddBoardMenu > .MenuWrapper div:not(.hideOnWidescreen).menu-options .menu-name')
    //     expect(templates).toBeDefined()

    //     console.log(templates[0].innerHTML)
    //     console.log(templates[1].innerHTML)

    //     // 4 mocked templates, one "Select a template", one "Empty Board" and one "+ New Template"
    //     expect(templates.length).toBe(7)
    // })
})
