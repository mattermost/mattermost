// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {Provider as ReduxProvider} from 'react-redux'

import {render} from '@testing-library/react'
import configureStore from 'redux-mock-store'

import {createCard} from 'src/blocks/card'
import {Board, IPropertyTemplate} from 'src/blocks/board'
import {wrapIntl} from 'src/testUtils'

import {createCommentBlock} from 'src/blocks/commentBlock'

import UpdatedTimeProperty from './property'
import UpdatedTime from './updatedTime'

describe('properties/updatedTime', () => {
    test('should match snapshot', () => {
        const card = createCard()
        card.id = 'card-id-1'
        card.modifiedBy = 'user-id-1'
        card.updateAt = Date.parse('10 Jun 2021 16:22:00')

        const comment = createCommentBlock()
        comment.modifiedBy = 'user-id-1'
        comment.parentId = 'card-id-1'
        comment.updateAt = Date.parse('15 Jun 2021 16:22:00')

        const mockStore = configureStore([])
        const store = mockStore({
            comments: {
                comments: {
                    [comment.id]: comment,
                },
                commentsByCard: {
                    [card.id]: [comment],
                },
            },
        })

        const component = wrapIntl(
            <ReduxProvider store={store}>
                <UpdatedTime
                    property={new UpdatedTimeProperty()}
                    card={card}
                    board={{} as Board}
                    propertyTemplate={{} as IPropertyTemplate}
                    propertyValue={''}
                    readOnly={false}
                    showEmptyPlaceholder={false}
                />
            </ReduxProvider>,
        )

        const {container} = render(component)
        expect(container).toMatchSnapshot()
    })
})
