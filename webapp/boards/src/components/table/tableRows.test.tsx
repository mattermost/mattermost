// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {Provider as ReduxProvider} from 'react-redux'
import {fireEvent, render} from '@testing-library/react'
import configureStore from 'redux-mock-store'

import 'isomorphic-fetch'

import {TestBlockFactory} from 'src/test/testBlockFactory'
import {FetchMock} from 'src/test/fetchMock'
import {wrapDNDIntl} from 'src/testUtils'

import {ColumnResizeProvider} from './tableColumnResizeContext'
import TableRows from './tableRows'

global.fetch = FetchMock.fn

beforeEach(() => {
    FetchMock.fn.mockReset()
})

describe('components/table/TableRows', () => {
    const board = TestBlockFactory.createBoard()
    const view = TestBlockFactory.createBoardView(board)

    const view2 = TestBlockFactory.createBoardView(board)
    view2.fields.sortOptions = []

    const card = TestBlockFactory.createCard(board)
    const cardTemplate = TestBlockFactory.createCard(board)
    cardTemplate.fields.isTemplate = true

    const mockStore = configureStore([])
    const state = {
        users: {},
        comments: {
            comments: {},
        },
        contents: {
            contents: {},
        },
        cards: {
            cards: {
                [card.id]: card,
            },
            templates: {
                [cardTemplate.id]: cardTemplate,
            },
        },
    }

    test('should match snapshot, fire events', async () => {
        const callback = jest.fn()
        const addCard = jest.fn()

        const store = mockStore(state)
        const component = wrapDNDIntl(
            <ReduxProvider store={store}>
                <ColumnResizeProvider
                    columnWidths={{}}
                    onResizeColumn={() => {}}
                >
                    <TableRows
                        board={board}
                        activeView={view}
                        cards={[card]}
                        selectedCardIds={[]}
                        readonly={false}
                        cardIdToFocusOnRender=''
                        showCard={callback}
                        addCard={addCard}
                        onCardClicked={jest.fn()}
                        onDrop={jest.fn()}
                    />
                </ColumnResizeProvider>
            </ReduxProvider>,
        )

        const {container, getByText} = render(component)

        const open = getByText(/Open/i)
        fireEvent.click(open)
        expect(callback).toBeCalled()
        expect(container).toMatchSnapshot()
    })
})
