// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'

import {render} from '@testing-library/react'

import userEvent from '@testing-library/user-event'

import {TestBlockFactory} from 'src/test/testBlockFactory'
import {wrapIntl} from 'src/testUtils'

import {KanbanCalculationOptions} from './calculationOptions'

describe('components/kanban/calculations/KanbanCalculationOptions', () => {
    const board = TestBlockFactory.createBoard()

    test('base case', () => {
        const component = wrapIntl(
            <KanbanCalculationOptions
                value={'count'}
                property={board.cardProperties[1]}
                menuOpen={false}
                onChange={() => {}}
                cardProperties={board.cardProperties}
            />,
        )

        const {container} = render(component)
        expect(container).toMatchSnapshot()
    })

    test('with menu open', () => {
        const component = wrapIntl(
            <KanbanCalculationOptions
                value={'count'}
                property={board.cardProperties[1]}
                menuOpen={true}
                onChange={() => {}}
                cardProperties={board.cardProperties}
            />,
        )

        const {container} = render(component)
        expect(container).toMatchSnapshot()
    })

    test('with submenu open', () => {
        const component = wrapIntl(
            <KanbanCalculationOptions
                value={'count'}
                property={board.cardProperties[1]}
                menuOpen={true}
                onChange={() => {}}
                cardProperties={board.cardProperties}
            />,
        )

        const {container, getByText} = render(component)
        const countUniqueValuesOption = getByText('Count Unique Values')
        expect(countUniqueValuesOption).toBeDefined()
        userEvent.hover(countUniqueValuesOption)
        expect(container).toMatchSnapshot()
    })

    test('duplicate property types', () => {
        const boardWithProps = TestBlockFactory.createBoard()
        boardWithProps.cardProperties.push({
            id: 'number-property-1',
            name: 'A Number Property - 1',
            type: 'number',
            options: [],
        })
        boardWithProps.cardProperties.push({
            id: 'number-property-2',
            name: 'A Number Propert - 2y',
            type: 'number',
            options: [],
        })

        const component = wrapIntl(
            <KanbanCalculationOptions
                value={'count'}
                property={boardWithProps.cardProperties[1]}
                menuOpen={true}
                onChange={() => {}}
                cardProperties={boardWithProps.cardProperties}
            />,
        )

        const {getAllByText} = render(component)
        const sumOptions = getAllByText('Sum')
        expect(sumOptions).toBeDefined()
        expect(sumOptions.length).toBe(1)
    })

    test('effectively date fields', () => {
        // date, created time and updated time are effectively date fields.
        // Only one set of date related menus should show up for all of them.

        const boardWithProps = TestBlockFactory.createBoard()
        boardWithProps.cardProperties.push({
            id: 'date',
            name: 'Date',
            type: 'date',
            options: [],
        })
        boardWithProps.cardProperties.push({
            id: 'created-time',
            name: 'Created Time',
            type: 'createdTime',
            options: [],
        })
        boardWithProps.cardProperties.push({
            id: 'updated-time',
            name: 'Updated Time',
            type: 'updatedTime',
            options: [],
        })

        const component = wrapIntl(
            <KanbanCalculationOptions
                value={'count'}
                property={boardWithProps.cardProperties[1]}
                menuOpen={true}
                onChange={() => {}}
                cardProperties={boardWithProps.cardProperties}
            />,
        )

        const {getAllByText} = render(component)

        const earliestDateMenu = getAllByText('Earliest Date')
        expect(earliestDateMenu).toBeDefined()
        expect(earliestDateMenu.length).toBe(1)

        const latestDateMenu = getAllByText('Latest Date')
        expect(latestDateMenu).toBeDefined()
        expect(latestDateMenu.length).toBe(1)

        const dateRangeMenu = getAllByText('Date Range')
        expect(dateRangeMenu).toBeDefined()
        expect(dateRangeMenu.length).toBe(1)
    })
})
