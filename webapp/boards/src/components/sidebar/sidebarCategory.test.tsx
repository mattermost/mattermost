// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'

import {createMemoryHistory} from 'history'
import {Router} from 'react-router-dom'

import {render} from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {Provider as ReduxProvider} from 'react-redux'

import configureStore from 'redux-mock-store'

import {TestBlockFactory} from 'src/test/testBlockFactory'

import {wrapIntl, wrapRBDNDDroppable} from 'src/testUtils'

import SidebarCategory from './sidebarCategory'

describe('components/sidebarCategory', () => {
    const board = TestBlockFactory.createBoard()
    board.id = 'board_id'

    const view = TestBlockFactory.createBoardView(board)
    view.fields.sortOptions = []
    const history = createMemoryHistory()

    const board1 = TestBlockFactory.createBoard()
    board1.id = 'board_1_id'

    const board2 = TestBlockFactory.createBoard()
    board2.id = 'board_2_id'

    const boards = [board1, board2]
    const categoryBoards1 = TestBlockFactory.createCategoryBoards()
    categoryBoards1.id = 'category_1_id'
    categoryBoards1.name = 'Category 1'
    categoryBoards1.boardMetadata = [{boardID: board1.id, hidden: false}, {boardID: board2.id, hidden: false}]

    const categoryBoards2 = TestBlockFactory.createCategoryBoards()
    categoryBoards2.id = 'category_2_id'
    categoryBoards2.name = 'Category 2'

    const categoryBoards3 = TestBlockFactory.createCategoryBoards()
    categoryBoards3.id = 'category_id_3'
    categoryBoards3.name = 'Category 3'

    const allCategoryBoards = [
        categoryBoards1,
        categoryBoards2,
        categoryBoards3,
    ]

    const state = {
        users: {
            me: {
                id: 'user_id_1',
                props: {},
            },
        },
        boards: {
            current: board.id,
            boards: {
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
            current: view.id,
            views: {
                [view.id]: view,
            },
        },
        teams: {
            current: {
                id: 'team-id',
            },
        },
    }

    test('sidebar call hideSidebar', () => {
        const mockStore = configureStore([])
        const store = mockStore(state)

        const component = wrapRBDNDDroppable(wrapIntl(
            <ReduxProvider store={store}>
                <Router history={history}>
                    <SidebarCategory
                        hideSidebar={() => {}}
                        categoryBoards={categoryBoards1}
                        boards={boards}
                        allCategories={allCategoryBoards}
                        index={0}
                    />
                </Router>
            </ReduxProvider>,
        ))
        const {container} = render(component)
        expect(container).toMatchSnapshot()

        // testing collapsed state of category
        const subItems = container.querySelectorAll('.category')
        expect(subItems).toBeDefined()
        userEvent.click(subItems[0] as Element)
        expect(container).toMatchSnapshot()
    })

    test('sidebar collapsed without active board', () => {
        const mockStore = configureStore([])
        const store = mockStore(state)

        const component = wrapRBDNDDroppable(wrapIntl(
            <ReduxProvider store={store}>
                <Router history={history}>
                    <SidebarCategory
                        hideSidebar={() => {}}
                        categoryBoards={categoryBoards1}
                        boards={boards}
                        allCategories={allCategoryBoards}
                        index={0}
                    />
                </Router>
            </ReduxProvider>,
        ))
        const {container} = render(component)

        const subItems = container.querySelectorAll('.category-title')
        expect(subItems).toBeDefined()
        userEvent.click(subItems[0] as Element)
        expect(container).toMatchSnapshot()
    })

    test('sidebar collapsed with active board in it', () => {
        const mockStore = configureStore([])
        const store = mockStore(state)

        const component = wrapRBDNDDroppable(wrapIntl(
            <ReduxProvider store={store}>
                <Router history={history}>
                    <SidebarCategory
                        hideSidebar={() => {}}
                        activeBoardID={board1.id}
                        categoryBoards={categoryBoards1}
                        boards={boards}
                        allCategories={allCategoryBoards}
                        index={0}
                    />
                </Router>
            </ReduxProvider>,
        ))
        const {container} = render(component)

        const subItems = container.querySelectorAll('.category-title')
        expect(subItems).toBeDefined()
        userEvent.click(subItems[0] as Element)
        expect(container).toMatchSnapshot()
    })

    test('sidebar template close self', () => {
        const mockStore = configureStore([])
        const store = mockStore(state)

        const mockTemplateClose = jest.fn()

        const component = wrapRBDNDDroppable(wrapIntl(
            <ReduxProvider store={store}>
                <Router history={history}>
                    <SidebarCategory
                        activeBoardID={board1.id}
                        hideSidebar={() => {}}
                        categoryBoards={categoryBoards1}
                        boards={boards}
                        allCategories={allCategoryBoards}
                        index={0}
                        onBoardTemplateSelectorClose={mockTemplateClose}
                    />
                </Router>
            </ReduxProvider>,
        ))
        const {container} = render(component)
        expect(container).toMatchSnapshot()

        // testing collapsed state of category
        const subItems = container.querySelectorAll('.subitem')
        expect(subItems).toBeDefined()
        userEvent.click(subItems[0] as Element)
        expect(mockTemplateClose).toBeCalled()
    })

    test('sidebar template close other', () => {
        const mockStore = configureStore([])
        const store = mockStore(state)

        const mockTemplateClose = jest.fn()

        const component = wrapRBDNDDroppable(wrapIntl(
            <ReduxProvider store={store}>
                <Router history={history}>
                    <SidebarCategory
                        activeBoardID={board2.id}
                        hideSidebar={() => {}}
                        categoryBoards={categoryBoards1}
                        boards={boards}
                        allCategories={allCategoryBoards}
                        index={0}
                        onBoardTemplateSelectorClose={mockTemplateClose}
                    />
                </Router>
            </ReduxProvider>,
        ))
        const {container} = render(component)
        expect(container).toMatchSnapshot()

        // testing collapsed state of category
        const subItems = container.querySelectorAll('.category-title')
        expect(subItems).toBeDefined()
        userEvent.click(subItems[0] as Element)
        expect(mockTemplateClose).not.toBeCalled()
    })
})
