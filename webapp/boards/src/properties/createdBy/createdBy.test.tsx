// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {Provider as ReduxProvider} from 'react-redux'

import {render} from '@testing-library/react'
import configureStore from 'redux-mock-store'

import {IUser} from 'src/user'
import {createCard} from 'src/blocks/card'
import {Board, IPropertyTemplate} from 'src/blocks/board'

import {wrapIntl} from 'src/testUtils'

import CreatedByProperty from './property'
import CreatedBy from './createdBy'

describe('properties/createdBy', () => {
    test('should match snapshot', () => {
        jest.spyOn(console, 'error').mockImplementation()

        const card = createCard()
        card.createdBy = 'user-id-1'

        const mockStore = configureStore([])
        const store = mockStore({
            users: {
                boardUsers: {
                    'user-id-1': {username: 'username_1'} as IUser,
                },
            },
            clientConfig: {
                value: {
                    teammateNameDisplay: 'username',
                },
            },
        })

        const component = wrapIntl(
            <ReduxProvider store={store}>
                <CreatedBy
                    property={new CreatedByProperty()}
                    board={{} as Board}
                    card={card}
                    readOnly={false}
                    propertyTemplate={{} as IPropertyTemplate}
                    propertyValue={''}
                    showEmptyPlaceholder={false}
                />
            </ReduxProvider>,
        )

        const {container} = render(component)
        expect(container).toMatchSnapshot()

        // TODO fix test — fix personSelector
        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('Each child in a list should have a unique "key" prop'),
            expect.stringContaining('Check the render method of `PersonSelector`'),
            expect.anything(),
            expect.anything()
        )
    })

    test('should match snapshot as guest', () => {
        const card = createCard()
        card.createdBy = 'user-id-1'

        const mockStore = configureStore([])
        const store = mockStore({
            users: {
                boardUsers: {
                    'user-id-1': {username: 'username_1', is_guest: true} as IUser,
                },
            },
            clientConfig: {
                value: {
                    teammateNameDisplay: 'username',
                },
            },
        })

        const component = wrapIntl(
            <ReduxProvider store={store}>
                <CreatedBy
                    property={new CreatedByProperty()}
                    board={{} as Board}
                    card={card}
                    readOnly={false}
                    propertyTemplate={{} as IPropertyTemplate}
                    propertyValue={''}
                    showEmptyPlaceholder={false}
                />
            </ReduxProvider>,
        )

        const {container} = render(wrapIntl(component))
        expect(container).toMatchSnapshot()
    })
})
