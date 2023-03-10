// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {render} from '@testing-library/react'
import '@testing-library/jest-dom'
import userEvent from '@testing-library/user-event'

import {wrapDNDIntl} from 'src/testUtils'
import 'isomorphic-fetch'
import {IPropertyTemplate, IPropertyOption} from 'src/blocks/board'
import {TestBlockFactory} from 'src/test/testBlockFactory'

import PropertyValueElement from './propertyValueElement'

describe('components/propertyValueElement', () => {
    const board = TestBlockFactory.createBoard()
    const card = TestBlockFactory.createCard(board)

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

    test('should match snapshot, date, array value', () => {
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

    test('URL fields should allow cancel', () => {
        const propertyTemplate: IPropertyTemplate = {
            id: 'property_url',
            name: 'Property URL',
            type: 'url',
            options: [],
        }

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
        const editElement = container.querySelector('.Editable')
        expect(editElement).toBeDefined()

        userEvent.type(editElement!, 'http://test{esc}')
        expect(container).toMatchSnapshot()
    })

    test('Generic fields should allow cancel', () => {
        const propertyTemplate: IPropertyTemplate = {
            id: 'text',
            name: 'Generic Text',
            type: 'text',
            options: [],
        }

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
        const editElement = container.querySelector('.Editable')
        expect(editElement).toBeDefined()

        userEvent.type(editElement!, 'http://test{esc}')
        expect(container).toMatchSnapshot()
    })
})
