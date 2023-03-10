// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {Utils} from 'src/utils'

type FilterCondition =
    'includes' | 'notIncludes' |
    'isEmpty' | 'isNotEmpty' |
    'isSet' | 'isNotSet' |
    'is' |
    'contains' | 'notContains' |
    'startsWith' | 'notStartsWith' |
    'endsWith' | 'notEndsWith' |
    'isBefore' | 'isAfter'

type FilterClause = {
    propertyId: string
    condition: FilterCondition
    values: string[]
}

function createFilterClause(o?: FilterClause): FilterClause {
    return {
        propertyId: o?.propertyId || '',
        condition: o?.condition || 'includes',
        values: o?.values?.slice() || [],
    }
}

function areEqual(a: FilterClause, b: FilterClause): boolean {
    return (
        a.propertyId === b.propertyId &&
        a.condition === b.condition &&
        Utils.arraysEqual(a.values, b.values)
    )
}

export {FilterClause, FilterCondition, createFilterClause, areEqual}
