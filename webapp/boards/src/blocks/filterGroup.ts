// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {FilterClause, createFilterClause} from './filterClause'

type FilterGroupOperation = 'and' | 'or'

// A FilterGroup has 2 forms: (A or B or C) OR (A and B and C)
type FilterGroup = {
    operation: FilterGroupOperation
    filters: Array<FilterClause | FilterGroup>
}

function isAFilterGroupInstance(object: (FilterClause | FilterGroup)): object is FilterGroup {
    return 'operation' in object && 'filters' in object
}

function createFilterGroup(o?: FilterGroup): FilterGroup {
    let filters: Array<FilterClause | FilterGroup> = []
    if (o?.filters) {
        filters = o.filters.map((p: (FilterClause | FilterGroup)) => {
            if (isAFilterGroupInstance(p)) {
                return createFilterGroup(p)
            }
            return createFilterClause(p)
        })
    }
    return {
        operation: o?.operation || 'and',
        filters,
    }
}

export {FilterGroup, FilterGroupOperation, createFilterGroup, isAFilterGroupInstance}
