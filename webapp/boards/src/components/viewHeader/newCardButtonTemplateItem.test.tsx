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

import NewCardButtonTemplateItem from './newCardButtonTemplateItem'

jest.mock('src/mutator')
const mockedMutator = mocked(mutator, true)

const board = TestBlockFactory.createBoard()
const activeView = TestBlockFactory.createBoardView(board)
const card = TestBlockFactory.createCard(board)

describe('components/viewHeader/newCardButtonTemplateItem', () => {
    const state = {
        users: {
            me: {
                id: 'user-id-1',
                username: 'username_1'},
        },
        boards: {
            current: board.id,
            boards: {
                [board.id]: {id: board.id},
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
    test('return NewCardButtonTemplateItem', () => {
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <NewCardButtonTemplateItem
                        cardTemplate={card}
                        addCardFromTemplate={jest.fn()}
                        editCardTemplate={jest.fn()}
                    />
                </ReduxProvider>,
            ),
        )
        const buttonElement = screen.getByRole('button', {name: 'menuwrapper'})
        userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
    })
    test('return NewCardButtonTemplateItem and edit', () => {
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <NewCardButtonTemplateItem
                        cardTemplate={card}
                        addCardFromTemplate={jest.fn()}
                        editCardTemplate={mockFunction}
                    />
                </ReduxProvider>,
            ),
        )
        const buttonElement = screen.getByRole('button', {name: 'menuwrapper'})
        userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
        const buttonEdit = screen.getByRole('button', {name: 'Edit'})
        userEvent.click(buttonEdit)
        expect(mockFunction).toBeCalledTimes(1)
        expect(mockFunction).toBeCalledWith(card.id)
    })

    test('return NewCardButtonTemplateItem and add Card from template', () => {
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <NewCardButtonTemplateItem
                        cardTemplate={card}
                        addCardFromTemplate={mockFunction}
                        editCardTemplate={jest.fn()}
                    />
                </ReduxProvider>,
            ),
        )
        const buttonAdd = screen.getByRole('button', {name: 'title'})
        userEvent.click(buttonAdd)
        expect(container).toMatchSnapshot()
        expect(mockFunction).toBeCalledTimes(1)
    })
    test('return NewCardButtonTemplateItem and delete', () => {
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <NewCardButtonTemplateItem
                        cardTemplate={card}
                        addCardFromTemplate={jest.fn()}
                        editCardTemplate={jest.fn()}
                    />
                </ReduxProvider>,
            ),
        )
        const buttonElement = screen.getByRole('button', {name: 'menuwrapper'})
        userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
        const buttonDelete = screen.getByRole('button', {name: 'Delete'})
        userEvent.click(buttonDelete)
        expect(mockedMutator.performAsUndoGroup).toBeCalledTimes(1)
    })
    test('return NewCardButtonTemplateItem and Set as default', () => {
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <NewCardButtonTemplateItem
                        cardTemplate={card}
                        addCardFromTemplate={jest.fn()}
                        editCardTemplate={jest.fn()}
                    />
                </ReduxProvider>,
            ),
        )
        const buttonElement = screen.getByRole('button', {name: 'menuwrapper'})
        userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
        const buttonSetAsDefault = screen.getByRole('button', {name: 'Set as default'})
        userEvent.click(buttonSetAsDefault)
        expect(mockedMutator.setDefaultTemplate).toBeCalledTimes(1)
        expect(mockedMutator.setDefaultTemplate).toBeCalledWith(activeView.boardId, activeView.id, activeView.fields.defaultTemplateId, card.id)
    })
})
