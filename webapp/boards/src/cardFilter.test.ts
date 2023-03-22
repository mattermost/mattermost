// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {mocked} from 'jest-mock'

import {createFilterClause} from './blocks/filterClause'

import {createFilterGroup} from './blocks/filterGroup'
import {CardFilter} from './cardFilter'
import {TestBlockFactory} from './test/testBlockFactory'
import {Utils} from './utils'

import {IPropertyTemplate} from './blocks/board'

jest.mock('./utils')
const mockedUtils = mocked(Utils, true)

const dayMillis = 24 * 60 * 60 * 1000

describe('src/cardFilter', () => {
    const board = TestBlockFactory.createBoard()
    board.id = '1'

    const card1 = TestBlockFactory.createCard(board)
    card1.id = '1'
    card1.title = 'card1'
    card1.fields.properties.propertyId = 'Status'
    const filterClause = createFilterClause({propertyId: 'propertyId', condition: 'isNotEmpty', values: ['Status']})

    describe('verify isClauseMet method', () => {
        test('should be true with isNotEmpty clause', () => {
            const filterClauseIsNotEmpty = createFilterClause({propertyId: 'propertyId', condition: 'isNotEmpty', values: ['Status']})
            const result = CardFilter.isClauseMet(filterClauseIsNotEmpty, [], card1)
            expect(result).toBeTruthy()
        })
        test('should be false with isEmpty clause', () => {
            const filterClauseIsEmpty = createFilterClause({propertyId: 'propertyId', condition: 'isEmpty', values: ['Status']})
            const result = CardFilter.isClauseMet(filterClauseIsEmpty, [], card1)
            expect(result).toBeFalsy()
        })
        test('should be true with includes clause', () => {
            const filterClauseIncludes = createFilterClause({propertyId: 'propertyId', condition: 'includes', values: ['Status']})
            const result = CardFilter.isClauseMet(filterClauseIncludes, [], card1)
            expect(result).toBeTruthy()
        })
        test('should be true with includes and no values clauses', () => {
            const filterClauseIncludes = createFilterClause({propertyId: 'propertyId', condition: 'includes', values: []})
            const result = CardFilter.isClauseMet(filterClauseIncludes, [], card1)
            expect(result).toBeTruthy()
        })
        test('should be false with notIncludes clause', () => {
            const filterClauseNotIncludes = createFilterClause({propertyId: 'propertyId', condition: 'notIncludes', values: ['Status']})
            const result = CardFilter.isClauseMet(filterClauseNotIncludes, [], card1)
            expect(result).toBeFalsy()
        })
        test('should be true with notIncludes and no values clauses', () => {
            const filterClauseNotIncludes = createFilterClause({propertyId: 'propertyId', condition: 'notIncludes', values: []})
            const result = CardFilter.isClauseMet(filterClauseNotIncludes, [], card1)
            expect(result).toBeTruthy()
        })
    })

    describe('verify isClauseMet method - person property', () => {
        const personCard = TestBlockFactory.createCard(board)
        personCard.id = '1'
        personCard.title = 'card1'
        personCard.fields.properties.personPropertyID = 'personid1'

        const template: IPropertyTemplate = {
            id: 'personPropertyID',
            name: 'myPerson',
            type: 'person',
            options: [],
        }

        test('should be true with isNotEmpty clause', () => {
            const filterClauseIsNotEmpty = createFilterClause({propertyId: 'personPropertyID', condition: 'isNotEmpty', values: []})
            const result = CardFilter.isClauseMet(filterClauseIsNotEmpty, [template], personCard)
            expect(result).toBeTruthy()
        })
        test('should be false with isEmpty clause', () => {
            const filterClauseIsEmpty = createFilterClause({propertyId: 'personPropertyID', condition: 'isEmpty', values: []})
            const result = CardFilter.isClauseMet(filterClauseIsEmpty, [template], personCard)
            expect(result).toBeFalsy()
        })
        test('verify empty includes clause', () => {
            const filterClauseIncludes = createFilterClause({propertyId: 'personPropertyID', condition: 'includes', values: []})
            const result = CardFilter.isClauseMet(filterClauseIncludes, [template], personCard)
            expect(result).toBeTruthy()
        })
        test('verify includes clause', () => {
            const filterClauseIncludes = createFilterClause({propertyId: 'personPropertyID', condition: 'includes', values: ['personid1']})
            const result = CardFilter.isClauseMet(filterClauseIncludes, [template], personCard)
            expect(result).toBeTruthy()
        })
        test('verify includes clause multiple values', () => {
            const filterClauseIncludes = createFilterClause({propertyId: 'personPropertyID', condition: 'includes', values: ['personid2', 'personid1']})
            const result = CardFilter.isClauseMet(filterClauseIncludes, [template], personCard)
            expect(result).toBeTruthy()
        })
        test('verify not includes clause', () => {
            const filterClauseIncludes = createFilterClause({propertyId: 'personPropertyID', condition: 'notIncludes', values: ['personid2']})
            const result = CardFilter.isClauseMet(filterClauseIncludes, [template], personCard)
            expect(result).toBeTruthy()
        })
    })

    describe('verify isClauseMet method - multi-person property', () => {
        const personCard = TestBlockFactory.createCard(board)
        personCard.id = '1'
        personCard.title = 'card1'
        personCard.fields.properties.personPropertyID = ['personid1', 'personid2']

        const template: IPropertyTemplate = {
            id: 'personPropertyID',
            name: 'myPerson',
            type: 'multiPerson',
            options: [],
        }

        test('should be true with isNotEmpty clause', () => {
            const filterClauseIsNotEmpty = createFilterClause({propertyId: 'personPropertyID', condition: 'isNotEmpty', values: []})
            const result = CardFilter.isClauseMet(filterClauseIsNotEmpty, [template], personCard)
            expect(result).toBeTruthy()
        })
        test('should be false with isEmpty clause', () => {
            const filterClauseIsEmpty = createFilterClause({propertyId: 'personPropertyID', condition: 'isEmpty', values: []})
            const result = CardFilter.isClauseMet(filterClauseIsEmpty, [template], personCard)
            expect(result).toBeFalsy()
        })
        test('verify empty includes clause', () => {
            const filterClauseIncludes = createFilterClause({propertyId: 'personPropertyID', condition: 'includes', values: []})
            const result = CardFilter.isClauseMet(filterClauseIncludes, [template], personCard)
            expect(result).toBeTruthy()
        })
        test('verify includes clause', () => {
            const filterClauseIncludes = createFilterClause({propertyId: 'personPropertyID', condition: 'includes', values: ['personid1']})
            const result = CardFilter.isClauseMet(filterClauseIncludes, [template], personCard)
            expect(result).toBeTruthy()
        })
        test('verify includes clause 2', () => {
            const filterClauseIncludes = createFilterClause({propertyId: 'personPropertyID', condition: 'includes', values: ['personid2']})
            const result = CardFilter.isClauseMet(filterClauseIncludes, [template], personCard)
            expect(result).toBeTruthy()
        })
        test('verify includes clause multiple values', () => {
            const filterClauseIncludes = createFilterClause({propertyId: 'personPropertyID', condition: 'includes', values: ['personid3', 'personid1']})
            const result = CardFilter.isClauseMet(filterClauseIncludes, [template], personCard)
            expect(result).toBeTruthy()
        })
        test('verify includes clause multiple values 2', () => {
            const filterClauseIncludes = createFilterClause({propertyId: 'personPropertyID', condition: 'includes', values: ['personid3', 'personid2']})
            const result = CardFilter.isClauseMet(filterClauseIncludes, [template], personCard)
            expect(result).toBeTruthy()
        })
        test('verify not includes clause', () => {
            const filterClauseIncludes = createFilterClause({propertyId: 'personPropertyID', condition: 'notIncludes', values: ['personid3']})
            const result = CardFilter.isClauseMet(filterClauseIncludes, [template], personCard)
            expect(result).toBeTruthy()
        })
        test('verify not includes clause, multiple values', () => {
            const filterClauseIncludes = createFilterClause({propertyId: 'personPropertyID', condition: 'notIncludes', values: ['personid3', 'personid4']})
            const result = CardFilter.isClauseMet(filterClauseIncludes, [template], personCard)
            expect(result).toBeTruthy()
        })
    })

    describe('verify isClauseMet method - (createdBy) person property', () => {
        const personCard = TestBlockFactory.createCard(board)
        personCard.id = '1'
        personCard.title = 'card1'
        personCard.createdBy = 'personid1'

        const template: IPropertyTemplate = {
            id: 'personPropertyID',
            name: 'myPerson',
            type: 'createdBy',
            options: [],
        }

        test('verify empty includes clause', () => {
            const filterClauseIncludes = createFilterClause({propertyId: 'personPropertyID', condition: 'includes', values: []})
            const result = CardFilter.isClauseMet(filterClauseIncludes, [template], personCard)
            expect(result).toBeTruthy()
        })
        test('verify includes clause', () => {
            const filterClauseIncludes = createFilterClause({propertyId: 'personPropertyID', condition: 'includes', values: ['personid1']})
            const result = CardFilter.isClauseMet(filterClauseIncludes, [template], personCard)
            expect(result).toBeTruthy()
        })
        test('verify includes clause multiple values', () => {
            const filterClauseIncludes = createFilterClause({propertyId: 'personPropertyID', condition: 'includes', values: ['personid3', 'personid1']})
            const result = CardFilter.isClauseMet(filterClauseIncludes, [template], personCard)
            expect(result).toBeTruthy()
        })
        test('verify not includes clause', () => {
            const filterClauseIncludes = createFilterClause({propertyId: 'personPropertyID', condition: 'notIncludes', values: ['personid2']})
            const result = CardFilter.isClauseMet(filterClauseIncludes, [template], personCard)
            expect(result).toBeTruthy()
        })
    })

    describe('verify isClauseMet method - single date property', () => {
        // Date Properties are stored as 12PM UTC.
        const now = new Date(Date.now())
        const propertyDate = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12)

        const dateCard = TestBlockFactory.createCard(board)
        dateCard.id = '1'
        dateCard.title = 'card1'
        dateCard.fields.properties.datePropertyID = '{ "from": ' + propertyDate.toString() + ' }'

        const checkDayBefore = propertyDate - dayMillis
        const checkDayAfter = propertyDate + dayMillis

        const template: IPropertyTemplate = {
            id: 'datePropertyID',
            name: 'myDate',
            type: 'date',
            options: [],
        }

        test('should be true with isSet clause', () => {
            const filterClauseIsSet = createFilterClause({propertyId: 'datePropertyID', condition: 'isSet', values: []})
            const result = CardFilter.isClauseMet(filterClauseIsSet, [template], dateCard)
            expect(result).toBeTruthy()
        })
        test('should be false with notSet clause', () => {
            const filterClauseIsNotSet = createFilterClause({propertyId: 'datePropertyID', condition: 'isNotSet', values: []})
            const result = CardFilter.isClauseMet(filterClauseIsNotSet, [template], dateCard)
            expect(result).toBeFalsy()
        })
        test('verify isBefore clause', () => {
            const filterClauseIsBefore = createFilterClause({propertyId: 'datePropertyID', condition: 'isBefore', values: [checkDayAfter.toString()]})
            const result = CardFilter.isClauseMet(filterClauseIsBefore, [template], dateCard)
            expect(result).toBeTruthy()

            const filterClauseIsNotBefore = createFilterClause({propertyId: 'datePropertyID', condition: 'isBefore', values: [checkDayBefore.toString()]})
            const result2 = CardFilter.isClauseMet(filterClauseIsNotBefore, [template], dateCard)
            expect(result2).toBeFalsy()
        })
        test('verify isAfter clauses', () => {
            const filterClauseisAfter = createFilterClause({propertyId: 'datePropertyID', condition: 'isAfter', values: [checkDayBefore.toString()]})
            const result = CardFilter.isClauseMet(filterClauseisAfter, [template], dateCard)
            expect(result).toBeTruthy()

            const filterClauseisNotAfter = createFilterClause({propertyId: 'datePropertyID', condition: 'isAfter', values: [checkDayAfter.toString()]})
            const result2 = CardFilter.isClauseMet(filterClauseisNotAfter, [template], dateCard)
            expect(result2).toBeFalsy()
        })
        test('verify is clause', () => {
            const filterClauseIs = createFilterClause({propertyId: 'datePropertyID', condition: 'is', values: [propertyDate.toString()]})
            const result = CardFilter.isClauseMet(filterClauseIs, [template], dateCard)
            expect(result).toBeTruthy()

            const filterClauseIsNot = createFilterClause({propertyId: 'datePropertyID', condition: 'is', values: [checkDayBefore.toString()]})
            const result2 = CardFilter.isClauseMet(filterClauseIsNot, [template], dateCard)
            expect(result2).toBeFalsy()
        })
    })

    describe('verify isClauseMet method - date range property', () => {
        // Date Properties are stored as 12PM UTC.
        const now = new Date(Date.now())
        const fromDate = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12)
        const toDate = fromDate + (2 * dayMillis)
        const dateCard = TestBlockFactory.createCard(board)
        dateCard.id = '1'
        dateCard.title = 'card1'
        dateCard.fields.properties.datePropertyID = '{ "from": ' + fromDate.toString() + ', "to": ' + toDate.toString() + ' }'

        const beforeRange = fromDate - dayMillis
        const afterRange = toDate + dayMillis
        const inRange = fromDate + dayMillis

        const template: IPropertyTemplate = {
            id: 'datePropertyID',
            name: 'myDate',
            type: 'date',
            options: [],
        }

        test('verify isBefore clause', () => {
            const filterClauseIsBeforeEmpty = createFilterClause({propertyId: 'datePropertyID', condition: 'isBefore', values: []})
            const resulta = CardFilter.isClauseMet(filterClauseIsBeforeEmpty, [template], dateCard)
            expect(resulta).toBeTruthy()

            const filterClauseIsBefore = createFilterClause({propertyId: 'datePropertyID', condition: 'isBefore', values: [beforeRange.toString()]})
            const result = CardFilter.isClauseMet(filterClauseIsBefore, [template], dateCard)
            expect(result).toBeFalsy()

            const filterClauseIsInRange = createFilterClause({propertyId: 'datePropertyID', condition: 'isBefore', values: [inRange.toString()]})
            const result2 = CardFilter.isClauseMet(filterClauseIsInRange, [template], dateCard)
            expect(result2).toBeTruthy()

            const filterClauseIsAfter = createFilterClause({propertyId: 'datePropertyID', condition: 'isBefore', values: [afterRange.toString()]})
            const result3 = CardFilter.isClauseMet(filterClauseIsAfter, [template], dateCard)
            expect(result3).toBeTruthy()
        })

        test('verify isAfter clauses', () => {
            const filterClauseIsAfterEmpty = createFilterClause({propertyId: 'datePropertyID', condition: 'isBefore', values: []})
            const resulta = CardFilter.isClauseMet(filterClauseIsAfterEmpty, [template], dateCard)
            expect(resulta).toBeTruthy()

            const filterClauseIsAfter = createFilterClause({propertyId: 'datePropertyID', condition: 'isAfter', values: [afterRange.toString()]})
            const result = CardFilter.isClauseMet(filterClauseIsAfter, [template], dateCard)
            expect(result).toBeFalsy()

            const filterClauseIsInRange = createFilterClause({propertyId: 'datePropertyID', condition: 'isAfter', values: [inRange.toString()]})
            const result2 = CardFilter.isClauseMet(filterClauseIsInRange, [template], dateCard)
            expect(result2).toBeTruthy()

            const filterClauseIsBefore = createFilterClause({propertyId: 'datePropertyID', condition: 'isAfter', values: [beforeRange.toString()]})
            const result3 = CardFilter.isClauseMet(filterClauseIsBefore, [template], dateCard)
            expect(result3).toBeTruthy()
        })

        test('verify is clause', () => {
            const filterClauseIsEmpty = createFilterClause({propertyId: 'datePropertyID', condition: 'isBefore', values: []})
            const resulta = CardFilter.isClauseMet(filterClauseIsEmpty, [template], dateCard)
            expect(resulta).toBeTruthy()

            const filterClauseIsBefore = createFilterClause({propertyId: 'datePropertyID', condition: 'is', values: [beforeRange.toString()]})
            const result = CardFilter.isClauseMet(filterClauseIsBefore, [template], dateCard)
            expect(result).toBeFalsy()

            const filterClauseIsInRange = createFilterClause({propertyId: 'datePropertyID', condition: 'is', values: [inRange.toString()]})
            const result2 = CardFilter.isClauseMet(filterClauseIsInRange, [template], dateCard)
            expect(result2).toBeTruthy()

            const filterClauseIsAfter = createFilterClause({propertyId: 'datePropertyID', condition: 'is', values: [afterRange.toString()]})
            const result3 = CardFilter.isClauseMet(filterClauseIsAfter, [template], dateCard)
            expect(result3).toBeFalsy()
        })
    })

    describe('verify isClauseMet method - (createdTime) date property', () => {
        const createDate = new Date(card1.createAt)
        const checkDate = Date.UTC(createDate.getFullYear(), createDate.getMonth(), createDate.getDate(), 12)
        const checkDayBefore = checkDate - dayMillis
        const checkDayAfter = checkDate + dayMillis

        const template: IPropertyTemplate = {
            id: 'datePropertyID',
            name: 'myDate',
            type: 'createdTime',
            options: [],
        }

        test('should be true with isSet clause', () => {
            const filterClauseIsSet = createFilterClause({propertyId: 'datePropertyID', condition: 'isSet', values: []})
            const result = CardFilter.isClauseMet(filterClauseIsSet, [template], card1)
            expect(result).toBeTruthy()
        })
        test('should be false with notSet clause', () => {
            const filterClauseIsNotSet = createFilterClause({propertyId: 'datePropertyID', condition: 'isNotSet', values: []})
            const result = CardFilter.isClauseMet(filterClauseIsNotSet, [template], card1)
            expect(result).toBeFalsy()
        })
        test('verify isBefore clause', () => {
            const filterClauseIsBefore = createFilterClause({propertyId: 'datePropertyID', condition: 'isBefore', values: [checkDayAfter.toString()]})
            const result = CardFilter.isClauseMet(filterClauseIsBefore, [template], card1)
            expect(result).toBeTruthy()

            const filterClauseIsNotBefore = createFilterClause({propertyId: 'datePropertyID', condition: 'isBefore', values: [checkDate.toString()]})
            const result2 = CardFilter.isClauseMet(filterClauseIsNotBefore, [template], card1)
            expect(result2).toBeFalsy()
        })
        test('verify isAfter clauses', () => {
            const filterClauseisAfter = createFilterClause({propertyId: 'datePropertyID', condition: 'isAfter', values: [checkDayBefore.toString()]})
            const result = CardFilter.isClauseMet(filterClauseisAfter, [template], card1)
            expect(result).toBeTruthy()

            const filterClauseisNotAfter = createFilterClause({propertyId: 'datePropertyID', condition: 'isAfter', values: [checkDate.toString()]})
            const result2 = CardFilter.isClauseMet(filterClauseisNotAfter, [template], card1)
            expect(result2).toBeFalsy()
        })
        test('verify is clause', () => {
            // Is should find on that date regardless of time.
            const filterClauseIs = createFilterClause({propertyId: 'datePropertyID', condition: 'is', values: [checkDate.toString()]})
            const result = CardFilter.isClauseMet(filterClauseIs, [template], card1)
            expect(result).toBeTruthy()

            const filterClauseIsNot = createFilterClause({propertyId: 'datePropertyID', condition: 'is', values: [checkDayBefore.toString()]})
            const result2 = CardFilter.isClauseMet(filterClauseIsNot, [template], card1)
            expect(result2).toBeFalsy()

            const filterClauseIsNot2 = createFilterClause({propertyId: 'datePropertyID', condition: 'is', values: [checkDayAfter.toString()]})
            const result3 = CardFilter.isClauseMet(filterClauseIsNot2, [template], card1)
            expect(result3).toBeFalsy()
        })
    })

    describe('verify isFilterGroupMet method', () => {
        test('should return true with no filter', () => {
            const filterGroup = createFilterGroup({
                operation: 'and',
                filters: [],
            })
            const result = CardFilter.isFilterGroupMet(filterGroup, [], card1)
            expect(result).toBeTruthy()
        })
        test('should return true with or operation and 2 filterCause, one is false ', () => {
            const filterClauseNotIncludes = createFilterClause({propertyId: 'propertyId', condition: 'notIncludes', values: ['Status']})
            const filterGroup = createFilterGroup({
                operation: 'or',
                filters: [
                    filterClauseNotIncludes,
                    filterClause,
                ],
            })
            const result = CardFilter.isFilterGroupMet(filterGroup, [], card1)
            expect(result).toBeTruthy()
        })
        test('should return true with or operation and 2 filterCause, 1 filtergroup in filtergroup, one filterClause is false ', () => {
            const filterClauseNotIncludes = createFilterClause({propertyId: 'propertyId', condition: 'notIncludes', values: ['Status']})
            const filterGroupInFilterGroup = createFilterGroup({
                operation: 'or',
                filters: [
                    filterClauseNotIncludes,
                    filterClause,
                ],
            })
            const filterGroup = createFilterGroup({
                operation: 'or',
                filters: [],
            })
            filterGroup.filters.push(filterGroupInFilterGroup)
            const result = CardFilter.isFilterGroupMet(filterGroup, [], card1)
            expect(result).toBeTruthy()
        })
        test('should return false with or operation and two filterCause, two are false ', () => {
            const filterClauseNotIncludes = createFilterClause({propertyId: 'propertyId', condition: 'notIncludes', values: ['Status']})
            const filterClauseEmpty = createFilterClause({propertyId: 'propertyId', condition: 'isEmpty', values: ['Status']})
            const filterGroup = createFilterGroup({
                operation: 'or',
                filters: [
                    filterClauseNotIncludes,
                    filterClauseEmpty,
                ],
            })
            const result = CardFilter.isFilterGroupMet(filterGroup, [], card1)
            expect(result).toBeFalsy()
        })
        test('should return false with and operation and 2 filterCause, one is false ', () => {
            const filterClauseNotIncludes = createFilterClause({propertyId: 'propertyId', condition: 'notIncludes', values: ['Status']})
            const filterGroup = createFilterGroup({
                operation: 'and',
                filters: [
                    filterClauseNotIncludes,
                    filterClause,
                ],
            })
            const result = CardFilter.isFilterGroupMet(filterGroup, [], card1)
            expect(result).toBeFalsy()
        })
        test('should return true with and operation and 2 filterCause, two are true ', () => {
            const filterClauseIncludes = createFilterClause({propertyId: 'propertyId', condition: 'includes', values: ['Status']})
            const filterGroup = createFilterGroup({
                operation: 'and',
                filters: [
                    filterClauseIncludes,
                    filterClause,
                ],
            })
            const result = CardFilter.isFilterGroupMet(filterGroup, [], card1)
            expect(result).toBeTruthy()
        })
        test('should return true with or operation and 2 filterCause, 1 filtergroup in filtergroup, one filterClause is false ', () => {
            const filterClauseNotIncludes = createFilterClause({propertyId: 'propertyId', condition: 'notIncludes', values: ['Status']})
            const filterGroupInFilterGroup = createFilterGroup({
                operation: 'and',
                filters: [
                    filterClauseNotIncludes,
                    filterClause,
                ],
            })
            const filterGroup = createFilterGroup({
                operation: 'and',
                filters: [],
            })
            filterGroup.filters.push(filterGroupInFilterGroup)
            const result = CardFilter.isFilterGroupMet(filterGroup, [], card1)
            expect(result).toBeFalsy()
        })
    })
    describe('verify propertyThatMeetsFilterClause method', () => {
        test('should return Utils.assertFailure and filterClause propertyId ', () => {
            const filterClauseIsNotEmpty = createFilterClause({propertyId: 'propertyId', condition: 'isNotEmpty', values: ['Status']})
            const result = CardFilter.propertyThatMeetsFilterClause(filterClauseIsNotEmpty, [])
            expect(mockedUtils.assertFailure).toBeCalledTimes(1)
            expect(result.id).toEqual(filterClauseIsNotEmpty.propertyId)
        })
        test('should return filterClause propertyId with non-select template and isNotEmpty clause ', () => {
            const filterClauseIsNotEmpty = createFilterClause({propertyId: 'propertyId', condition: 'isNotEmpty', values: ['Status']})
            const templateFilter: IPropertyTemplate = {
                id: filterClauseIsNotEmpty.propertyId,
                name: 'template',
                type: 'text',
                options: [],
            }
            const result = CardFilter.propertyThatMeetsFilterClause(filterClauseIsNotEmpty, [templateFilter])
            expect(result.id).toEqual(filterClauseIsNotEmpty.propertyId)
            expect(result.value).toBeFalsy()
        })
        test('should return filterClause propertyId with select template , an option and isNotEmpty clause ', () => {
            const filterClauseIsNotEmpty = createFilterClause({propertyId: 'propertyId', condition: 'isNotEmpty', values: ['Status']})
            const templateFilter: IPropertyTemplate = {
                id: filterClauseIsNotEmpty.propertyId,
                name: 'template',
                type: 'select',
                options: [{
                    id: 'idOption',
                    value: '',
                    color: '',
                }],
            }
            const result = CardFilter.propertyThatMeetsFilterClause(filterClauseIsNotEmpty, [templateFilter])
            expect(result.id).toEqual(filterClauseIsNotEmpty.propertyId)
            expect(result.value).toEqual('idOption')
        })
        test('should return filterClause propertyId with select template , no option and isNotEmpty clause ', () => {
            const filterClauseIsNotEmpty = createFilterClause({propertyId: 'propertyId', condition: 'isNotEmpty', values: ['Status']})
            const templateFilter: IPropertyTemplate = {
                id: filterClauseIsNotEmpty.propertyId,
                name: 'template',
                type: 'select',
                options: [],
            }
            const result = CardFilter.propertyThatMeetsFilterClause(filterClauseIsNotEmpty, [templateFilter])
            expect(result.id).toEqual(filterClauseIsNotEmpty.propertyId)
            expect(result.value).toBeFalsy()
        })

        test('should return filterClause propertyId with template, and includes clause with values', () => {
            const filterClauseIncludes = createFilterClause({propertyId: 'propertyId', condition: 'includes', values: ['Status']})
            const templateFilter: IPropertyTemplate = {
                id: filterClauseIncludes.propertyId,
                name: 'template',
                type: 'text',
                options: [],
            }
            const result = CardFilter.propertyThatMeetsFilterClause(filterClauseIncludes, [templateFilter])
            expect(result.id).toEqual(filterClauseIncludes.propertyId)
            expect(result.value).toEqual(filterClauseIncludes.values[0])
        })
        test('should return filterClause propertyId with template, and includes clause with no values', () => {
            const filterClauseIncludes = createFilterClause({propertyId: 'propertyId', condition: 'includes', values: []})
            const templateFilter: IPropertyTemplate = {
                id: filterClauseIncludes.propertyId,
                name: 'template',
                type: 'text',
                options: [],
            }
            const result = CardFilter.propertyThatMeetsFilterClause(filterClauseIncludes, [templateFilter])
            expect(result.id).toEqual(filterClauseIncludes.propertyId)
            expect(result.value).toBeFalsy()
        })
        test('should return filterClause propertyId with template, and notIncludes clause', () => {
            const filterClauseNotIncludes = createFilterClause({propertyId: 'propertyId', condition: 'notIncludes', values: []})
            const templateFilter: IPropertyTemplate = {
                id: filterClauseNotIncludes.propertyId,
                name: 'template',
                type: 'text',
                options: [],
            }
            const result = CardFilter.propertyThatMeetsFilterClause(filterClauseNotIncludes, [templateFilter])
            expect(result.id).toEqual(filterClauseNotIncludes.propertyId)
            expect(result.value).toBeFalsy()
        })
        test('should return filterClause propertyId with template, and isEmpty clause', () => {
            const filterClauseIsEmpty = createFilterClause({propertyId: 'propertyId', condition: 'isEmpty', values: []})
            const templateFilter: IPropertyTemplate = {
                id: filterClauseIsEmpty.propertyId,
                name: 'template',
                type: 'text',
                options: [],
            }
            const result = CardFilter.propertyThatMeetsFilterClause(filterClauseIsEmpty, [templateFilter])
            expect(result.id).toEqual(filterClauseIsEmpty.propertyId)
            expect(result.value).toBeFalsy()
        })
    })
    describe('verify propertyThatMeetsFilterClause method - Person properties', () => {
        test('should return filterClause propertyId with template, and isEmpty clause', () => {
            const filterClauseIsEmpty = createFilterClause({propertyId: 'propertyId', condition: 'is', values: []})
            const templateFilter: IPropertyTemplate = {
                id: filterClauseIsEmpty.propertyId,
                name: 'template',
                type: 'createdBy',
                options: [],
            }
            const result = CardFilter.propertyThatMeetsFilterClause(filterClauseIsEmpty, [templateFilter])
            expect(result.id).toEqual(filterClauseIsEmpty.propertyId)
            expect(result.value).toBeFalsy()
        })
        test('should return filterClause propertyId with template, and isEmpty clause', () => {
            const filterClauseIsEmpty = createFilterClause({propertyId: 'propertyId', condition: 'is', values: []})
            const templateFilter: IPropertyTemplate = {
                id: filterClauseIsEmpty.propertyId,
                name: 'template',
                type: 'createdBy',
                options: [],
            }
            const result = CardFilter.propertyThatMeetsFilterClause(filterClauseIsEmpty, [templateFilter])
            expect(result.id).toEqual(filterClauseIsEmpty.propertyId)
            expect(result.value).toBeFalsy()
        })
    })
    describe('verify propertiesThatMeetFilterGroup method', () => {
        test('should return {} with undefined filterGroup', () => {
            const result = CardFilter.propertiesThatMeetFilterGroup(undefined, [])
            expect(result).toEqual({})
        })
        test('should return {} with filterGroup without filter', () => {
            const filterGroup = createFilterGroup({
                operation: 'and',
                filters: [],
            })
            const result = CardFilter.propertiesThatMeetFilterGroup(filterGroup, [])
            expect(result).toEqual({})
        })
        test('should return {} with filterGroup, or operation and no template', () => {
            const filterClauseIncludes = createFilterClause({propertyId: 'propertyId', condition: 'includes', values: ['Status']})
            const filterGroup = createFilterGroup({
                operation: 'or',
                filters: [
                    filterClauseIncludes,
                    filterClause,
                ],
            })
            const result = CardFilter.propertiesThatMeetFilterGroup(filterGroup, [])
            expect(result).toEqual({})
        })
        test('should return a result with filterGroup, or operation and template', () => {
            const filterClauseIncludes = createFilterClause({propertyId: 'propertyId', condition: 'includes', values: ['Status']})
            const filterGroup = createFilterGroup({
                operation: 'or',
                filters: [
                    filterClauseIncludes,
                    filterClause,
                ],
            })
            const templateFilter: IPropertyTemplate = {
                id: filterClauseIncludes.propertyId,
                name: 'template',
                type: 'text',
                options: [],
            }
            const result = CardFilter.propertiesThatMeetFilterGroup(filterGroup, [templateFilter])
            expect(result).toBeDefined()
            expect(result.propertyId).toEqual(filterClauseIncludes.values[0])
        })
        test('should return {} with filterGroup, and operation and no template', () => {
            const filterClauseIncludes = createFilterClause({propertyId: 'propertyId', condition: 'includes', values: ['Status']})
            const filterGroup = createFilterGroup({
                operation: 'and',
                filters: [
                    filterClauseIncludes,
                    filterClause,
                ],
            })
            const result = CardFilter.propertiesThatMeetFilterGroup(filterGroup, [])
            expect(result).toEqual({})
        })

        test('should return a result with filterGroup, and operation and template', () => {
            const filterClauseIncludes = createFilterClause({propertyId: 'propertyId', condition: 'includes', values: ['Status']})
            const filterGroup = createFilterGroup({
                operation: 'and',
                filters: [
                    filterClauseIncludes,
                    filterClause,
                ],
            })
            const templateFilter: IPropertyTemplate = {
                id: filterClauseIncludes.propertyId,
                name: 'template',
                type: 'text',
                options: [],
            }
            const result = CardFilter.propertiesThatMeetFilterGroup(filterGroup, [templateFilter])
            expect(result).toBeDefined()
            expect(result.propertyId).toEqual(filterClauseIncludes.values[0])
        })
    })
    describe('verify applyFilterGroup method', () => {
        test('should return array with card1', () => {
            const filterClauseNotIncludes = createFilterClause({propertyId: 'propertyId', condition: 'notIncludes', values: ['Status']})
            const filterGroup = createFilterGroup({
                operation: 'or',
                filters: [
                    filterClauseNotIncludes,
                    filterClause,
                ],
            })
            const result = CardFilter.applyFilterGroup(filterGroup, [], [card1])
            expect(result).toBeDefined()
            expect(result[0]).toEqual(card1)
        })
    })
    describe('verfiy applyFilterGroup method for case-sensitive search', () => {
        test('should return array with card1 when search by test as Card1', () => {
            const filterClauseNotContains = createFilterClause({propertyId: 'title', condition: 'contains', values: ['Card1']})
            const filterGroup = createFilterGroup({
                operation: 'and',
                filters: [
                    filterClauseNotContains,
                ],
            })
            const result = CardFilter.applyFilterGroup(filterGroup, [], [card1])
            expect(result.length).toEqual(1)
        })
    })
    describe('verify applyFilter for title', () => {
        test('should not return array with card1', () => {
            const filterClauseNotContains = createFilterClause({propertyId: 'title', condition: 'notContains', values: ['card1']})
            const filterGroup = createFilterGroup({
                operation: 'and',
                filters: [
                    filterClauseNotContains,
                ],
            })
            const result = CardFilter.applyFilterGroup(filterGroup, [], [card1])
            expect(result.length).toEqual(0)
        })
    })
})
