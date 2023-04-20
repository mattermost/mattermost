// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {render} from '@testing-library/react'
import 'isomorphic-fetch'
import userEvent from '@testing-library/user-event'

import React from 'react'
import {Provider as ReduxProvider} from 'react-redux'
import {Router} from 'react-router-dom'
import {createMemoryHistory} from 'history'

import configureStore from 'redux-mock-store'

import {FetchMock} from 'src/test/fetchMock'
import {TestBlockFactory} from 'src/test/testBlockFactory'
import {wrapDNDIntl} from 'src/testUtils'

import ViewMenu from './viewMenu'

global.fetch = FetchMock.fn

beforeEach(() => {
    FetchMock.fn.mockReset()
})

describe('/components/viewMenu', () => {
    const board = TestBlockFactory.createBoard()
    const boardView = TestBlockFactory.createBoardView(board)
    const tableView = TestBlockFactory.createTableView(board)
    const activeView = boardView
    const views = [boardView, tableView]

    const card = TestBlockFactory.createCard(board)
    activeView.fields.viewType = 'table'
    activeView.fields.groupById = undefined
    activeView.fields.visiblePropertyIds = ['property1', 'property2']

    const state = {
        users: {
            me: {
                id: 'user-id-1',
                username: 'username_1',
            },
        },
        searchText: {},
        teams: {
            current: {id: 'team-id'},
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
        cards: {
            templates: [card],
        },
        views: {
            views: {
                boardView: activeView,
            },
            current: 'boardView',
        },
        clientConfig: {},
    }

    const history = createMemoryHistory()

    it('should match snapshot', () => {
        const mockStore = configureStore([])
        const store = mockStore(state)

        const component = wrapDNDIntl(
            <ReduxProvider store={store}>
                <Router history={history}>
                    <ViewMenu
                        board={board}
                        activeView={activeView}
                        views={views}
                        readonly={false}
                        allowCreateView={() => false}
                    />
                </Router>
            </ReduxProvider>,
        )

        const container = render(component)
        expect(container).toMatchSnapshot()
    })

    it('should match snapshot, read only', () => {
        const mockStore = configureStore([])
        const store = mockStore(state)

        const component = wrapDNDIntl(
            <ReduxProvider store={store}>
                <Router history={history}>
                    <ViewMenu
                        board={board}
                        activeView={activeView}
                        views={views}
                        readonly={true}
                        allowCreateView={() => false}
                    />
                </Router>
            </ReduxProvider>,
        )

        const container = render(component)
        expect(container).toMatchSnapshot()
    })

    it('should check view limits', async () => {
        const mockStore = configureStore([])
        const store = mockStore(state)

        const mockedallowCreateView = jest.fn()
        mockedallowCreateView.mockReturnValue(false)

        const component = wrapDNDIntl(
            <ReduxProvider store={store}>
                <Router history={history}>
                    <ViewMenu
                        board={board}
                        activeView={activeView}
                        views={views}
                        readonly={false}
                        allowCreateView={mockedallowCreateView}
                    />
                </Router>
            </ReduxProvider>,
        )

        const container = render(component)

        const buttonElement = container.getByRole('button', {name: 'Duplicate view'})
        await userEvent.click(buttonElement)
        expect(mockedallowCreateView).toBeCalledTimes(1)
    })
})
