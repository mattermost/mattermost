// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'

import {render} from '@testing-library/react'
import '@testing-library/jest-dom'

import {TestBlockFactory} from 'src/test/testBlockFactory'
import {FetchMock} from 'src/test/fetchMock'
import 'isomorphic-fetch'
import {wrapDNDIntl} from 'src/testUtils'

import {ColumnResizeProvider} from 'src/components/table/tableColumnResizeContext'

import CalculationRow from './calculationRow'

global.fetch = FetchMock.fn

beforeEach(() => {
    FetchMock.fn.mockReset()
})

describe('components/table/calculation/CalculationRow', () => {
    const board = TestBlockFactory.createBoard()
    board.cardProperties.push({
        id: 'property_2',
        name: 'Property 2',
        type: 'text',
        options: [],
    })
    board.cardProperties.push({
        id: 'property_3',
        name: 'Property 3',
        type: 'text',
        options: [],
    })
    board.cardProperties.push({
        id: 'property_4',
        name: 'Property 4',
        type: 'text',
        options: [],
    })

    const view = TestBlockFactory.createBoardView(board)
    view.fields.visiblePropertyIds.push(...['property_2', 'property_3', 'property_4'])

    const card = TestBlockFactory.createCard(board)
    card.fields.properties.property_2 = 'Foo'
    card.fields.properties.property_3 = 'Bar'
    card.fields.properties.property_4 = 'Baz'

    const card2 = TestBlockFactory.createCard(board)
    card2.fields.properties.property_2 = 'Lorem'
    card2.fields.properties.property_3 = ''
    card2.fields.properties.property_4 = 'Baz'

    test('should render three calculation elements', async () => {
        FetchMock.fn.mockReturnValueOnce(FetchMock.jsonResponse(JSON.stringify([board, view, card])))

        const component = wrapDNDIntl(
            <ColumnResizeProvider
                columnWidths={{}}
                onResizeColumn={jest.fn()}
            >
                <CalculationRow
                    board={board}
                    cards={[card, card2]}
                    activeView={view}
                    readonly={false}
                />
            </ColumnResizeProvider>,
        )

        const {container} = render(component)
        expect(container).toMatchSnapshot()
    })

    test('should match snapshot', async () => {
        view.fields.columnCalculations = {
            property_2: 'count',
            property_3: 'countValue',
            property_4: 'countUniqueValue',
        }

        const component = wrapDNDIntl(
            <ColumnResizeProvider
                columnWidths={{}}
                onResizeColumn={jest.fn()}
            >
                <CalculationRow
                    board={board}
                    cards={[card, card2]}
                    activeView={view}
                    readonly={false}
                />
            </ColumnResizeProvider>,
        )

        const {container} = render(component)
        expect(container).toMatchSnapshot()
    })
})
