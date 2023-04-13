// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {render, screen, within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {mocked} from 'jest-mock'

import {wrapDNDIntl} from 'src/testUtils'
import Mutator from 'src/mutator'
import {TestBlockFactory} from 'src/test/testBlockFactory'
import {IPropertyOption} from 'src/blocks/board'

import KanbanHiddenColumnItem from './kanbanHiddenColumnItem'

jest.mock('src/mutator')
const mockedMutator = mocked(Mutator)

describe('src/components/kanban/kanbanHiddenColumnItem', () => {
    const board = TestBlockFactory.createBoard()
    const activeView = TestBlockFactory.createBoardView(board)
    const card = TestBlockFactory.createCard(board)
    const card2 = TestBlockFactory.createCard(board)
    const option: IPropertyOption = {
        id: 'id1',
        value: 'propOption',
        color: 'propColorDefault',
    }
    beforeAll(() => {
        console.error = jest.fn()
    })
    test('should match snapshot', () => {
        const {container} = render(wrapDNDIntl(
            <KanbanHiddenColumnItem
                activeView={activeView}
                group={{
                    option,
                    cards: [card],
                }}
                readonly={false}
                onDrop={jest.fn()}
            />,
        ))
        expect(container).toMatchSnapshot()
    })
    test('should match snapshot readonly', () => {
        const {container} = render(wrapDNDIntl(
            <KanbanHiddenColumnItem
                activeView={activeView}
                group={{
                    option,
                    cards: [card],
                }}
                readonly={true}
                onDrop={jest.fn()}
            />,
        ))
        expect(container).toMatchSnapshot()
    })
    test('return kanbanHiddenColumnItem and click menuwrapper', async () => {
        const {container} = render(wrapDNDIntl(
            <KanbanHiddenColumnItem
                activeView={activeView}
                group={{
                    option,
                    cards: [card],
                }}
                readonly={false}
                onDrop={jest.fn()}
            />,
        ))
        const buttonMenuWrapper = screen.getByRole('button', {name: 'menuwrapper'})
        expect(buttonMenuWrapper).not.toBeNull()
        await userEvent.click(buttonMenuWrapper)
        expect(container).toMatchSnapshot()
    })
    test('return kanbanHiddenColumnItem, click menuwrapper and click show', async () => {
        const {container} = render(wrapDNDIntl(
            <KanbanHiddenColumnItem
                activeView={activeView}
                group={{
                    option,
                    cards: [card],
                }}
                readonly={false}
                onDrop={jest.fn()}
            />,
        ))
        const buttonMenuWrapper = screen.getByRole('button', {name: 'menuwrapper'})
        expect(buttonMenuWrapper).not.toBeNull()
        await userEvent.click(buttonMenuWrapper)
        expect(container).toMatchSnapshot()
        const buttonShow = within(buttonMenuWrapper).getByRole('button', {name: 'Show'})
        await userEvent.click(buttonShow)
        expect(mockedMutator.unhideViewColumn).toBeCalledWith(activeView.boardId, activeView, option.id)
    })

    test('limited card check', () => {
        card.limited = true
        card2.limited = true
        option.id = 'hidden-card-group-id'
        const {container, getByTitle} = render(wrapDNDIntl(
            <KanbanHiddenColumnItem
                activeView={activeView}
                group={{
                    option,
                    cards: [card, card2],
                }}
                readonly={false}
                onDrop={jest.fn()}
            />,
        ))
        expect(getByTitle('hidden-card-count')).toHaveTextContent('2')
        expect(container).toMatchSnapshot()
    })
})
