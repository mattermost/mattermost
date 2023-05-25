// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {render, screen} from '@testing-library/react'
import {Provider as ReduxProvider} from 'react-redux'

import userEvent from '@testing-library/user-event'

import {mockStateStore, wrapIntl} from 'src/testUtils'

import {TestBlockFactory} from 'src/test/testBlockFactory'

import NewCardButton from './newCardButton'

const board = TestBlockFactory.createBoard()
const activeView = TestBlockFactory.createBoardView(board)

describe('components/viewHeader/newCardButton', () => {
    const state = {
        users: {
            me: {
                id: 'user-id-1',
                username: 'username_1'},
        },
        boards: {
            current: board.id,
            boards: {
                [board.id]: board,
            },
        },
        cards: {
            templates: [],
        },
        views: {
            current: 0,
            views: [activeView],
        },
    }

    const store = mockStateStore([], state)
    const mockFunction = jest.fn()

    beforeEach(() => {
        jest.clearAllMocks()
    })
    test('return NewCardButton', async () => {
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <NewCardButton
                        addCard={jest.fn()}
                        addCardTemplate={jest.fn()}
                        addCardFromTemplate={jest.fn()}
                        editCardTemplate={jest.fn()}
                    />
                </ReduxProvider>,
            ),
        )
        const buttonElement = screen.getByRole('button', {name: 'menuwrapper'})
        await userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
    })
    test('return NewCardButton and addCard', async () => {
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <NewCardButton
                        addCard={mockFunction}
                        addCardTemplate={jest.fn()}
                        addCardFromTemplate={jest.fn()}
                        editCardTemplate={jest.fn()}
                    />
                </ReduxProvider>,
            ),
        )
        const buttonElement = screen.getByRole('button', {name: 'menuwrapper'})
        await userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
        const buttonAdd = screen.getByRole('button', {name: 'Empty card'})
        await userEvent.click(buttonAdd)
        expect(mockFunction).toBeCalledTimes(1)
    })
    test('return NewCardButton and addCardTemplate', async () => {
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <NewCardButton
                        addCard={jest.fn()}
                        addCardTemplate={mockFunction}
                        addCardFromTemplate={jest.fn()}
                        editCardTemplate={jest.fn()}
                    />
                </ReduxProvider>,
            ),
        )
        const buttonElement = screen.getByRole('button', {name: 'menuwrapper'})
        await userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
        const buttonAddTemplate = screen.getByRole('button', {name: 'New template'})
        await userEvent.click(buttonAddTemplate)
        expect(mockFunction).toBeCalledTimes(1)
    })
})
