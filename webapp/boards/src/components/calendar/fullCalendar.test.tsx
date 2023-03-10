// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {render} from '@testing-library/react'
import {Provider as ReduxProvider} from 'react-redux'

import {TestBlockFactory} from 'src/test/testBlockFactory'
import '@testing-library/jest-dom'
import {wrapIntl, mockStateStore} from 'src/testUtils'
import {IPropertyTemplate} from 'src/blocks/board'

import CalendarView from './fullCalendar'

jest.mock('src/mutator')

describe('components/calendar/toolbar', () => {
    const mockShow = jest.fn()
    const mockAdd = jest.fn()
    const dateDisplayProperty = {
        id: '12345',
        name: 'DateProperty',
        type: 'date',
        options: [],
    } as IPropertyTemplate
    const board = TestBlockFactory.createBoard()
    const view = TestBlockFactory.createBoardView(board)
    view.fields.viewType = 'calendar'
    view.fields.groupById = undefined
    const card = TestBlockFactory.createCard(board)
    const fifth = Date.UTC(2021, 9, 5, 12)
    const twentieth = Date.UTC(2021, 9, 20, 12)
    card.createAt = fifth
    const rObject = {from: twentieth}

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
    beforeEach(() => {
        jest.clearAllMocks()
    })

    test('return calendar, no date property', () => {
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <CalendarView
                        board={board}
                        activeView={view}
                        cards={[card]}
                        readonly={false}
                        showCard={mockShow}
                        addCard={mockAdd}
                        initialDate={new Date(fifth)}
                    />
                </ReduxProvider>,
            ),
        )
        expect(container).toMatchSnapshot()
    })

    test('return calendar, with date property not set', () => {
        board.cardProperties.push(dateDisplayProperty)
        card.fields.properties['12345'] = JSON.stringify(rObject)
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <CalendarView
                        board={board}
                        activeView={view}
                        cards={[card]}
                        readonly={false}
                        showCard={mockShow}
                        addCard={mockAdd}
                        initialDate={new Date(fifth)}
                    />
                </ReduxProvider>,
            ),
        )
        expect(container).toMatchSnapshot()
    })

    test('return calendar, with date property set', () => {
        board.cardProperties.push(dateDisplayProperty)
        card.fields.properties['12345'] = JSON.stringify(rObject)
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={store}>
                    <CalendarView
                        board={board}
                        activeView={view}
                        readonly={false}
                        dateDisplayProperty={dateDisplayProperty}
                        cards={[card]}
                        showCard={mockShow}
                        addCard={mockAdd}
                        initialDate={new Date(fifth)}
                    />
                </ReduxProvider>,
            ),
        )
        expect(container).toMatchSnapshot()
    })

    test('return calendar, without permissions', () => {
        const localStore = mockStateStore([], {...state, teams: {current: undefined}})
        const {container} = render(
            wrapIntl(
                <ReduxProvider store={localStore}>
                    <CalendarView
                        board={board}
                        activeView={view}
                        cards={[card]}
                        readonly={false}
                        showCard={mockShow}
                        addCard={mockAdd}
                        initialDate={new Date(fifth)}
                    />
                </ReduxProvider>,
            ),
        )
        expect(container).toMatchSnapshot()
    })
})
