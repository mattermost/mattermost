// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {areEqual, createFilterClause} from './filterClause'

describe('filterClause tests', () => {
    it('create filter clause', () => {
        const clause = createFilterClause({
            propertyId: 'myPropertyId',
            condition: 'contains',
            values: [],
        })

        expect(clause).toEqual({
            propertyId: 'myPropertyId',
            condition: 'contains',
            values: [],
        })
    })

    it('test filter clauses are equal', () => {
        const clause = createFilterClause({
            propertyId: 'myPropertyId',
            condition: 'contains',
            values: ['abc', 'def'],
        })
        const newClause = createFilterClause(clause)
        const testEqual = areEqual(clause, newClause)
        expect(testEqual).toBeTruthy()
    })

    it('test filter clauses are Not equal property ID', () => {
        const clause = createFilterClause({
            propertyId: 'myPropertyId',
            condition: 'contains',
            values: ['abc', 'def'],
        })
        const newClause = createFilterClause(clause)
        newClause.propertyId = 'DifferentID'
        const testEqual = areEqual(clause, newClause)
        expect(testEqual).toBeFalsy()
    })
    it('test filter clauses are Not equal condition', () => {
        const clause = createFilterClause({
            propertyId: 'myPropertyId',
            condition: 'contains',
            values: ['abc', 'def'],
        })
        const newClause = createFilterClause(clause)
        newClause.condition = 'notContains'
        const testEqual = areEqual(clause, newClause)
        expect(testEqual).toBeFalsy()
    })
    it('test filter clauses are Not equal values', () => {
        const clause = createFilterClause({
            propertyId: 'myPropertyId',
            condition: 'contains',
            values: ['abc', 'def'],
        })
        const newClause = createFilterClause(clause)
        newClause.values = ['abc, def']
        const testEqual = areEqual(clause, newClause)
        expect(testEqual).toBeFalsy()
    })
})
