// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {Provider as ReduxProvider} from 'react-redux'

import {
    act,
    render,
    screen,
    waitFor,
} from '@testing-library/react'

import configureStore from 'redux-mock-store'

import userEvent from '@testing-library/user-event'

import {setup, wrapIntl} from 'src/testUtils'
import {Board, IPropertyTemplate} from 'src/blocks/board'
import {Card} from 'src/blocks/card'

import MultiPersonProperty from './property'
import MultiPerson from './multiperson'

describe('properties/multiperson', () => {
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

    test('not readonly not existing user', async () => {
        const store = mockStore(state)
        const component = wrapIntl(
            <ReduxProvider store={store}>
                <MultiPerson
                    property={new MultiPersonProperty()}
                    propertyValue={['user-id-4']}
                    readOnly={false}
                    showEmptyPlaceholder={false}
                    propertyTemplate={{
                        id: 'personPropertyID',
                        name: 'My Person Property',
                        type: 'multiPerson',
                        options: [],
                    } as IPropertyTemplate}
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
                <MultiPerson
                    property={new MultiPersonProperty()}
                    propertyValue={['user-id-1', 'user-id-2']}
                    readOnly={false}
                    showEmptyPlaceholder={false}
                    propertyTemplate={{
                        id: 'personPropertyID',
                        name: 'My Person Property',
                        type: 'multiPerson',
                        options: [],
                    } as IPropertyTemplate}
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
                <MultiPerson
                    property={new MultiPersonProperty()}
                    propertyValue={['user-id-1', 'user-id-2']}
                    readOnly={true}
                    showEmptyPlaceholder={false}
                    propertyTemplate={{
                        id: 'personPropertyID',
                        name: 'My Person Property',
                        type: 'multiPerson',
                        options: [],
                    } as IPropertyTemplate}
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
        const {container} = setup(wrapIntl(
            <ReduxProvider store={store}>
                <MultiPerson
                    property={new MultiPersonProperty()}
                    propertyValue={['user-id-1', 'user-id-2']}
                    readOnly={false}
                    showEmptyPlaceholder={false}
                    propertyTemplate={{
                        id: 'personPropertyID',
                        name: 'My Person Property',
                        type: 'multiPerson',
                        options: [],
                    } as IPropertyTemplate}
                    board={{} as Board}
                    card={{} as Card}
                />
            </ReduxProvider>,
        ))

        const userProperty = screen.getByRole('combobox')
        expect(userProperty).not.toBeNull()
        await act(() => userEvent.click(userProperty))
        expect(container).toMatchSnapshot()
    })
})
