// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {render} from '@testing-library/react'
import {Provider as ReduxProvider} from 'react-redux'

import '@testing-library/jest-dom'

import {TestBlockFactory} from 'src/test/testBlockFactory'
import {Permission} from 'src/constants'

import {wrapIntl, mockStateStore} from 'src/testUtils'

import BoardPermissionGate from './boardPermissionGate'

const board = TestBlockFactory.createBoard()

describe('components/permission/boardPermissionGate', () => {
    const state = {
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
    }
    const store = mockStateStore([], state)
    test('match snapshot when the user has the permissions', () => {
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <BoardPermissionGate
                        permissions={[Permission.ManageBoardCards]}
                    >
                        {'Content'}
                    </BoardPermissionGate>
                </ReduxProvider>,
            ),
        )
        expect(container).toMatchSnapshot()
    })

    test('match snapshot when the user has the permissions with invert', () => {
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <BoardPermissionGate
                        permissions={[Permission.ManageBoardCards]}
                        invert={true}
                    >
                        {'Content'}
                    </BoardPermissionGate>
                </ReduxProvider>,
            ),
        )
        expect(container).toMatchSnapshot()
    })

    test('match snapshot when the user doesnt have the permissions', () => {
        const localStore = mockStateStore([], {...state, teams: {current: undefined}})
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={localStore}>
                    <BoardPermissionGate
                        permissions={[Permission.ManageBoardCards]}
                    >
                        {'Content'}
                    </BoardPermissionGate>
                </ReduxProvider>,
            ),
        )
        expect(container).toMatchSnapshot()
    })

    test('match snapshot when the user doesnt have the permissions with invert', () => {
        const localStore = mockStateStore([], {...state, teams: {current: undefined}})
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={localStore}>
                    <BoardPermissionGate
                        permissions={[Permission.ManageBoardCards]}
                        invert={true}
                    >
                        {'Content'}
                    </BoardPermissionGate>
                </ReduxProvider>,
            ),
        )
        expect(container).toMatchSnapshot()
    })
})
