// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {Provider as ReduxProvider} from 'react-redux'

import {render, screen} from '@testing-library/react'
import {mocked} from 'jest-mock'
import userEvent from '@testing-library/user-event'

import configureStore from 'redux-mock-store'

import {IUser} from 'src/user'

import {wrapIntl} from 'src/testUtils'

import client from 'src/octoClient'

import {versionProperty} from 'src/store/users'

import VersionMessage from './versionMessage'

jest.mock('src/octoClient')
const mockedOctoClient = mocked(client)

describe('components/messages/VersionMessage', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    const mockStore = configureStore([])

    if (versionProperty) {
        test('single user mode, no display', () => {
            const me: IUser = {
                id: 'single-user',
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
                    <VersionMessage/>
                </ReduxProvider>,
            )
            const {container} = render(component)
            expect(container.firstChild).toBeNull()
        })

        test('property set, no message', () => {
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
                    myConfig: {
                        [versionProperty]: {value: 'true'},
                    },
                },
            }
            const store = mockStore(state)

            const component = wrapIntl(
                <ReduxProvider store={store}>
                    <VersionMessage/>
                </ReduxProvider>,
            )

            const {container} = render(component)
            expect(container.firstChild).toBeNull()
        })

        test('show message, click close', async () => {
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
                    <VersionMessage/>
                </ReduxProvider>,
            )

            render(component)
            const buttonElement = screen.getByRole('button', {name: 'Close dialog'})
            await userEvent.click(buttonElement)
            expect(mockedOctoClient.patchUserConfig).toBeCalledWith('user-id-1', {
                updatedFields: {
                    [versionProperty]: 'true',
                },
            })
        })

        test('no me, no message', () => {
            const state = {
                users: {},
            }
            const store = mockStore(state)
            const component = wrapIntl(
                <ReduxProvider store={store}>
                    <VersionMessage/>
                </ReduxProvider>,
            )

            const {container} = render(component)
            expect(container.firstChild).toBeNull()
        })
    } else {
        test('no version, does not display', () => {
            const me: IUser = {
                id: 'user-id-1',
                username: 'username_1',
                email: '',
                nickname: '',
                firstname: '',
                lastname: '',
                props: {
                },
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
                    <VersionMessage/>
                </ReduxProvider>,
            )
            const {container} = render(component)
            expect(container.firstChild).toBeNull()
        })
    }
})
