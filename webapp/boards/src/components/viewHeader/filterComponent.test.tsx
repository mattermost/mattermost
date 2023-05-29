// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {act, render, screen} from '@testing-library/react'
import {Provider as ReduxProvider} from 'react-redux'

import {mocked} from 'jest-mock'

import userEvent from '@testing-library/user-event'

import {FilterClause} from 'src/blocks/filterClause'

import {TestBlockFactory} from 'src/test/testBlockFactory'
import mutator from 'src/mutator'

import {mockStateStore, wrapIntl} from 'src/testUtils'

import FilterComponenet from './filterComponent'

jest.mock('src/mutator')
const mockedMutator = mocked(mutator)

const board = TestBlockFactory.createBoard()
const activeView = TestBlockFactory.createBoardView(board)

const filter: FilterClause = {
    propertyId: board.cardProperties[0].id,
    condition: 'includes',
    values: ['Status'],
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
describe('components/viewHeader/filterComponent', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        board.cardProperties[0].options = [{id: 'Status', value: 'Status', color: ''}]
        activeView.fields.filter.filters = [filter]
    })
    test('return filterComponent', async () => {
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <FilterComponenet
                        board={board}
                        activeView={activeView}
                        onClose={jest.fn()}
                    />
                </ReduxProvider>,
            ),
        )
        const buttonElement = screen.getAllByRole('button', {name: 'menuwrapper'})[0]
        await userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
    })
    test('return filterComponent and add Filter', async () => {
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <FilterComponenet
                        board={board}
                        activeView={activeView}
                        onClose={jest.fn()}
                    />
                </ReduxProvider>,
            ),
        )
        const buttonElement = screen.getAllByRole('button', {name: 'menuwrapper'})[0]
        await act(() => userEvent.click(buttonElement))
        expect(container).toMatchSnapshot()
        const buttonAdd = screen.getByText('+ Add filter')
        await act(() => userEvent.click(buttonAdd))
        expect(mockedMutator.changeViewFilter).toBeCalledTimes(1)
    })

    test('return filterComponent and filter by status', async () => {
        jest.spyOn(console, 'error').mockImplementation()
        activeView.fields.filter.filters = [unknownFilter]
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <FilterComponenet
                        board={board}
                        activeView={activeView}
                        onClose={jest.fn()}
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

    test('return filterComponent and click is empty', async () => {
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <FilterComponenet
                        board={board}
                        activeView={activeView}
                        onClose={jest.fn()}
                    />
                </ReduxProvider>,
            ),
        )
        const buttonElement = screen.getAllByRole('button', {name: 'menuwrapper'})[1]
        await userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
        const buttonNotInclude = screen.getByRole('button', {name: 'is empty'})
        await userEvent.click(buttonNotInclude)
        expect(mockedMutator.changeViewFilter).toBeCalledTimes(1)
    })
})
