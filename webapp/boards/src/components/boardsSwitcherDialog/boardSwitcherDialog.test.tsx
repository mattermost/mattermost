// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'

import {MockStoreEnhanced} from 'redux-mock-store'

import {Provider as ReduxProvider} from 'react-redux'

import {render} from '@testing-library/react'

import {History, createMemoryHistory} from 'history'

import {Router} from 'react-router-dom'

import {Team} from 'src/store/teams'
import {TestBlockFactory} from 'src/test/testBlockFactory'

import {mockStateStore, wrapDNDIntl} from 'src/testUtils'

import BoardSwitcherDialog from './boardSwitcherDialog'

describe('component/BoardSwitcherDialog', () => {
    const team1: Team = {
        id: 'team-id-1',
        title: 'Dunder Mifflin',
        signupToken: '',
        updateAt: 0,
        modifiedBy: 'michael-scott',
    }

    const team2: Team = {
        id: 'team-id-2',
        title: 'Michael Scott Paper Company',
        signupToken: '',
        updateAt: 0,
        modifiedBy: 'michael-scott',
    }

    const me = TestBlockFactory.createUser()

    const state = {
        users: {
            me,
        },
        teams: {
            allTeams: [team1, team2],
            current: team1,
        },
    }

    let store: MockStoreEnhanced<unknown, unknown>
    let history: History

    beforeEach(() => {
        store = mockStateStore([], state)
        history = createMemoryHistory()
    })

    test('base case', () => {
        const onCloseHandler = jest.fn()
        const component = wrapDNDIntl(
            <Router history={history}>
                <ReduxProvider store={store}>
                    <BoardSwitcherDialog onClose={onCloseHandler}/>
                </ReduxProvider>
            </Router>,
        )

        const {container} = render(component)
        expect(container).toMatchSnapshot()
    })
})
