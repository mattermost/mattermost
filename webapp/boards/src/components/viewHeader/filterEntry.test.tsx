// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {act, render, screen} from '@testing-library/react'
import {Provider as ReduxProvider} from 'react-redux'

import userEvent from '@testing-library/user-event'

import {mocked} from 'jest-mock'

import {FilterClause} from 'src/blocks/filterClause'

import {TestBlockFactory} from 'src/test/testBlockFactory'

import {mockStateStore, wrapIntl} from 'src/testUtils'

import mutator from 'src/mutator'

import FilterEntry from './filterEntry'

jest.mock('src/mutator')
const mockedMutator = mocked(mutator)

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
    test('return filterEntry', async () => {
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
        await userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
    })

    test('return filterEntry for boolean field', async () => {
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
        await userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
    })

    test('return filterEntry for text field', async () => {
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
        await userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
    })

    test('return filterEntry for date field', async () => {
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
        await userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
    })

    test('return filterEntry and click on status', async () => {
        jest.spyOn(console, 'error').mockImplementation()
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
        expect(console.error).toBeCalled()
        const buttonElement = screen.getAllByRole('button', {name: 'menuwrapper'})[0]
        await userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
        const buttonStatus = screen.getByRole('button', {name: 'Status'})
        await userEvent.click(buttonStatus)
        expect(mockedMutator.changeViewFilter).toBeCalledTimes(1)
    })
    test('return filterEntry and click on includes', async () => {
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
        await userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
        const buttonIncludes = screen.getAllByRole('button', {name: 'includes'})[1]
        await userEvent.click(buttonIncludes)
        expect(mockedConditionClicked).toBeCalledTimes(1)
    })
    test('return filterEntry and click on doesn\'t include', async () => {
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
        await userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
        const buttonNotInclude = screen.getByRole('button', {name: 'doesn\'t include'})
        await userEvent.click(buttonNotInclude)
        expect(mockedConditionClicked).toBeCalledTimes(1)
    })
    test('return filterEntry and click on is empty', async () => {
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
        await userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
        const buttonEmpty = screen.getByRole('button', {name: 'is empty'})
        await userEvent.click(buttonEmpty)
        expect(mockedConditionClicked).toBeCalledTimes(1)
    })
    test('return filterEntry and click on is not empty', async () => {
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
        await userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
        const buttonNotEmpty = screen.getByRole('button', {name: 'is not empty'})
        await userEvent.click(buttonNotEmpty)
        expect(mockedConditionClicked).toBeCalledTimes(1)
    })
    test('return filterEntry and click on delete', async () => {
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
        await act(() => userEvent.click(buttonElement))
        expect(container).toMatchSnapshot()
        const allButton = screen.getAllByRole('button')
        await act(() => userEvent.click(allButton[allButton.length - 1]))
        expect(mockedMutator.changeViewFilter).toBeCalledTimes(1)
    })
    test('return filterEntry and click on different property type', async () => {
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
        await userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
        const buttonDate = screen.getByRole('button', {name: 'Property 3'})
        await userEvent.click(buttonDate)
        expect(mockedMutator.changeViewFilter).toBeCalledWith(
            board.id, activeView.id,
            {operation: 'and', filters: [statusFilter]},
            {operation: 'and', filters: [dateFilter]})
    })
    test('return filterEntry and click on different property type, but same filterOperation', async () => {
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
        await userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
        const buttonDate = screen.getByRole('button', {name: 'Property 3'})
        await userEvent.click(buttonDate)
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
