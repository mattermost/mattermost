// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {Provider as ReduxProvider} from 'react-redux'
import {render} from '@testing-library/react'
import configureStore from 'redux-mock-store'

import '@testing-library/jest-dom'
import {wrapDNDIntl} from 'src/testUtils'

import 'isomorphic-fetch'

import {TestBlockFactory} from 'src/test/testBlockFactory'

import {ColumnResizeProvider} from './tableColumnResizeContext'
import TableRow from './tableRow'

describe('components/table/TableRow', () => {
    const board = TestBlockFactory.createBoard()
    const view = TestBlockFactory.createBoardView(board)

    const view2 = TestBlockFactory.createBoardView(board)
    view2.fields.sortOptions = []

    const card = TestBlockFactory.createCard(board)
    const cardTemplate = TestBlockFactory.createCard(board)
    cardTemplate.fields.isTemplate = true

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
        },
    }

    const mockStore = configureStore([])

    const Wrapper: React.FC = ({children}) => {
        const store = mockStore(state)
        return wrapDNDIntl(
            <ColumnResizeProvider
                columnWidths={{}}
                onResizeColumn={jest.fn()}
            >
                <ReduxProvider store={store}>
                    {children}
                </ReduxProvider>
            </ColumnResizeProvider>,
        )
    }

    test('should match snapshot', async () => {
        const {container} = render(
            <Wrapper>
                <TableRow
                    board={board}
                    columnWidths={view.fields.columnWidths}
                    addCard={jest.fn()}
                    visiblePropertyIds={view.fields.visiblePropertyIds}
                    isManualSort={view.fields.sortOptions.length === 0}
                    groupById={view.fields.groupById}
                    isLastCard={false}
                    collapsedOptionIds={view.fields.collapsedOptionIds}
                    card={card}
                    isSelected={false}
                    focusOnMount={false}
                    showCard={jest.fn()}
                    readonly={false}
                    onDrop={jest.fn()}
                />
            </Wrapper>,
        )
        expect(container).toMatchSnapshot()
    })

    test('should match snapshot, read-only', async () => {
        const {container} = render(
            <Wrapper>
                <TableRow
                    board={board}
                    card={card}
                    columnWidths={view.fields.columnWidths}
                    addCard={jest.fn()}
                    visiblePropertyIds={view.fields.visiblePropertyIds}
                    isManualSort={view.fields.sortOptions.length === 0}
                    groupById={view.fields.groupById}
                    isLastCard={false}
                    collapsedOptionIds={view.fields.collapsedOptionIds}
                    isSelected={false}
                    focusOnMount={false}
                    showCard={jest.fn()}
                    readonly={true}
                    onDrop={jest.fn()}
                />
            </Wrapper>,
        )
        expect(container).toMatchSnapshot()
    })

    test('should match snapshot, isSelected', async () => {
        const {container} = render(
            <Wrapper>
                <TableRow
                    board={board}
                    card={card}
                    columnWidths={view.fields.columnWidths}
                    addCard={jest.fn()}
                    visiblePropertyIds={view.fields.visiblePropertyIds}
                    isManualSort={view.fields.sortOptions.length === 0}
                    groupById={view.fields.groupById}
                    isLastCard={false}
                    collapsedOptionIds={view.fields.collapsedOptionIds}
                    isSelected={true}
                    focusOnMount={false}
                    showCard={jest.fn()}
                    readonly={false}
                    onDrop={jest.fn()}
                />
            </Wrapper>,
        )
        expect(container).toMatchSnapshot()
    })

    test('should match snapshot, collapsed tree', async () => {
        const {container} = render(
            <Wrapper>
                <TableRow
                    board={board}
                    card={card}
                    columnWidths={view.fields.columnWidths}
                    addCard={jest.fn()}
                    visiblePropertyIds={view.fields.visiblePropertyIds}
                    isManualSort={view.fields.sortOptions.length === 0}
                    groupById={view.fields.groupById}
                    isLastCard={false}
                    collapsedOptionIds={['value1']}
                    isSelected={false}
                    focusOnMount={false}
                    showCard={jest.fn()}
                    readonly={false}
                    onDrop={jest.fn()}
                />
            </Wrapper>,
        )
        expect(container).toMatchSnapshot()
    })

    test('should match snapshot, display properties', async () => {
        const {container} = render(
            <Wrapper>
                <TableRow
                    board={board}
                    card={card}
                    visiblePropertyIds={['property1', 'property2']}
                    columnWidths={view.fields.columnWidths}
                    addCard={jest.fn()}
                    isManualSort={view.fields.sortOptions.length === 0}
                    groupById={view.fields.groupById}
                    collapsedOptionIds={view.fields.collapsedOptionIds}
                    isLastCard={false}
                    isSelected={false}
                    focusOnMount={false}
                    showCard={jest.fn()}
                    readonly={false}
                    onDrop={jest.fn()}
                />
            </Wrapper>,
        )
        expect(container).toMatchSnapshot()
    })

    test('should match snapshot, resizing column', async () => {
        const {container} = render(
            <Wrapper>
                <TableRow
                    board={board}
                    card={card}
                    visiblePropertyIds={['property1', 'property2']}
                    columnWidths={view.fields.columnWidths}
                    addCard={jest.fn()}
                    isManualSort={view.fields.sortOptions.length === 0}
                    groupById={view.fields.groupById}
                    isLastCard={false}
                    collapsedOptionIds={view.fields.collapsedOptionIds}
                    isSelected={false}
                    focusOnMount={false}
                    showCard={jest.fn()}
                    readonly={false}
                    onDrop={jest.fn()}
                />
            </Wrapper>,
        )
        expect(container).toMatchSnapshot()
    })
})
