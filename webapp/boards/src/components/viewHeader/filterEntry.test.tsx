// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {render, screen} from '@testing-library/react'
import {Provider as ReduxProvider} from 'react-redux'

import '@testing-library/jest-dom'
import userEvent from '@testing-library/user-event'

import {mocked} from 'jest-mock'

import {FilterClause} from 'src/blocks/filterClause'

import {TestBlockFactory} from 'src/test/testBlockFactory'

import {wrapIntl, mockStateStore} from 'src/testUtils'

import mutator from 'src/mutator'

import FilterEntry from './filterEntry'

jest.mock('src/mutator')
const mockedMutator = mocked(mutator, true)

const board = TestBlockFactory.createBoard()
const activeView = TestBlockFactory.createBoardView(board)
board.cardProperties[1].type = 'checkbox'
board.cardProperties[2].type = 'text'
board.cardProperties[3].type = 'date'
const statusFilter: FilterClause = {
    propertyId: board.cardProperties[0].id,
    condition: 'includes',
    values: ['Status'],
}
const booleanFilter: FilterClause = {
    propertyId: board.cardProperties[1].id,
    condition: 'isSet',
    values: [],
}
const textFilter: FilterClause = {
    propertyId: board.cardProperties[2].id,
    condition: 'contains',
    values: [],
}
const dateFilter: FilterClause = {
    propertyId: board.cardProperties[3].id,
    condition: 'is',
    values: [],
}

const unknownFilter: FilterClause = {
    propertyId: 'unknown',
    condition: 'includes',
    values: [],
}
const state = {
    users: {
        me: {
            id: 'user-id-1',
            username: 'username_1',
        },
    },
}
const store = mockStateStore([], state)
const mockedConditionClicked = jest.fn()

