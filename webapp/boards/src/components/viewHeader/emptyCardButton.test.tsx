// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {render, screen} from '@testing-library/react'
import {Provider as ReduxProvider} from 'react-redux'

import '@testing-library/jest-dom'
import userEvent from '@testing-library/user-event'

import {mocked} from 'jest-mock'

import {wrapIntl, mockStateStore} from 'src/testUtils'

import {TestBlockFactory} from 'src/test/testBlockFactory'

import mutator from 'src/mutator'

import EmptyCardButton from './emptyCardButton'

const board = TestBlockFactory.createBoard()
const activeView = TestBlockFactory.createBoardView(board)

jest.mock('src/mutator')
const mockedMutator = mocked(mutator, true)
describe('components/viewHeader/emptyCardButton', () => {
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
    test('return EmptyCardButton', () => {
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <EmptyCardButton
                        addCard={mockFunction}
                    />
                </ReduxProvider>,
            ),
        )
        expect(container).toMatchSnapshot()
    })
    test('return EmptyCardButton and addCard', () => {
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <EmptyCardButton
                        addCard={mockFunction}
                    />
                </ReduxProvider>,
            ),
        )
        expect(container).toMatchSnapshot()
        const buttonEmpty = screen.getByRole('button', {name: 'Empty card'})
        userEvent.click(buttonEmpty)
        expect(mockFunction).toBeCalledTimes(1)
    })
    test('return EmptyCardButton and Set Template', () => {
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <EmptyCardButton
                        addCard={mockFunction}
                    />
                </ReduxProvider>,
            ),
        )
        const buttonElement = screen.getByRole('button', {name: 'menuwrapper'})
        userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
        const buttonDefault = screen.getByRole('button', {name: 'Set as default'})
        userEvent.click(buttonDefault)
        expect(mockedMutator.clearDefaultTemplate).toBeCalledTimes(1)
    })
})
