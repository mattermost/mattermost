// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {Provider as ReduxProvider} from 'react-redux'

import {render, waitFor} from '@testing-library/react'

import configureStore from 'redux-mock-store'

import {act} from 'react-dom/test-utils'

import userEvent from '@testing-library/user-event'

import {wrapIntl} from 'src/testUtils'
import {IPropertyTemplate, Board} from 'src/blocks/board'
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

        if (container) {
            // this is the actual element where the click event triggers
            // opening of the dropdown
            const userProperty = container.querySelector('.MultiPerson > div > div:nth-child(1) > div:nth-child(3) > input')
            expect(userProperty).not.toBeNull()

            act(() => {
                userEvent.click(userProperty as Element)
            })
            expect(container).toMatchSnapshot()
        } else {
            throw new Error('container should have been initialized')
        }
    })
})
