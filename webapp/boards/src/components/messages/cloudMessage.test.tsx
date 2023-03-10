// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {Provider as ReduxProvider} from 'react-redux'

import {render} from '@testing-library/react'

import configureStore from 'redux-mock-store'

import {IUser} from 'src/user'

import {wrapIntl} from 'src/testUtils'

import CloudMessage from './cloudMessage'

describe('components/messages/CloudMessage', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    const mockStore = configureStore([])

    test('plugin mode, no display', () => {
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
        const state = {
            users: {
                me,
            },
        }

        const store = mockStore(state)

        const component = wrapIntl(
            <ReduxProvider store={store}>
                <CloudMessage/>
            </ReduxProvider>,
        )

        const {container} = render(component)
        expect(container).toMatchSnapshot()
    })
})
