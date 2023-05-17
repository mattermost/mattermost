// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {Provider as ReduxProvider} from 'react-redux'

import {render, screen, waitFor} from '@testing-library/react'

import configureStore from 'redux-mock-store'

import {act} from 'react-dom/test-utils'

import userEvent from '@testing-library/user-event'

import {wrapIntl} from 'src/testUtils'
import {Board, IPropertyTemplate} from 'src/blocks/board'
import {Card} from 'src/blocks/card'

import PersonProperty from './property'
import Person from './person'

describe('properties/person', () => {
    const mockStore = configureStore([])
    const state = {
        users: {
            boardUsers: {
                'user-id-1': {
                    id: 'user-id-1',
                    username: 'username-1',
                    email: 'user-1@example.com',
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

    test('not readOnly not existing user', async () => {
        const store = mockStore(state)
        const component = wrapIntl(
            <ReduxProvider store={store}>
                <Person
                    property={new PersonProperty()}
                    propertyValue={'user-id-2'}
                    readOnly={false}
                    showEmptyPlaceholder={false}
                    propertyTemplate={{} as IPropertyTemplate}
                    board={{} as Board}
                    card={{} as Card}
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

    test('not readonly', async () => {
        const store = mockStore(state)
        const component = wrapIntl(
            <ReduxProvider store={store}>
                <Person
                    property={new PersonProperty()}
                    propertyValue={'user-id-1'}
                    readOnly={false}
                    showEmptyPlaceholder={false}
                    propertyTemplate={{} as IPropertyTemplate}
                    board={{} as Board}
                    card={{} as Card}
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

    test('not readonly guest user', async () => {
        const store = mockStore({...state, users: {boardUsers: {'user-id-1': {...state.users.boardUsers['user-id-1'], is_guest: true}}}})
        const component = wrapIntl(
            <ReduxProvider store={store}>
                <Person
                    property={new PersonProperty()}
                    propertyValue={'user-id-1'}
                    readOnly={false}
                    showEmptyPlaceholder={false}
                    propertyTemplate={{} as IPropertyTemplate}
                    board={{} as Board}
                    card={{} as Card}
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

    test('readonly view', async () => {
        const store = mockStore(state)
        const component = wrapIntl(
            <ReduxProvider store={store}>
                <Person
                    property={new PersonProperty()}
                    propertyValue={'user-id-1'}
                    readOnly={true}
                    showEmptyPlaceholder={false}
                    propertyTemplate={{} as IPropertyTemplate}
                    board={{} as Board}
                    card={{} as Card}
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

    test('user dropdown open', async () => {
        const store = mockStore(state)
        const component = wrapIntl(
            <ReduxProvider store={store}>
                <Person
                    property={new PersonProperty()}
                    propertyValue={'user-id-1'}
                    readOnly={false}
                    showEmptyPlaceholder={false}
                    propertyTemplate={{} as IPropertyTemplate}
                    board={{} as Board}
                    card={{} as Card}
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

        if (container) {
            // this is the actual element where the click event triggers
            // opening of the dropdown
            const userProperty = screen.getByRole('combobox')
            expect(userProperty).not.toBeNull()

            await act(() => userEvent.click(userProperty))
            expect(container).toMatchSnapshot()
        } else {
            throw new Error('container should have been initialized')
        }
    })
})
