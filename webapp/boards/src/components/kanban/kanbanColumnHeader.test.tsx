// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {
    fireEvent,
    render,
    screen,
    within
} from '@testing-library/react'
import {createIntl} from 'react-intl'
import userEvent from '@testing-library/user-event'
import {mocked} from 'jest-mock'
import {Provider as ReduxProvider} from 'react-redux'

import Mutator from 'src/mutator'
import {wrapDNDIntl, mockStateStore} from 'src/testUtils'
import {TestBlockFactory} from 'src/test/testBlockFactory'
import {IPropertyOption} from 'src/blocks/board'

import KanbanColumnHeader from './kanbanColumnHeader'
jest.mock('src/mutator')
const mockedMutator = mocked(Mutator, true)
describe('src/components/kanban/kanbanColumnHeader', () => {
    const intl = createIntl({locale: 'en-us'})
    const board = TestBlockFactory.createBoard()
    const activeView = TestBlockFactory.createBoardView(board)
    const card = TestBlockFactory.createCard(board)
    card.id = 'id1'
    activeView.fields.kanbanCalculations = {
        id1: {
            calculation: 'countEmpty',
            propertyId: '1',

        },
    }
    const option: IPropertyOption = {
        id: 'id1',
        value: 'Title',
        color: 'propColorDefault',
    }
    const state = {
        teams: {
            current: {id: 'team-id'},
        },
        boards: {
            current: board.id,
            boards: {
                [board.id]: board,
            },
            myBoardMemberships: {
                [board.id]: {userId: 'user_id_1', schemeAdmin: true},
            },
        },
    }
    const store = mockStateStore([], state)
    beforeAll(() => {
        console.error = jest.fn()
    })
    beforeEach(jest.resetAllMocks)
    test('should match snapshot', () => {
        const {container} = render(wrapDNDIntl(
            <ReduxProvider store={store}>
                <KanbanColumnHeader
                    board={board}
                    activeView={activeView}
                    group={{
                        option,
                        cards: [card],
                    }}
                    intl={intl}
                    readonly={false}
                    addCard={jest.fn()}
                    propertyNameChanged={jest.fn()}
                    onDropToColumn={jest.fn()}
                    calculationMenuOpen={false}
                    onCalculationMenuOpen={jest.fn()}
                    onCalculationMenuClose={jest.fn()}
                />
            </ReduxProvider>,
        ))
        expect(container).toMatchSnapshot()
    })
    test('should match snapshot readonly', () => {
        const {container} = render(wrapDNDIntl(
            <ReduxProvider store={store}>
                <KanbanColumnHeader
                    board={board}
                    activeView={activeView}
                    group={{
                        option,
                        cards: [card],
                    }}
                    intl={intl}
                    readonly={true}
                    addCard={jest.fn()}
                    propertyNameChanged={jest.fn()}
                    onDropToColumn={jest.fn()}
                    calculationMenuOpen={false}
                    onCalculationMenuOpen={jest.fn()}
                    onCalculationMenuClose={jest.fn()}
                />
            </ReduxProvider>,
        ))
        expect(container).toMatchSnapshot()
    })
    test('return kanbanColumnHeader and edit title', () => {
        const mockedPropertyNameChanged = jest.fn()
        const {container} = render(wrapDNDIntl(
            <ReduxProvider store={store}>
                <KanbanColumnHeader
                    board={board}
                    activeView={activeView}
                    group={{
                        option,
                        cards: [card],
                    }}
                    intl={intl}
                    readonly={false}
                    addCard={jest.fn()}
                    propertyNameChanged={mockedPropertyNameChanged}
                    onDropToColumn={jest.fn()}
                    calculationMenuOpen={false}
                    onCalculationMenuOpen={jest.fn()}
                    onCalculationMenuClose={jest.fn()}
                />
            </ReduxProvider>,
        ))
        const inputTitle = screen.getByRole('textbox', {name: option.value})
        expect(inputTitle).toBeDefined()
        fireEvent.change(inputTitle, {target: {value: ''}})
        userEvent.type(inputTitle, 'New Title')
        fireEvent.blur(inputTitle)
        expect(mockedPropertyNameChanged).toBeCalledWith(option, 'New Title')
        expect(container).toMatchSnapshot()
    })
    test('return kanbanColumnHeader and click on menuwrapper', () => {
        const {container} = render(wrapDNDIntl(
            <ReduxProvider store={store}>
                <KanbanColumnHeader
                    board={board}
                    activeView={activeView}
                    group={{
                        option,
                        cards: [card],
                    }}
                    intl={intl}
                    readonly={false}
                    addCard={jest.fn()}
                    propertyNameChanged={jest.fn()}
                    onDropToColumn={jest.fn()}
                    calculationMenuOpen={false}
                    onCalculationMenuOpen={jest.fn()}
                    onCalculationMenuClose={jest.fn()}
                />
            </ReduxProvider>,
        ))
        const buttonMenuWrapper = screen.getByRole('button', {name: 'menuwrapper'})
        expect(buttonMenuWrapper).toBeDefined()
        userEvent.click(buttonMenuWrapper)
        expect(container).toMatchSnapshot()
    })
    test('return kanbanColumnHeader, click on menuwrapper and click on hide menu', () => {
        render(wrapDNDIntl(
            <ReduxProvider store={store}>
                <KanbanColumnHeader
                    board={board}
                    activeView={activeView}
                    group={{
                        option,
                        cards: [card],
                    }}
                    intl={intl}
                    readonly={false}
                    addCard={jest.fn()}
                    propertyNameChanged={jest.fn()}
                    onDropToColumn={jest.fn()}
                    calculationMenuOpen={false}
                    onCalculationMenuOpen={jest.fn()}
                    onCalculationMenuClose={jest.fn()}
                />
            </ReduxProvider>,
        ))
        const buttonMenuWrapper = screen.getByRole('button', {name: 'menuwrapper'})
        expect(buttonMenuWrapper).toBeDefined()
        userEvent.click(buttonMenuWrapper)
        const buttonHide = within(buttonMenuWrapper).getByRole('button', {name: 'Hide'})
        expect(buttonHide).toBeDefined()
        userEvent.click(buttonHide)
        expect(mockedMutator.hideViewColumn).toBeCalledTimes(1)
    })
    test('return kanbanColumnHeader, click on menuwrapper and click on delete menu', () => {
        render(wrapDNDIntl(
            <ReduxProvider store={store}>
                <KanbanColumnHeader
                    board={board}
                    activeView={activeView}
                    group={{
                        option,
                        cards: [card],
                    }}
                    intl={intl}
                    readonly={false}
                    addCard={jest.fn()}
                    propertyNameChanged={jest.fn()}
                    onDropToColumn={jest.fn()}
                    calculationMenuOpen={false}
                    onCalculationMenuOpen={jest.fn()}
                    onCalculationMenuClose={jest.fn()}
                />
            </ReduxProvider>,
        ))
        const buttonMenuWrapper = screen.getByRole('button', {name: 'menuwrapper'})
        expect(buttonMenuWrapper).toBeDefined()
        userEvent.click(buttonMenuWrapper)
        const buttonDelete = within(buttonMenuWrapper).getByRole('button', {name: 'Delete'})
        expect(buttonDelete).toBeDefined()
        userEvent.click(buttonDelete)
        expect(mockedMutator.deletePropertyOption).toBeCalledTimes(1)
    })
    test('return kanbanColumnHeader, click on menuwrapper and click on blue color menu', () => {
        render(wrapDNDIntl(
            <ReduxProvider store={store}>
                <KanbanColumnHeader
                    board={board}
                    activeView={activeView}
                    group={{
                        option,
                        cards: [card],
                    }}
                    intl={intl}
                    readonly={false}
                    addCard={jest.fn()}
                    propertyNameChanged={jest.fn()}
                    onDropToColumn={jest.fn()}
                    calculationMenuOpen={false}
                    onCalculationMenuOpen={jest.fn()}
                    onCalculationMenuClose={jest.fn()}
                />
            </ReduxProvider>,
        ))
        const buttonMenuWrapper = screen.getByRole('button', {name: 'menuwrapper'})
        expect(buttonMenuWrapper).toBeDefined()
        userEvent.click(buttonMenuWrapper)
        const buttonBlueColor = within(buttonMenuWrapper).getByRole('button', {name: 'Select Blue Color'})
        expect(buttonBlueColor).toBeDefined()
        userEvent.click(buttonBlueColor)
        expect(mockedMutator.changePropertyOptionColor).toBeCalledTimes(1)
    })

    test('return kanbanColumnHeader and click to add card', () => {
        const mockedAddCard = jest.fn()
        const {container} = render(wrapDNDIntl(
            <ReduxProvider store={store}>
                <KanbanColumnHeader
                    board={board}
                    activeView={activeView}
                    group={{
                        option,
                        cards: [card],
                    }}
                    intl={intl}
                    readonly={false}
                    addCard={mockedAddCard}
                    propertyNameChanged={jest.fn()}
                    onDropToColumn={jest.fn()}
                    calculationMenuOpen={false}
                    onCalculationMenuOpen={jest.fn()}
                    onCalculationMenuClose={jest.fn()}
                />
            </ReduxProvider>,
        ))
        const buttonAddCard = container.querySelector('.AddIcon')?.parentElement
        expect(buttonAddCard).toBeDefined()
        userEvent.click(buttonAddCard!)
        expect(mockedAddCard).toBeCalledTimes(1)
    })
    test('return kanbanColumnHeader and click KanbanCalculationMenu', () => {
        const mockedCalculationMenuOpen = jest.fn()
        render(wrapDNDIntl(
            <ReduxProvider store={store}>
                <KanbanColumnHeader
                    board={board}
                    activeView={activeView}
                    group={{
                        option,
                        cards: [card],
                    }}
                    intl={intl}
                    readonly={false}
                    addCard={jest.fn()}
                    propertyNameChanged={jest.fn()}
                    onDropToColumn={jest.fn()}
                    calculationMenuOpen={false}
                    onCalculationMenuOpen={mockedCalculationMenuOpen}
                    onCalculationMenuClose={jest.fn()}
                />
            </ReduxProvider>,
        ))
        const buttonKanbanCalculation = screen.getByText(/0/i).parentElement
        expect(buttonKanbanCalculation).toBeDefined()
        userEvent.click(buttonKanbanCalculation!)
        expect(mockedCalculationMenuOpen).toBeCalledTimes(1)
    })
    test('return kanbanColumnHeader and click count on KanbanCalculationMenu', () => {
        render(wrapDNDIntl(
            <ReduxProvider store={store}>
                <KanbanColumnHeader
                    board={board}
                    activeView={activeView}
                    group={{
                        option,
                        cards: [card],
                    }}
                    intl={intl}
                    readonly={false}
                    addCard={jest.fn()}
                    propertyNameChanged={jest.fn()}
                    onDropToColumn={jest.fn()}
                    calculationMenuOpen={true}
                    onCalculationMenuOpen={jest.fn()}
                    onCalculationMenuClose={jest.fn()}
                />
            </ReduxProvider>,
        ))
        const menuCountEmpty = screen.getByText('Count')
        expect(menuCountEmpty).toBeDefined()
        userEvent.click(menuCountEmpty)
        expect(mockedMutator.changeViewKanbanCalculations).toBeCalledTimes(1)
    })
})