describe('components/viewHeader/filterEntry', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        board.cardProperties[0].options = [{id: 'Status', value: 'Status', color: ''}]
        activeView.fields.filter.filters = [statusFilter]
    })
    test('return filterEntry', () => {
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <FilterEntry
                        board={board}
                        view={activeView}
                        conditionClicked={mockedConditionClicked}
                        filter={statusFilter}
                    />
                </ReduxProvider>,
            ),
        )
        const buttonElement = screen.getAllByRole('button', {name: 'menuwrapper'})[0]
        userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
    })

    test('return filterEntry for boolean field', () => {
        activeView.fields.filter.filters = [booleanFilter]
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <FilterEntry
                        board={board}
                        view={activeView}
                        conditionClicked={mockedConditionClicked}
                        filter={booleanFilter}
                    />
                </ReduxProvider>,
            ),
        )
        expect(container).toMatchSnapshot()
        const buttonElement = screen.getAllByRole('button', {name: 'menuwrapper'})[1]
        userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
    })

    test('return filterEntry for text field', () => {
        activeView.fields.filter.filters = [textFilter]
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <FilterEntry
                        board={board}
                        view={activeView}
                        conditionClicked={mockedConditionClicked}
                        filter={textFilter}
                    />
                </ReduxProvider>,
            ),
        )
        expect(container).toMatchSnapshot()
        const buttonElement = screen.getAllByRole('button', {name: 'menuwrapper'})[1]
        userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
    })

    test('return filterEntry for date field', () => {
        activeView.fields.filter.filters = [dateFilter]
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <FilterEntry
                        board={board}
                        view={activeView}
                        conditionClicked={mockedConditionClicked}
                        filter={dateFilter}
                    />
                </ReduxProvider>,
            ),
        )
        expect(container).toMatchSnapshot()
        const buttonElement = screen.getAllByRole('button', {name: 'menuwrapper'})[1]
        userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
    })

    test('return filterEntry and click on status', () => {
        activeView.fields.filter.filters = [unknownFilter]
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <FilterEntry
                        board={board}
                        view={activeView}
                        conditionClicked={mockedConditionClicked}
                        filter={unknownFilter}
                    />
                </ReduxProvider>,
            ),
        )
        const buttonElement = screen.getAllByRole('button', {name: 'menuwrapper'})[0]
        userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
        const buttonStatus = screen.getByRole('button', {name: 'Status'})
        userEvent.click(buttonStatus)
        expect(mockedMutator.changeViewFilter).toBeCalledTimes(1)
    })
    test('return filterEntry and click on includes', () => {
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <FilterEntry
                        board={board}
                        view={activeView}
                        conditionClicked={mockedConditionClicked}
                        filter={statusFilter}
                    />
                </ReduxProvider>,
            ),
        )
        const buttonElement = screen.getAllByRole('button', {name: 'menuwrapper'})[1]
        userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
        const buttonIncludes = screen.getAllByRole('button', {name: 'includes'})[1]
        userEvent.click(buttonIncludes)
        expect(mockedConditionClicked).toBeCalledTimes(1)
    })
    test('return filterEntry and click on doesn\'t include', () => {
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <FilterEntry
                        board={board}
                        view={activeView}
                        conditionClicked={mockedConditionClicked}
                        filter={statusFilter}
                    />
                </ReduxProvider>,
            ),
        )
        const buttonElement = screen.getAllByRole('button', {name: 'menuwrapper'})[1]
        userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
        const buttonNotInclude = screen.getByRole('button', {name: 'doesn\'t include'})
        userEvent.click(buttonNotInclude)
        expect(mockedConditionClicked).toBeCalledTimes(1)
    })
    test('return filterEntry and click on is empty', () => {
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <FilterEntry
                        board={board}
                        view={activeView}
                        conditionClicked={mockedConditionClicked}
                        filter={statusFilter}
                    />
                </ReduxProvider>,
            ),
        )
        const buttonElement = screen.getAllByRole('button', {name: 'menuwrapper'})[1]
        userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
        const buttonEmpty = screen.getByRole('button', {name: 'is empty'})
        userEvent.click(buttonEmpty)
        expect(mockedConditionClicked).toBeCalledTimes(1)
    })
    test('return filterEntry and click on is not empty', () => {
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <FilterEntry
                        board={board}
                        view={activeView}
                        conditionClicked={mockedConditionClicked}
                        filter={statusFilter}
                    />
                </ReduxProvider>,
            ),
        )
        const buttonElement = screen.getAllByRole('button', {name: 'menuwrapper'})[1]
        userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
        const buttonNotEmpty = screen.getByRole('button', {name: 'is not empty'})
        userEvent.click(buttonNotEmpty)
        expect(mockedConditionClicked).toBeCalledTimes(1)
    })
    test('return filterEntry and click on delete', () => {
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <FilterEntry
                        board={board}
                        view={activeView}
                        conditionClicked={mockedConditionClicked}
                        filter={statusFilter}
                    />
                </ReduxProvider>,
            ),
        )
        const buttonElement = screen.getAllByRole('button', {name: 'menuwrapper'})[1]
        userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
        const allButton = screen.getAllByRole('button')
        userEvent.click(allButton[allButton.length - 1])
        expect(mockedMutator.changeViewFilter).toBeCalledTimes(1)
    })
    test('return filterEntry and click on different property type', () => {
        activeView.fields.filter.filters = [statusFilter]
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <FilterEntry
                        board={board}
                        view={activeView}
                        conditionClicked={mockedConditionClicked}
                        filter={statusFilter}
                    />
                </ReduxProvider>,
            ),
        )
        const buttonElement = screen.getAllByRole('button', {name: 'menuwrapper'})[0]
        userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
        const buttonDate = screen.getByRole('button', {name: 'Property 3'})
        userEvent.click(buttonDate)
        expect(mockedMutator.changeViewFilter).toBeCalledWith(
            board.id, activeView.id,
            {operation: 'and', filters: [statusFilter]},
            {operation: 'and', filters: [dateFilter]})
    })
    test('return filterEntry and click on different property type, but same filterOperation', () => {
        activeView.fields.filter.filters = [booleanFilter]
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <FilterEntry
                        board={board}
                        view={activeView}
                        conditionClicked={mockedConditionClicked}
                        filter={booleanFilter}
                    />
                </ReduxProvider>,
            ),
        )
        const buttonElement = screen.getAllByRole('button', {name: 'menuwrapper'})[0]
        userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
        const buttonDate = screen.getByRole('button', {name: 'Property 3'})
        userEvent.click(buttonDate)
        expect(mockedMutator.changeViewFilter).toBeCalledWith(
            board.id, activeView.id,
            {operation: 'and', filters: [booleanFilter]},
            {operation: 'and',
                filters: [{
                    propertyId: board.cardProperties[3].id,
                    condition: 'isSet',
                    values: [],
                }]})
    })
})
