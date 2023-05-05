// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {Provider as ReduxProvider} from 'react-redux'

import {render, waitFor} from '@testing-library/react'

import configureStore from 'redux-mock-store'

import userEvent from '@testing-library/user-event'

import {wrapIntl} from 'src/testUtils'

import PersonProperty from 'src/properties/person/property'

import PersonSelector from './personSelector'

describe('properties/person', () => {
    const mockStore = configureStore([])
    const state = {
        users: {
            me: {
                'user-id-1': {
                    id: 'user-id-1',
                    username: 'username-1',
                    email: 'user-1@example.com',
                    firstname: 'test',
                    lastname: 'user',
                    props: {},
                    create_at: 1621315184,
                    update_at: 1621315184,
                    delete_at: 0,
                },
            },
            boardUsers: {
                'user-id-1': {
                    id: 'user-id-1',
                    username: 'username-1',
                    email: 'user-1@example.com',
                    firstname: 'test',
                    lastname: 'user',
                    props: {},
                    create_at: 1621315184,
                    update_at: 1621315184,
                    delete_at: 0,
                },
                'user-id-2': {
                    id: 'user-id-2',
                    username: 'username-2',
                    email: 'user-2@example.com',
                    props: {},
                    create_at: 1621315184,
                    update_at: 1621315184,
                    delete_at: 0,
                },
                'user-id-3': {
                    id: 'user-id-3',
                    username: 'username-3',
                    email: 'user-3@example.com',
                    props: {},
                    create_at: 1621315184,
                    update_at: 1621315184,
                    delete_at: 0,
                },
            },
        },
        clientConfig: {
            value: {
                teammateNameDisplay: 'username',
            },
        },
    }

    test('not readOnly, show username', async () => {
        const store = mockStore(state)
        const component = wrapIntl(
            <ReduxProvider store={store}>
                <PersonSelector
                    readOnly={false}
                    userIDs={['user-id-1']}
                    allowAddUsers={false}
                    property={new PersonProperty()}
                    emptyDisplayValue={'Empty'}
                    isMulti={false}
                    closeMenuOnSelect={true}
                    onChange={() => {}}
                />
            </ReduxProvider>,
        )

        const renderResult = render(component)
        const container = await waitFor(() => {
            if (!renderResult.container) {
                return Promise.reject(new Error('container not found'))
            }

            return Promise.resolve(renderResult.container)
        })
        expect(container).toMatchSnapshot()
    })

    test('not readOnly, show firstname', async () => {
        const store = mockStore({
            ...state,
            clientConfig: {
                value: {
                    teammateNameDisplay: 'full_name',
                },
            },
        })
        const component = wrapIntl(
            <ReduxProvider store={store}>
                <PersonSelector
                    readOnly={false}
                    userIDs={['user-id-1']}
                    allowAddUsers={false}
                    property={new PersonProperty()}
                    emptyDisplayValue={'Empty'}
                    isMulti={false}
                    closeMenuOnSelect={true}
                    onChange={() => {}}
                />
            </ReduxProvider>,
        )

        const renderResult = render(component)
        const container = await waitFor(() => {
            if (!renderResult.container) {
                return Promise.reject(new Error('container not found'))
            }

            return Promise.resolve(renderResult.container)
        })
        expect(container).toMatchSnapshot()
    })

    test('not readOnly, show modal', async () => {
        const store = mockStore(state)
        const component = wrapIntl(
            <ReduxProvider store={store}>
                <PersonSelector
                    readOnly={false}
                    userIDs={[]}
                    allowAddUsers={false}
                    property={new PersonProperty()}
                    emptyDisplayValue={'Empty'}
                    isMulti={false}
                    closeMenuOnSelect={true}
                    onChange={() => {}}
                />
            </ReduxProvider>,
        )

        const renderResult = render(component)
        const container = await waitFor(() => {
            if (!renderResult.container) {
                return Promise.reject(new Error('container not found'))
            }

            return Promise.resolve(renderResult.container)
        })
        expect(container).toMatchSnapshot()

        if (container) {
            // this is the actual element where the click event triggers
            // opening of the dropdown
            const userProperty = container.querySelector('.Person > div > div:nth-child(1) > div:nth-child(2) > input')
            expect(userProperty).not.toBeNull()

            await userEvent.click(userProperty as Element)

            const userList = container.querySelector('.Person-item')
            expect(userList).not.toBeNull()
            expect(container).toMatchSnapshot()
        } else {
            throw new Error('container should have been initialized')
        }
    })

    test('readOnly view', async () => {
        const store = mockStore(state)
        const component = wrapIntl(
            <ReduxProvider store={store}>
                <PersonSelector
                    readOnly={true}
                    userIDs={['user-id-1']}
                    allowAddUsers={false}
                    property={new PersonProperty()}
                    emptyDisplayValue={'Empty'}
                    isMulti={false}
                    closeMenuOnSelect={true}
                    onChange={() => {}}
                />
            </ReduxProvider>,
        )

        const renderResult = render(component)
        const container = await waitFor(() => {
            if (!renderResult.container) {
                return Promise.reject(new Error('container not found'))
            }

            return Promise.resolve(renderResult.container)
        })
        expect(container).toMatchSnapshot()

        if (container) {
            // this is the actual element where the click event triggers
            // opening of the dropdown
            const userProperty = container.querySelector('.Person > div > div:nth-child(1) > div:nth-child(2) > input')
            expect(userProperty).toBeNull()
        } else {
            throw new Error('container should have been initialized')
        }
    })

    test('show multiple', async () => {
        const store = mockStore(state)
        const component = wrapIntl(
            <ReduxProvider store={store}>
                <PersonSelector
                    readOnly={false}
                    userIDs={['user-id-1', 'user-id-2']}
                    allowAddUsers={false}
                    property={new PersonProperty()}
                    emptyDisplayValue={'Empty'}
                    isMulti={true}
                    closeMenuOnSelect={true}
                    onChange={() => {}}
                />
            </ReduxProvider>,
        )

        const renderResult = render(component)
        const container = await waitFor(() => {
            if (!renderResult.container) {
                return Promise.reject(new Error('container not found'))
            }

            return Promise.resolve(renderResult.container)
        })
        expect(container).toMatchSnapshot()
    })
    test('show multiple, display modal', async () => {
        const store = mockStore(state)
        const component = wrapIntl(
            <ReduxProvider store={store}>
                <PersonSelector
                    readOnly={false}
                    userIDs={['user-id-1', 'user-id-2']}
                    allowAddUsers={false}
                    property={new PersonProperty()}
                    emptyDisplayValue={'(empty)'}
                    isMulti={true}
                    closeMenuOnSelect={true}
                    onChange={() => {}}
                />
            </ReduxProvider>,
        )

        const renderResult = render(component)
        const container = await waitFor(() => {
            if (!renderResult.container) {
                return Promise.reject(new Error('container not found'))
            }

            return Promise.resolve(renderResult.container)
        })
        expect(container).toMatchSnapshot()

        if (container) {
            // this is the actual element where the click event triggers
            // opening of the dropdown
            const userProperty = container.querySelector('.MultiPerson > div > div:nth-child(1) > div:nth-child(3) > input')
            expect(userProperty).not.toBeNull()

            await userEvent.click(userProperty as Element)

            const userList = container.querySelector('.MultiPerson-item')
            expect(userList).not.toBeNull()
            expect(container).toMatchSnapshot()
        } else {
            throw new Error('container should have been initialized')
        }
    })

    test('not readOnly, show me', async () => {
        const store = mockStore(state)
        const component = wrapIntl(
            <ReduxProvider store={store}>
                <PersonSelector
                    readOnly={false}
                    showMe={true}
                    userIDs={[]}
                    allowAddUsers={false}
                    property={new PersonProperty()}
                    emptyDisplayValue={'Empty'}
                    isMulti={false}
                    closeMenuOnSelect={true}
                    onChange={() => {}}
                />
            </ReduxProvider>,
        )

        const renderResult = render(component)
        const container = await waitFor(() => {
            if (!renderResult.container) {
                return Promise.reject(new Error('container not found'))
            }

            return Promise.resolve(renderResult.container)
        })

        // expect(container).toMatchSnapshot()
        if (container) {
            // this is the actual element where the click event triggers
            // opening of the dropdown
            const userProperty = container.querySelector('.Person > div > div:nth-child(1) > div:nth-child(2) > input')
            expect(userProperty).not.toBeNull()

            await userEvent.click(userProperty as Element)

            const userList = container.querySelector('.Person-item')
            expect(userList).not.toBeNull()
            expect(userList?.textContent).toBe('Me')
            expect(container).toMatchSnapshot()
        } else {
            throw new Error('container should have been initialized')
        }
        expect(container).toMatchSnapshot()
    })
})
