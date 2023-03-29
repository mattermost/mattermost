// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {Provider as ReduxProvider} from 'react-redux'
import {mocked} from 'jest-mock'

import {
    render,
    screen,
    waitFor,
    within
} from '@testing-library/react'

import configureStore from 'redux-mock-store'

import {act} from 'react-dom/test-utils'

import userEvent from '@testing-library/user-event'

import {TestBlockFactory} from 'src/test/testBlockFactory'

import {wrapIntl} from 'src/testUtils'
import {IPropertyTemplate} from 'src/blocks/board'

import client from 'src/octoClient'

import mutator from 'src/mutator'

import PersonProperty from './property'

// import {IPropertyTemplate, Board} from 'src/blocks/board'

import ConfirmPerson from './confirmPerson'
jest.mock('src/mutator')
jest.mock('src/octoClient')

const mockedMutator = mocked(mutator, true)
const mockedOctoClient = mocked(client, true)

const board = TestBlockFactory.createBoard()
board.teamId = 'team-id-1'
const card = TestBlockFactory.createCard(board)

describe('properties/person', () => {
    const mockStore = configureStore([])
    const state = {
        boards: {
            boards: {
                [board.id]: board,
            },
            current: board.id,
            myBoardMemberships: {
                [board.id]: {userId: 'user-id-1', schemeAdmin: true},
            },
        },
        users: {
            me: {
                id: 'user-id-1',
                username: 'username_1',
                roles: 'system_user',
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
    const additionalUsers = [
        {
            id: 'user-id-4',
            username: 'username-4',
            email: 'user-4@example.com',
            nickname: '',
            firstname: '',
            lastname: '',
            props: {},
            create_at: 1621315184,
            update_at: 1621315184,
            delete_at: 0,
            is_bot: false,
            is_guest: false,
            roles: 'system_user',
        },
        {
            id: 'user-id-5',
            username: 'username-5',
            email: 'user-5@example.com',
            nickname: '',
            firstname: '',
            lastname: '',
            props: {},
            create_at: 1621315184,
            update_at: 1621315184,
            delete_at: 0,
            is_bot: false,
            is_guest: false,
            roles: 'system_user',
        },
    ]

    mockedOctoClient.searchTeamUsers.mockResolvedValue(additionalUsers)

    test('select user - confirm', async () => {
        const store = mockStore(state)
        const component = wrapIntl(
            <ReduxProvider store={store}>
                <ConfirmPerson
                    property={new PersonProperty()}
                    propertyValue={'user-id-1'}
                    readOnly={false}
                    showEmptyPlaceholder={false}
                    propertyTemplate={{} as IPropertyTemplate}
                    board={board}
                    card={card}
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

            act(() => {
                userEvent.click(userProperty as Element)
            })
            expect(container).toMatchSnapshot()

            const option = renderResult.getByText('username-4')
            expect(option).not.toBeNull()
            act(() => {
                userEvent.click(option as Element)
            })

            const confirmDialog = screen.getByTitle('Confirmation Dialog Box')
            expect(confirmDialog).toBeDefined()
            const confirmButton = within(confirmDialog).getByRole('button', {name: 'Add to board'})
            expect(confirmButton).toBeDefined()
            userEvent.click(confirmButton)

            expect(mockedMutator.createBoardMember).toBeCalled()
        } else {
            throw new Error('container should have been initialized')
        }
    })

    test('select user - cancel', async () => {
        mockedMutator.createBoardMember.mockClear()
        const store = mockStore(state)
        const component = wrapIntl(
            <ReduxProvider store={store}>
                <ConfirmPerson
                    property={new PersonProperty()}
                    propertyValue={'user-id-1'}
                    readOnly={false}
                    showEmptyPlaceholder={false}
                    propertyTemplate={{} as IPropertyTemplate}
                    board={board}
                    card={card}
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

            act(() => {
                userEvent.click(userProperty as Element)
            })
            expect(container).toMatchSnapshot()

            const option = renderResult.getByText('username-4')
            expect(option).not.toBeNull()
            act(() => {
                userEvent.click(option as Element)
            })

            const confirmDialog = screen.getByTitle('Confirmation Dialog Box')
            expect(confirmDialog).toBeDefined()
            const cancelButton = within(confirmDialog).getByRole('button', {name: 'Cancel'})
            expect(cancelButton).toBeDefined()
            userEvent.click(cancelButton)

            expect(mockedMutator.createBoardMember).not.toBeCalled()
        } else {
            throw new Error('container should have been initialized')
        }
    })
})
