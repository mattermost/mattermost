// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createIntl} from 'react-intl'

import {TestBlockFactory} from 'src/test/testBlockFactory'

import {IPropertyTemplate} from 'src/blocks/board'

import Calculations from './calculations'

describe('components/calculations/calculation logic', () => {
    const board = TestBlockFactory.createBoard()

    const card1 = TestBlockFactory.createCard(board)
    card1.fields.properties.property_text = 'lorem ipsum'
    card1.fields.properties.property_number = '100'
    card1.fields.properties.property_email = 'foobar@example.com'
    card1.fields.properties.property_phone = '+1 1234567890'
    card1.fields.properties.property_url = 'example.com'
    card1.fields.properties.property_select = 'option_id_1'
    card1.fields.properties.property_multiSelect = ['option_id_1', 'option_id_2', 'option_id_3']
    card1.fields.properties.property_date = '1625553000000'
    card1.fields.properties.property_person = 'user_id_1'
    card1.fields.properties.property_checkbox = 'true'
    card1.createdBy = 'user_id_1'
    card1.createAt = 1625553000000
    card1.modifiedBy = 'user_id_1'
    card1.updateAt = 1625553000000

    const card2 = TestBlockFactory.createCard(board)
    card2.fields.properties.property_text = 'foo bar'
    card2.fields.properties.property_number = '-30'
    card2.fields.properties.property_email = 'loremipsum@example.com'
    card2.fields.properties.property_phone = '+1 111'
    card2.fields.properties.property_url = 'example.com/foobar'
    card2.fields.properties.property_select = 'option_id_2'
    card2.fields.properties.property_multiSelect = ['option_id_2', 'option_id_3']
    card2.fields.properties.property_date = '1625639400000'
    card2.fields.properties.property_person = 'user_id_2'
    card2.fields.properties.property_checkbox = 'false'
    card2.createAt = 1625639400000
    card2.createdBy = 'user_id_2'
    card2.updateAt = 1625639400000
    card2.modifiedBy = 'user_id_2'

    // card with all properties unset
    const card3 = TestBlockFactory.createCard(board)
    card3.createAt = 1625639400000
    card3.createdBy = 'user_id_2'
    card3.updateAt = 1625639400000
    card3.modifiedBy = 'user_id_2'

    // clone of card 1. All properties exactly same as that of card 1
    const card4 = TestBlockFactory.createCard(board)
    card4.fields.properties.property_text = 'lorem ipsum'
    card4.fields.properties.property_number = '100'
    card4.fields.properties.property_email = 'foobar@example.com'
    card4.fields.properties.property_phone = '+1 1234567890'
    card4.fields.properties.property_url = 'example.com'
    card4.fields.properties.property_select = 'option_id_1'
    card4.fields.properties.property_multiSelect = ['option_id_1', 'option_id_2', 'option_id_3']
    card4.fields.properties.property_date = '1625553000000'
    card4.fields.properties.property_person = 'user_id_1'
    card4.fields.properties.property_checkbox = 'true'
    card4.createAt = 1625553000000
    card4.createdBy = 'user_id_1'
    card4.updateAt = 1625553000000
    card4.modifiedBy = 'user_id_1'

    // card with all empty values
    const card5 = TestBlockFactory.createCard(board)
    card5.fields.properties.property_text = ''
    card5.fields.properties.property_number = ''
    card5.fields.properties.property_email = ''
    card5.fields.properties.property_phone = ''
    card5.fields.properties.property_url = ''
    card5.fields.properties.property_select = ''
    card5.fields.properties.property_multiSelect = []
    card5.fields.properties.property_date = ''
    card5.fields.properties.property_person = ''
    card5.fields.properties.property_checkbox = ''

    // clone of card 3 but created / updated 1 second later
    const card6 = TestBlockFactory.createCard(board)
    card6.createAt = 1625639401000
    card6.createdBy = 'user_id_2'
    card6.updateAt = 1625639401000
    card6.modifiedBy = 'user_id_2'

    // clone of card 3 but created / updated 1 minute later
    const card7 = TestBlockFactory.createCard(board)
    card7.createAt = 1625639460000
    card7.createdBy = 'user_id_2'
    card7.updateAt = 1625639460000
    card7.modifiedBy = 'user_id_2'

    const cards = [card1, card2, card3, card4]

    const properties: Record<string, IPropertyTemplate> = {
        text: {id: 'property_text', type: 'text', name: '', options: []},
        number: {id: 'property_number', type: 'number', name: '', options: []},
        email: {id: 'property_email', type: 'email', name: '', options: []},
        phone: {id: 'property_phone', type: 'phone', name: '', options: []},
        url: {id: 'property_url', type: 'url', name: '', options: []},
        select: {
            id: 'property_select',
            type: 'select',
            name: '',
            options: [
                {
                    color: 'propColorYellow',
                    id: 'option_id_1',
                    value: 'Option 1',
                },
                {
                    color: 'propColorBlue',
                    id: 'option_id_2',
                    value: 'Option 2',
                },
            ],
        },
        multiSelect: {
            id: 'property_multiSelect',
            type: 'multiSelect',
            name: '',
            options: [
                {
                    color: 'propColorYellow',
                    id: 'option_id_1',
                    value: 'Option 1',
                },
                {
                    color: 'propColorBlue',
                    id: 'option_id_2',
                    value: 'Option 2',
                },
                {
                    color: 'propColorBlue',
                    id: 'option_id_3',
                    value: 'Option 3',
                },
            ],
        },
        date: {id: 'property_date', type: 'date', name: '', options: []},
        person: {id: 'property_person', type: 'person', name: '', options: []},
        checkbox: {id: 'property_checkbox', type: 'checkbox', name: '', options: []},
        createdTime: {id: 'property_createdTime', type: 'createdTime', name: '', options: []},
        createdBy: {id: 'property_createdBy', type: 'createdBy', name: '', options: []},
        updatedTime: {id: 'property_lastUpdatedTime', type: 'updatedTime', name: '', options: []},
        updatedBy: {id: 'property_lastUpdatedBy', type: 'updatedBy', name: '', options: []},
    }

    const autofilledProperties = new Set([properties.createdBy, properties.createdTime, properties.updatedBy, properties.updatedTime])

    const intl = createIntl({locale: 'en-us'})

    // testing count
    Object.values(properties).forEach((property) => {
        it(`should correctly count for property type "${property.type}"`, function() {
            expect(Calculations.count(cards, property, intl)).toBe('4')
        })
    })

    // testing count empty
    Object.values(properties).filter((p) => !autofilledProperties.has(p)).forEach((property) => {
        it(`should correctly count empty for property type "${property.type}"`, function() {
            expect(Calculations.countEmpty(cards, property, intl)).toBe('1')
        })
    })

    // testing percent empty
    Object.values(properties).filter((p) => !autofilledProperties.has(p)).forEach((property) => {
        it(`should correctly compute empty percent for property type "${property.type}"`, function() {
            expect(Calculations.percentEmpty(cards, property, intl)).toBe('25%')
        })
    })

    // testing count not empty
    Object.values(properties).filter((p) => !autofilledProperties.has(p)).forEach((property) => {
        it(`should correctly count not empty for property type "${property.type}"`, function() {
            expect(Calculations.countNotEmpty(cards, property, intl)).toBe('3')
        })
    })

    // testing percent not empty
    Object.values(properties).filter((p) => !autofilledProperties.has(p)).forEach((property) => {
        it(`should correctly compute not empty percent for property type "${property.type}"`, function() {
            expect(Calculations.percentNotEmpty(cards, property, intl)).toBe('75%')
        })
    })

    // testing countValues
    const countValueTests: Record<string, string> = {
        text: '3',
        number: '3',
        email: '3',
        phone: '3',
        url: '3',
        select: '3',
        multiSelect: '8',
        date: '3',
        person: '3',
        checkbox: '3',
        createdTime: '4',
        createdBy: '4',
        updatedTime: '4',
        updatedBy: '4',
    }
    Object.keys(countValueTests).forEach((propertyType) => {
        it(`should correctly count values for property type ${propertyType}`, function() {
            expect(Calculations.countValue(cards, properties[propertyType]!, intl)).toBe(countValueTests[propertyType]!)
        })
    })

    // testing countUniqueValue
    const countUniqueValueTests: Record<string, string> = {
        text: '2',
        number: '2',
        email: '2',
        phone: '2',
        url: '2',
        select: '2',
        multiSelect: '3',
        date: '2',
        person: '2',
        checkbox: '2',
        createdTime: '2',
        createdBy: '2',
        updatedTime: '2',
        updatedBy: '2',
    }
    Object.keys(countUniqueValueTests).forEach((propertyType) => {
        it(`should correctly count unique values for property type ${propertyType}`, function() {
            expect(Calculations.countUniqueValue(cards, properties[propertyType]!, intl)).toBe(countUniqueValueTests[propertyType]!)
        })
    })

    test('countUniqueValue for cards created 1 second apart', () => {
        const result = Calculations.countUniqueValue([card3, card6], properties.createdTime, intl)
        expect(result).toBe('1')
    })

    test('countUniqueValue for cards updated 1 second apart', () => {
        const result = Calculations.countUniqueValue([card3, card6], properties.updatedTime, intl)
        expect(result).toBe('1')
    })

    test('countUniqueValue for cards created 1 minute apart', () => {
        const result = Calculations.countUniqueValue([card3, card7], properties.createdTime, intl)
        expect(result).toBe('2')
    })

    test('countUniqueValue for cards updated 1 minute apart', () => {
        const result = Calculations.countUniqueValue([card3, card7], properties.updatedTime, intl)
        expect(result).toBe('2')
    })

    test('countChecked for cards', () => {
        const result = Calculations.countChecked(cards, properties.checkbox, intl)
        expect(result).toBe('3')
    })

    test('countChecked for cards, one set, other unset', () => {
        const result = Calculations.countChecked([card1, card5], properties.checkbox, intl)
        expect(result).toBe('1')
    })

    test('countUnchecked for cards', () => {
        const result = Calculations.countUnchecked(cards, properties.checkbox, intl)
        expect(result).toBe('1')
    })

    test('countUnchecked for cards, two set, one unset', () => {
        const result = Calculations.countUnchecked([card1, card1, card5], properties.checkbox, intl)
        expect(result).toBe('1')
    })

    test('countUnchecked for cards, one set, other unset', () => {
        const result = Calculations.countUnchecked([card1, card5], properties.checkbox, intl)
        expect(result).toBe('1')
    })

    test('countUnchecked for cards, one set, two unset', () => {
        const result = Calculations.countUnchecked([card1, card5, card5], properties.checkbox, intl)
        expect(result).toBe('2')
    })

    test('percentChecked for cards', () => {
        const result = Calculations.percentChecked(cards, properties.checkbox, intl)
        expect(result).toBe('75%')
    })

    test('percentUnchecked for cards', () => {
        const result = Calculations.percentUnchecked(cards, properties.checkbox, intl)
        expect(result).toBe('25%')
    })

    test('sum', () => {
        const result = Calculations.sum(cards, properties.number, intl)
        expect(result).toBe('170')
    })

    test('average', () => {
        const result = Calculations.average(cards, properties.number, intl)
        expect(result).toBe('56.67')
    })

    test('median', () => {
        const result = Calculations.median(cards, properties.number, intl)
        expect(result).toBe('100')
    })

    test('min', () => {
        const result = Calculations.min(cards, properties.number, intl)
        expect(result).toBe('-30')
    })

    test('max', () => {
        const result = Calculations.max(cards, properties.number, intl)
        expect(result).toBe('100')
    })

    test('range', () => {
        const result = Calculations.range(cards, properties.number, intl)
        expect(result).toBe('-30 - 100')
    })
})
