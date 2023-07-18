// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {wrapDNDIntl} from 'src/testUtils'
import 'isomorphic-fetch'
import {Board, IPropertyOption, IPropertyTemplate} from 'src/blocks/board'
import {TestBlockFactory} from 'src/test/testBlockFactory'
import {Card} from 'src/blocks/card'

import PropertyValueElement from './propertyValueElement'

describe('components/propertyValueElement', () => {
    let board: Board
    let card: Card

    beforeEach(() => {
        board = TestBlockFactory.createBoard()
        card = TestBlockFactory.createCard(board)
    })

    test('should match snapshot, select', async () => {
        const propertyTemplate = board.cardProperties.find((p) => p.id === 'property1')
        const component = wrapDNDIntl(
            <PropertyValueElement
                board={board}
                readOnly={false}
                card={card}
                propertyTemplate={propertyTemplate || board.cardProperties[0]}
                showEmptyPlaceholder={true}
            />,
        )

        const {container} = render(component)
        expect(container).toMatchSnapshot()
    })

    test('should match snapshot, select, read-only', async () => {
        const propertyTemplate = board.cardProperties.find((p) => p.id === 'property1')
        const component = wrapDNDIntl(
            <PropertyValueElement
                board={board}
                readOnly={true}
                card={card}
                propertyTemplate={propertyTemplate || board.cardProperties[0]}
                showEmptyPlaceholder={true}
            />,
        )

        const {container} = render(component)
        expect(container).toMatchSnapshot()
    })

    test('should match snapshot, multi-select', () => {
        const options: IPropertyOption[] = []
        for (let i = 0; i < 3; i++) {
            const propertyOption: IPropertyOption = {
                id: `ms${i}`,
                value: `value ${i}`,
                color: 'propColorBrown',
            }
            options.push(propertyOption)
        }

        const propertyTemplate: IPropertyTemplate = {
            id: 'multiSelect',
            name: 'MultiSelect',
            type: 'multiSelect',
            options,
        }
        card.fields.properties.multiSelect = ['ms1', 'ms2']
        const component = wrapDNDIntl(
            <PropertyValueElement
                board={board}
                readOnly={false}
                card={card}
                propertyTemplate={propertyTemplate}
                showEmptyPlaceholder={true}
            />,
        )

        const {container} = render(component)
        expect(container).toMatchSnapshot()
    })

    test('should match snapshot, url, array value', () => {
        const propertyTemplate: IPropertyTemplate = {
            id: 'property_url',
            name: 'Property URL',
            type: 'url',
            options: [],
        }
        card.fields.properties.property_url = 'http://localhost'

        const component = wrapDNDIntl(
            <PropertyValueElement
                board={board}
                readOnly={false}
                card={card}
                propertyTemplate={propertyTemplate}
                showEmptyPlaceholder={true}
            />,
        )

        const {container} = render(component)
        expect(container).toMatchSnapshot()
    })

    test('should match snapshot, person, array value', () => {
        const propertyTemplate: IPropertyTemplate = {
            id: 'text',
            name: 'Generic Text',
            type: 'text',
            options: [],
        }
        card.fields.properties.person = 'value1'

        const component = wrapDNDIntl(
            <PropertyValueElement
                board={board}
                readOnly={false}
                card={card}
                propertyTemplate={propertyTemplate}
                showEmptyPlaceholder={true}
            />,
        )

        const {container} = render(component)
        expect(container).toMatchSnapshot()
    })

    test('should match snapshot, date, array value', async () => {
        const propertyTemplate: IPropertyTemplate = {
            id: 'date',
            name: 'Date',
            type: 'date',
            options: [],
        }
        card.fields.properties.date = 'invalid date'

        const component = wrapDNDIntl(
            <PropertyValueElement
                board={board}
                readOnly={false}
                card={card}
                propertyTemplate={propertyTemplate}
                showEmptyPlaceholder={true}
            />,
        )
        const {container} = render(component)
        expect(container).toMatchSnapshot()
    })

    test('URL fields should allow cancel', async () => {
        const propertyTemplate: IPropertyTemplate = {
            id: 'property_url',
            name: 'Property URL',
            type: 'url',
            options: [],
        }

        const user = userEvent.setup()

        const component = wrapDNDIntl(
            <PropertyValueElement
                board={board}
                readOnly={false}
                card={card}
                propertyTemplate={propertyTemplate}
                showEmptyPlaceholder={true}
            />,
        )

        const {container} = render(component)
        const editElement = screen.getByRole('textbox')
        await user.type(editElement, 'http://test')
        expect(editElement).toHaveValue('http://test')
        await user.keyboard('{Escape}')
        expect(editElement).toHaveValue('')
        expect(container).toMatchSnapshot()
    })

    test('Generic fields should allow cancel', async () => {
        const propertyTemplate: IPropertyTemplate = {
            id: 'text',
            name: 'Generic Text',
            type: 'text',
            options: [],
        }

        const user = userEvent.setup()

        const component = wrapDNDIntl(
            <PropertyValueElement
                board={board}
                readOnly={false}
                card={card}
                propertyTemplate={propertyTemplate}
                showEmptyPlaceholder={true}
            />,
        )

        const {container} = render(component)
        const editElement = screen.getByRole('textbox')
        await user.type(editElement, 'http://test')
        expect(editElement).toHaveValue('http://test')
        await user.keyboard('{Escape}')
        expect(editElement).toHaveValue('')
        expect(container).toMatchSnapshot()
    })
})
