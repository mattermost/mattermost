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

import SidebarBoardItem from './sidebarBoardItem'

describe('components/sidebarBoardItem', () => {
    const board = TestBlockFactory.createBoard()
    board.id = 'board_id_1'

    const view = TestBlockFactory.createBoardView(board)
    view.fields.sortOptions = []
    const history = createMemoryHistory()

    const categoryBoards1 = TestBlockFactory.createCategoryBoards()
    categoryBoards1.name = 'Category 1'
    categoryBoards1.boardMetadata = [{boardID: board.id, hidden: false}]

    const categoryBoards2 = TestBlockFactory.createCategoryBoards()
    categoryBoards2.name = 'Category 2'

    const categoryBoards3 = TestBlockFactory.createCategoryBoards()
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
            },
        },
        boards: {
            current: board.id,
            boards: {
                [board.id]: board,
            },
            myBoardMemberships: {
                [board.id]: {userId: 'user_id_1', schemeAdmin: true},
            },
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

    test('sidebar board item', async () => {
        const mockStore = configureStore([])
        const store = mockStore(state)

        const component = wrapRBDNDDroppable(wrapIntl(
            <ReduxProvider store={store}>
                <Router history={history}>
                    <SidebarBoardItem
                        index={0}
                        categoryBoards={categoryBoards1}
                        board={board}
                        allCategories={allCategoryBoards}
                        isActive={true}
                        showBoard={jest.fn()}
                        showView={jest.fn()}
                        onDeleteRequest={jest.fn()}
                    />
                </Router>
            </ReduxProvider>,
        ))
        const {container} = render(component)
        const elementMenuWrapper = container.querySelector('.SidebarBoardItem div.MenuWrapper')
        expect(elementMenuWrapper).not.toBeNull()
        await userEvent.click(elementMenuWrapper!)
        expect(container).toMatchSnapshot()
    })

    test('renders default icon if no custom icon set', () => {
        const mockStore = configureStore([])
        const store = mockStore(state)
        const noIconBoard = {...board, icon: ''}

        const component = wrapRBDNDDroppable(wrapIntl(
            <ReduxProvider store={store}>
                <Router history={history}>
                    <SidebarBoardItem
                        index={0}
                        categoryBoards={categoryBoards1}
                        board={noIconBoard}
                        allCategories={allCategoryBoards}
                        isActive={true}
                        showBoard={jest.fn()}
                        showView={jest.fn()}
                        onDeleteRequest={jest.fn()}
                    />
                </Router>
            </ReduxProvider>,
        ))
        const {container} = render(component)
        expect(container).toMatchSnapshot()
    })

    test('sidebar board item for guest', async () => {
        const mockStore = configureStore([])
        const store = mockStore({...state, users: {me: {is_guest: true}}})

        const component = wrapRBDNDDroppable(wrapIntl(
            <ReduxProvider store={store}>
                <Router history={history}>
                    <SidebarBoardItem
                        index={0}
                        categoryBoards={categoryBoards1}
                        board={board}
                        allCategories={allCategoryBoards}
                        isActive={true}
                        showBoard={jest.fn()}
                        showView={jest.fn()}
                        onDeleteRequest={jest.fn()}
                    />
                </Router>
            </ReduxProvider>,
        ))
        const {container} = render(component)
        const elementMenuWrapper = container.querySelector('.SidebarBoardItem div.MenuWrapper')
        expect(elementMenuWrapper).not.toBeNull()
        await userEvent.click(elementMenuWrapper!)
        expect(container).toMatchSnapshot()
    })
})
