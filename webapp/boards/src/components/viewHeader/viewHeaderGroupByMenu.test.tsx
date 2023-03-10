// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {render, screen} from '@testing-library/react'
import {Provider as ReduxProvider} from 'react-redux'

import '@testing-library/jest-dom'
import userEvent from '@testing-library/user-event'
import {mocked} from 'jest-mock'

import {MockStoreEnhanced} from 'redux-mock-store'

import {TestBlockFactory} from 'src/test/testBlockFactory'

import mutator from 'src/mutator'

import {wrapIntl, mockStateStore} from 'src/testUtils'
import {IPropertyOption} from 'src/blocks/board'

import ViewHeaderGroupByMenu from './viewHeaderGroupByMenu'

jest.mock('src/mutator')
const mockedMutator = mocked(mutator, true)

const board = TestBlockFactory.createBoard()
const activeView = TestBlockFactory.createBoardView(board)
const property = board.cardProperties.find((p) => p.name === 'Status')!
const optionQ1: IPropertyOption = {
    color: 'propColorOrange',
    id: 'property_value_id_1',
    value: 'Q1',
}
const optionQ2: IPropertyOption = {
    color: 'propColorBlue',
    id: 'property_value_id_2',
    value: 'Q2',
}
const optionQ3: IPropertyOption = {
    color: 'propColorDefault',
    id: 'property_value_id_3',
    value: 'Q3',
}
property.options = [optionQ1, optionQ2, optionQ3]

activeView.fields.filter = {filters: [], operation: 'and'}
activeView.fields.visibleOptionIds = [optionQ1.id, optionQ2.id]

const card1 = TestBlockFactory.createCard(board)
card1.fields.properties = {[property.id]: 'property_value_id_1'}
const card2 = TestBlockFactory.createCard(board)
card2.fields.properties = {[property.id]: 'property_value_id_2'}
const card3 = TestBlockFactory.createCard(board)
card3.fields.properties = {[property.id]: 'property_value_id_3'}

describe('components/viewHeader/viewHeaderGroupByMenu', () => {
    let state: any
    let store: MockStoreEnhanced<unknown, unknown>

    const setDefaultOptions = () => {
        activeView.fields.hiddenOptionIds = [optionQ3.id]

        state = {
            users: {
                me: {
                    id: 'user-id-1',
                    username: 'username_1',
                },
                boardUsers: {
                    'user-id-1': {username: 'username_1'},
                },
            },
            boards: {
                current: board.id,
                boards: {
                    [board.id]: board,
                },
                templates: [],
            },
            views: {
                views: {
                    [activeView.id]: activeView,
                },
                current: activeView.id,
            },
            cards: {
                templates: [],
                cards: [card1, card2, card3],
            },
            searchText: {},
        }
        store = mockStateStore([], state)
    }

    beforeEach(() => {
        jest.clearAllMocks()
        setDefaultOptions()
    })
    test('return groupBy menu', () => {
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <ViewHeaderGroupByMenu
                        activeView={activeView}
                        groupByProperty={property}
                        properties={board.cardProperties}
                    />
                </ReduxProvider>,
            ),
        )
        const buttonElement = screen.getByRole('button', {name: 'menuwrapper'})
        userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()
    })
    test('return groupBy menu and groupBy Status', () => {
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <ViewHeaderGroupByMenu
                        activeView={activeView}
                        groupByProperty={property}
                        properties={board.cardProperties}
                    />
                </ReduxProvider>,
            ),
        )
        const buttonElement = screen.getByRole('button', {name: 'menuwrapper'})
        userEvent.click(buttonElement)
        const buttonStatus = screen.getByRole('button', {name: 'Status'})
        userEvent.click(buttonStatus)
        expect(container).toMatchSnapshot()
        expect(mockedMutator.changeViewGroupById).toBeCalledTimes(1)
    })
    test('return groupBy menu, hideEmptyGroups and ungroup in viewType table', () => {
        activeView.fields.viewType = 'table'
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <ViewHeaderGroupByMenu
                        activeView={activeView}
                        groupByProperty={property}
                        properties={board.cardProperties}
                    />
                </ReduxProvider>,
            ),
        )

        const menuButton = screen.getByRole('button', {name: 'menuwrapper'})
        userEvent.click(menuButton)
        expect(container).toMatchSnapshot()

        const hideEmptyGroupsButton = screen.getByRole('button', {name: /Hide.+groups/i})
        expect(hideEmptyGroupsButton)
        userEvent.click(hideEmptyGroupsButton)
        expect(mockedMutator.hideViewColumns).toBeCalledTimes(1)

        userEvent.click(menuButton)
        const showHiddenGroupsButton = screen.getByRole('button', {name: /Show.+groups/i})
        userEvent.click(showHiddenGroupsButton)
        expect(mockedMutator.unhideViewColumns).toBeCalledTimes(1)

        userEvent.click(menuButton)
        const ungroupButton = screen.getByRole('button', {name: 'Ungroup'})
        userEvent.click(ungroupButton)
        expect(mockedMutator.changeViewGroupById).toBeCalledTimes(1)
    })

    test('For viewType table render only HideEmptyGroupsButton when hiddenGroups is empty', () => {
        activeView.fields.viewType = 'table'
        activeView.fields.hiddenOptionIds = []

        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <ViewHeaderGroupByMenu
                        activeView={activeView}
                        groupByProperty={property}
                        properties={board.cardProperties}
                    />
                </ReduxProvider>,
            ),
        )
        const buttonElement = screen.getByRole('button', {name: 'menuwrapper'})
        userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()

        const hideEmptyGroupsButton = screen.queryByRole('button', {name: /Hide.+groups/i})
        expect(hideEmptyGroupsButton).toBeInTheDocument()

        const showHiddenGroupsButton = screen.queryByRole('button', {name: /Show.+groups/i})
        expect(showHiddenGroupsButton).not.toBeInTheDocument()
    })

    test('For viewType table render only ShowHiddenGroupsButton when there are no emptyGroups', () => {
        activeView.fields.viewType = 'table'

        const cardToFillTheEmptyGroup = TestBlockFactory.createCard(board)
        state.cards.cards.push(cardToFillTheEmptyGroup)
        store = mockStateStore([], state)

        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <ViewHeaderGroupByMenu
                        activeView={activeView}
                        groupByProperty={property}
                        properties={board.cardProperties}
                    />
                </ReduxProvider>,
            ),
        )
        const buttonElement = screen.getByRole('button', {name: 'menuwrapper'})
        userEvent.click(buttonElement)
        expect(container).toMatchSnapshot()

        const showHiddenGroupsButton = screen.queryByRole('button', {name: /Show.+groups/i})
        expect(showHiddenGroupsButton).toBeInTheDocument()

        const hideEmptyGroupsButton = screen.queryByRole('button', {name: /Hide.+groups/i})
        expect(hideEmptyGroupsButton).not.toBeInTheDocument()
    })
})
