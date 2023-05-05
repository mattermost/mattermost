// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {render, screen} from '@testing-library/react'
import {Provider as ReduxProvider} from 'react-redux'

import userEvent from '@testing-library/user-event'

import {mocked} from 'jest-mock'

import {mockStateStore, wrapIntl} from 'src/testUtils'

import {TestBlockFactory} from 'src/test/testBlockFactory'

import mutator from 'src/mutator'

import ViewHeaderSortMenu from './viewHeaderSortMenu'

jest.mock('src/mutator')
const mockedMutator = mocked(mutator)

const board = TestBlockFactory.createBoard()
const activeView = TestBlockFactory.createBoardView(board)
const cards = [TestBlockFactory.createCard(board), TestBlockFactory.createCard(board)]

describe('components/viewHeader/viewHeaderSortMenu', () => {
    const state = {
        users: {
            me: {
                id: 'user-id-1',
                username: 'username_1'},
        },
    }
    const store = mockStateStore([], state)
    beforeEach(() => {
        jest.clearAllMocks()
    })
    test('return sort menu', async () => {
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <ViewHeaderSortMenu
                        activeView={activeView}
                        orderedCards={cards}
                        properties={board.cardProperties}
                    />
                </ReduxProvider>,
            ),
        )
        const buttonElement = screen.getByRole('button', {name: 'menuwrapper'})
        await userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
    })
    test('return sort menu and do manual', async () => {
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <ViewHeaderSortMenu
                        activeView={activeView}
                        orderedCards={cards}
                        properties={board.cardProperties}
                    />
                </ReduxProvider>,
            ),
        )
        const buttonElement = screen.getByRole('button', {name: 'menuwrapper'})
        await userEvent.click(buttonElement)
        const buttonManual = screen.getByRole('button', {name: 'Manual'})
        await userEvent.click(buttonManual)
        expect(container).toMatchSnapshot()
        expect(mockedMutator.updateBlock).toBeCalledTimes(1)
    })
    test('return sort menu and do revert', async () => {
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <ViewHeaderSortMenu
                        activeView={activeView}
                        orderedCards={cards}
                        properties={board.cardProperties}
                    />
                </ReduxProvider>,
            ),
        )
        const buttonElement = screen.getByRole('button', {name: 'menuwrapper'})
        await userEvent.click(buttonElement)
        const buttonRevert = screen.getByRole('button', {name: 'Revert'})
        await userEvent.click(buttonRevert)
        expect(container).toMatchSnapshot()
        expect(mockedMutator.changeViewSortOptions).toBeCalledTimes(1)
        expect(mockedMutator.changeViewSortOptions).toBeCalledWith(activeView.boardId, activeView.id, activeView.fields.sortOptions, [])
    })
    test('return sort menu and do Name sort', async () => {
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <ViewHeaderSortMenu
                        activeView={activeView}
                        orderedCards={cards}
                        properties={board.cardProperties}
                    />
                </ReduxProvider>,
            ),
        )
        const buttonElement = screen.getByRole('button', {name: 'menuwrapper'})
        await userEvent.click(buttonElement)
        const buttonName = screen.getByRole('button', {name: 'Name'})
        await userEvent.click(buttonName)
        expect(container).toMatchSnapshot()
        expect(mockedMutator.changeViewSortOptions).toBeCalledTimes(1)
        expect(mockedMutator.changeViewSortOptions).toBeCalledWith(activeView.boardId, activeView.id, activeView.fields.sortOptions, [{propertyId: '__title', reversed: false}])
    })
})
