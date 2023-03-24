// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {Provider as ReduxProvider} from 'react-redux'
import {render, screen} from '@testing-library/react'

import userEvent from '@testing-library/user-event'

import {createBoard} from 'src/blocks/board'
import {mockStateStore, wrapIntl} from 'src/testUtils'

import {TestBlockFactory} from 'src/test/testBlockFactory'

import RHSChannelBoardItem from './rhsChannelBoardItem'

describe('components/rhsChannelBoardItem', () => {
    it('render board', async () => {
        const board = createBoard()
        const state = {
            teams: {
                current: {
                    id: 'team-id',
                    name: 'team',
                    display_name: 'Team name',
                },
            },
            boards: {
                myBoardMemberships: {
                    [board.id]: {userId: 'user_id_1', schemeAdmin: true},
                },
            }
        }
        board.updateAt = 1657311058157
        board.title = 'Test board'

        const store = mockStateStore([], state)
        const {container} = render(wrapIntl(
            <ReduxProvider store={store}>
                <RHSChannelBoardItem board={board} />
            </ReduxProvider>
        ))
        expect(container).toMatchSnapshot()
    })

    it('render board with menu open', async () => {
        const board = TestBlockFactory.createBoard()
        const state = {
            teams: {
                current: {
                    id: 'team-id',
                    name: 'team',
                    display_name: 'Team name',
                },
            },
            boards: {
                myBoardMemberships: {
                    [board.id]: {userId: 'user_id_1', schemeAdmin: true},
                },
            }
        }
        board.id = 'test_id'
        board.title = 'New board'
        board.description = '**Board** with description'
        board.updateAt = 1657311058157
        const store = mockStateStore([], state)
        const {container} = render(wrapIntl(
            <ReduxProvider store={store}>
                <RHSChannelBoardItem board={board} />
            </ReduxProvider>
        ))

        const buttonElement = screen.getByRole('button', {name: 'menuwrapper'})
        await userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
    })
})
