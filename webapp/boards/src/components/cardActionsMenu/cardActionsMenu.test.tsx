// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, render} from '@testing-library/react'
import React from 'react'
import {Provider as ReduxProvider} from 'react-redux'

import {TestBlockFactory} from 'src/test/testBlockFactory'
import {mockDOM, mockStateStore, wrapIntl} from 'src/testUtils'

import CardActionsMenu from './cardActionsMenu'

beforeAll(() => {
    mockDOM()
})

describe('components/cardActionsMenu', () => {
    const board = TestBlockFactory.createBoard()
    board.id = 'boardId'

    const state = {
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
        teams: {
            current: {id: 'team-id'},
        },
        users: {
            me: {
                id: 'user_id_1',
            },
        },
    }
    const store = mockStateStore([], state)

    test('should match snapshot', async () => {
        let container
        await act(async () => {
            const result = render(wrapIntl(
                <ReduxProvider store={store}>
                    <CardActionsMenu
                        cardId='123'
                        boardId='345'
                        onClickDelete={jest.fn()}
                    />
                </ReduxProvider>,
            ))
            container = result.container
        })
        expect(container).toMatchSnapshot()
    })

    test('should match snapshot w/ onClickDuplicate prop', async () => {
        let container
        await act(async () => {
            const result = render(wrapIntl(
                <ReduxProvider store={store}>
                    <CardActionsMenu
                        cardId='123'
                        boardId='345'
                        onClickDelete={jest.fn()}
                        onClickDuplicate={jest.fn()}
                    />
                </ReduxProvider>,
            ))
            container = result.container
        })
        expect(container).toMatchSnapshot()
    })

    test('should match snapshot w/ children prop', async () => {
        let container
        await act(async () => {
            const result = render(wrapIntl(
                <ReduxProvider store={store}>
                    <CardActionsMenu
                        cardId='123'
                        boardId='345'
                        onClickDelete={jest.fn()}
                    >
                        <React.Fragment>
                            {'Test.'}
                        </React.Fragment>
                    </CardActionsMenu>
                </ReduxProvider>,
            ))
            container = result.container
        })
        expect(container).toMatchSnapshot()
    })
})
