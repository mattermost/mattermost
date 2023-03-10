// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {render} from '@testing-library/react'
import {Provider as ReduxProvider} from 'react-redux'

import '@testing-library/jest-dom'

import {TestBlockFactory} from 'src/test/testBlockFactory'

import {wrapIntl, mockStateStore} from 'src/testUtils'

import ViewHeader from './viewHeader'

const board = TestBlockFactory.createBoard()
const activeView = TestBlockFactory.createBoardView(board)
const card = TestBlockFactory.createCard(board)
const card2 = TestBlockFactory.createCard(board)

jest.mock('react-router-dom', () => {
    const originalModule = jest.requireActual('react-router-dom')

    return {
        ...originalModule,
        useRouteMatch: jest.fn(() => {
            return {url: '/board/view'}
        }),
    }
})

describe('components/viewHeader/viewHeader', () => {
    const state = {
        users: {
            me: {
                id: 'user-id-1',
                username: 'username_1',
                props: {},
            },
        },
        searchText: {
        },
        teams: {
            current: {id: 'team-id'},
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
        cards: {
            templates: [card],
            cards: {
                [card2.id]: card2,
            },
            current: card2.id,
        },
        views: {
            views: {
                boardView: activeView,
            },
            current: 'boardView',
        },
        limits: {
            limits: {
                views: 0,
            },
        },
    }
    const store = mockStateStore([], state)
    test('return viewHeader', () => {
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <ViewHeader
                        board={board}
                        activeView={activeView}
                        views={[activeView]}
                        cards={[card]}
                        groupByProperty={board.cardProperties[0]}
                        addCard={jest.fn()}
                        addCardFromTemplate={jest.fn()}
                        addCardTemplate={jest.fn()}
                        editCardTemplate={jest.fn()}
                        readonly={false}
                    />
                </ReduxProvider>,
            ),
        )
        expect(container).toMatchSnapshot()
    })
    test('return viewHeader without permissions', () => {
        const localStore = mockStateStore([], {...state, teams: {current: undefined}})
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={localStore}>
                    <ViewHeader
                        board={board}
                        activeView={activeView}
                        views={[activeView]}
                        cards={[card]}
                        groupByProperty={board.cardProperties[0]}
                        addCard={jest.fn()}
                        addCardFromTemplate={jest.fn()}
                        addCardTemplate={jest.fn()}
                        editCardTemplate={jest.fn()}
                        readonly={false}
                    />
                </ReduxProvider>,
            ),
        )
        expect(container).toMatchSnapshot()
    })
    test('return viewHeader readonly', () => {
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <ViewHeader
                        board={board}
                        activeView={activeView}
                        views={[activeView]}
                        cards={[card]}
                        groupByProperty={board.cardProperties[0]}
                        addCard={jest.fn()}
                        addCardFromTemplate={jest.fn()}
                        addCardTemplate={jest.fn()}
                        editCardTemplate={jest.fn()}
                        readonly={true}
                    />
                </ReduxProvider>,
            ),
        )
        expect(container).toMatchSnapshot()
    })
})
