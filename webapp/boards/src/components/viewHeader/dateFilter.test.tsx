// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {render} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {IntlProvider} from 'react-intl'
import {mocked} from 'jest-mock'

import '@testing-library/jest-dom'

import {wrapIntl} from 'src/testUtils'
import mutator from 'src/mutator'
import {TestBlockFactory} from 'src/test/testBlockFactory'

import {createFilterClause, FilterClause} from 'src/blocks/filterClause'
import {createFilterGroup} from 'src/blocks/filterGroup'

import DateFilter from './dateFilter'

jest.mock('src/mutator')
const mockedMutator = mocked(mutator, true)

// create Dates for specific days for this year.
const June15 = new Date(Date.UTC(new Date().getFullYear(), 5, 15, 12))

describe('components/viewHeader/dateFilter', () => {
    const emptyFilterClause = createFilterClause({
        propertyId: 'myPropertyId',
        condition: 'is',
        values: [],
    })
    const board = TestBlockFactory.createBoard()
    board.id = 'testBoardID'

    const activeView = TestBlockFactory.createBoardView(board)
    const dateFixed = Date.UTC(2022, 11, 28, 12) //Date.parse('28 Dec 2022')
    activeView.createAt = dateFixed
    activeView.updateAt = dateFixed

    activeView.id = 'testViewID'
    activeView.fields.filter = createFilterGroup()
    activeView.fields.filter.filters = [emptyFilterClause]

    beforeEach(() => {
        // Quick fix to disregard console error when unmounting a component
        console.error = jest.fn()
        document.execCommand = jest.fn()
        jest.resetAllMocks()
    })

    test('return dateFilter default value', () => {
        const {container} = render(
            wrapIntl(
                <DateFilter
                    view={activeView}
                    filter={emptyFilterClause}
                />,
            ),
        )
        expect(container).toMatchSnapshot()
    })

    test('return dateFilter invalid value', () => {
        const {container} = render(
            wrapIntl(
                <DateFilter
                    view={activeView}
                    filter={{
                        propertyId: 'myPropertyId',
                        condition: 'is',
                        values: ['string is not valid'],
                    }}
                />,
            ),
        )
        expect(container).toMatchSnapshot()
    })

    test('return dateFilter valid value', () => {
        const june15 = June15.getTime().toString()
        const {container} = render(
            wrapIntl(
                <DateFilter
                    view={activeView}
                    filter={{
                        propertyId: 'myPropertyId',
                        condition: 'is',
                        values: [june15.toString()],
                    }}
                />,
            ),
        )
        expect(container).toMatchSnapshot()
    })

    test('returns local correctly - es local', () => {
        const todayFilterClause = createFilterClause(emptyFilterClause)
        todayFilterClause.values = [June15.getTime().toString()]
        activeView.fields.filter = createFilterGroup()
        activeView.fields.filter.filters = [todayFilterClause]

        const component = (
            <IntlProvider locale='es'>
                <DateFilter
                    view={activeView}
                    filter={todayFilterClause}
                />
            </IntlProvider>
        )

        const {container, getByText} = render(component)
        const input = getByText('15 de junio')
        expect(input).not.toBeNull()
        expect(container).toMatchSnapshot()
    })

    test('handles calendar click event', () => {
        activeView.fields.filter = createFilterGroup()
        activeView.fields.filter.filters = [emptyFilterClause]

        const component =
            wrapIntl(
                <DateFilter
                    view={activeView}
                    filter={emptyFilterClause}
                />,
            )
        expect(component).toMatchSnapshot()
        const {getByText, getByTitle} = render(component)

        const dayDisplay = getByText('Empty')
        userEvent.click(dayDisplay)

        const day = getByText('15')
        const modal = getByTitle('Close').children[0]
        userEvent.click(day)
        userEvent.click(modal)

        const newFilterGroup = createFilterGroup(activeView.fields.filter)
        const date = new Date()
        const fifteenth = Date.UTC(date.getFullYear(), date.getMonth(), 15, 12)

        const v = newFilterGroup.filters[0] as FilterClause
        v.values = [fifteenth.toString()]
        expect(mockedMutator.changeViewFilter).toHaveBeenCalledWith(board.id, activeView.id, activeView.fields.filter, newFilterGroup)
    })

    test('handle clear', () => {
        const todayFilterClause = createFilterClause(emptyFilterClause)
        todayFilterClause.values = [June15.getTime().toString()]
        activeView.fields.filter = createFilterGroup()
        activeView.fields.filter.filters = [todayFilterClause]

        const component =
            wrapIntl(
                <DateFilter
                    view={activeView}
                    filter={todayFilterClause}
                />,
            )
        const {container, getByText, getByTitle} = render(component)
        expect(container).toMatchSnapshot()

        // open modal
        const dayDisplay = getByText('June 15')
        userEvent.click(dayDisplay)

        const clear = getByText('Clear')
        const modal = getByTitle('Close').children[0]
        userEvent.click(clear)
        userEvent.click(modal)

        const newFilterGroup = createFilterGroup(activeView.fields.filter)
        const v = newFilterGroup.filters[0] as FilterClause
        v.values = []
        expect(mockedMutator.changeViewFilter).toHaveBeenCalledWith(board.id, activeView.id, activeView.fields.filter, newFilterGroup)
    })

    test('set via text input', () => {
        activeView.fields.filter = createFilterGroup()
        activeView.fields.filter.filters = [emptyFilterClause]

        const component =
            wrapIntl(
                <DateFilter
                    view={activeView}
                    filter={emptyFilterClause}
                />,
            )

        const {container, getByText, getByTitle, getByPlaceholderText} = render(component)
        expect(container).toMatchSnapshot()

        // open modal
        const dayDisplay = getByText('Empty')
        userEvent.click(dayDisplay)

        const input = getByPlaceholderText('MM/DD/YYYY')
        userEvent.type(input, '{selectall}{delay}07/15/2021{enter}')

        const July15 = new Date(Date.UTC(2021, 6, 15, 12))
        const modal = getByTitle('Close').children[0]
        userEvent.click(modal)

        const newFilterGroup = createFilterGroup(activeView.fields.filter)
        const v = newFilterGroup.filters[0] as FilterClause
        v.values = [July15.getTime().toString()]
        expect(mockedMutator.changeViewFilter).toHaveBeenCalledWith(board.id, activeView.id, activeView.fields.filter, newFilterGroup)
    })

    test('handles `Today` button click event', () => {
        const component =
            wrapIntl(
                <DateFilter
                    view={activeView}
                    filter={emptyFilterClause}
                />,
            )

        console.log('handle today')

        const {container, getByText, getByTitle} = render(component)
        expect(container).toMatchSnapshot()

        // To see if 'Today' button correctly selects today's date,
        // we can check it against `new Date()`.
        // About `Date()`
        // > "When called as a function, returns a string representation of the current date and time"
        const date = new Date()
        const today = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12)

        // open modal
        const dayDisplay = getByText('Empty')
        userEvent.click(dayDisplay)

        const day = getByText('Today')
        const modal = getByTitle('Close').children[0]
        userEvent.click(day)
        userEvent.click(modal)

        const newFilterGroup = createFilterGroup(activeView.fields.filter)
        const v = newFilterGroup.filters[0] as FilterClause
        v.values = [today.toString()]
        expect(mockedMutator.changeViewFilter).toHaveBeenCalledWith(board.id, activeView.id, activeView.fields.filter, newFilterGroup)
    })
})
