// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {DateUtils} from 'react-day-picker'

import {DateProperty} from './properties/date/date'

import {IPropertyTemplate} from './blocks/board'
import {Card} from './blocks/card'
import {FilterClause} from './blocks/filterClause'
import {FilterGroup, isAFilterGroupInstance} from './blocks/filterGroup'
import {Utils} from './utils'

const halfDay = 12 * 60 * 60 * 1000

class CardFilter {
    static createDatePropertyFromString(initialValue: string): DateProperty {
        let dateProperty: DateProperty = {}
        if (initialValue) {
            const singleDate = new Date(Number(initialValue))
            if (singleDate && DateUtils.isDate(singleDate)) {
                dateProperty.from = singleDate.getTime()
            } else {
                try {
                    dateProperty = JSON.parse(initialValue)
                } catch {
                    //Don't do anything, return empty dateProperty
                }
            }
        }
        return dateProperty
    }

    static applyFilterGroup(filterGroup: FilterGroup, templates: readonly IPropertyTemplate[], cards: Card[]): Card[] {
        return cards.filter((card) => this.isFilterGroupMet(filterGroup, templates, card))
    }

    static isFilterGroupMet(filterGroup: FilterGroup, templates: readonly IPropertyTemplate[], card: Card): boolean {
        const {filters} = filterGroup

        if (filterGroup.filters.length < 1) {
            return true	// No filters = always met
        }

        if (filterGroup.operation === 'or') {
            for (const filter of filters) {
                if (isAFilterGroupInstance(filter)) {
                    if (this.isFilterGroupMet(filter, templates, card)) {
                        return true
                    }
                } else if (this.isClauseMet(filter, templates, card)) {
                    return true
                }
            }
            return false
        }
        Utils.assert(filterGroup.operation === 'and')
        for (const filter of filters) {
            if (isAFilterGroupInstance(filter)) {
                if (!this.isFilterGroupMet(filter, templates, card)) {
                    return false
                }
            } else if (!this.isClauseMet(filter, templates, card)) {
                return false
            }
        }
        return true
    }

    static isClauseMet(filter: FilterClause, templates: readonly IPropertyTemplate[], card: Card): boolean {
        let value = card.fields.properties[filter.propertyId]
        if (filter.propertyId === 'title') {
            value = card.title.toLowerCase()
        }
        const template = templates.find((o) => o.id === filter.propertyId)
        let dateValue: DateProperty | undefined
        if (template?.type === 'date') {
            dateValue = this.createDatePropertyFromString(value as string)
        }
        if (!value && template) {
            if (template.type === 'createdBy') {
                value = card.createdBy
            } else if (template.type === 'updatedBy') {
                value = card.modifiedBy
            } else if (template && template.type === 'createdTime') {
                value = card.createAt.toString()
                dateValue = this.createDatePropertyFromString(value as string)
            } else if (template && template.type === 'updatedTime') {
                value = card.updateAt.toString()
                dateValue = this.createDatePropertyFromString(value as string)
            }
        }

        switch (filter.condition) {
        case 'includes': {
            if (filter.values?.length < 1) {
                break
            }		// No values = ignore clause (always met)
            return (filter.values.find((cValue) => (Array.isArray(value) ? value.includes(cValue) : cValue === value)) !== undefined)
        }
        case 'notIncludes': {
            if (filter.values?.length < 1) {
                break
            }		// No values = ignore clause (always met)
            return (filter.values.find((cValue) => (Array.isArray(value) ? value.includes(cValue) : cValue === value)) === undefined)
        }
        case 'isEmpty': {
            return (value || '').length <= 0
        }
        case 'isNotEmpty': {
            return (value || '').length > 0
        }
        case 'isSet': {
            return Boolean(value)
        }
        case 'isNotSet': {
            return !value
        }
        case 'is': {
            if (filter.values.length === 0) {
                return true
            }
            if (dateValue !== undefined) {
                const numericFilter = parseInt(filter.values[0], 10)
                if (template && (template.type === 'createdTime' || template.type === 'updatedTime')) {
                    // createdTime and updatedTime include the time
                    // So to check if create and/or updated "is" date.
                    // Need to add and subtract 12 hours and check range
                    if (dateValue.from) {
                        return dateValue.from > (numericFilter - halfDay) && dateValue.from < (numericFilter + halfDay)
                    }
                    return false
                }

                if (dateValue.from && dateValue.to) {
                    return dateValue.from <= numericFilter && dateValue.to >= numericFilter
                }
                return dateValue.from === numericFilter
            }
            return filter.values[0]?.toLowerCase() === value
        }
        case 'contains': {
            if (filter.values.length === 0) {
                return true
            }
            return (value as string || '').includes(filter.values[0]?.toLowerCase())
        }
        case 'notContains': {
            if (filter.values.length === 0) {
                return true
            }
            return !(value as string || '').includes(filter.values[0]?.toLowerCase())
        }
        case 'startsWith': {
            if (filter.values.length === 0) {
                return true
            }
            return (value as string || '').startsWith(filter.values[0]?.toLowerCase())
        }
        case 'notStartsWith': {
            if (filter.values.length === 0) {
                return true
            }
            return !(value as string || '').startsWith(filter.values[0]?.toLowerCase())
        }
        case 'endsWith': {
            if (filter.values.length === 0) {
                return true
            }
            return (value as string || '').endsWith(filter.values[0]?.toLowerCase())
        }
        case 'notEndsWith': {
            if (filter.values.length === 0) {
                return true
            }
            return !(value as string || '').endsWith(filter.values[0]?.toLowerCase())
        }
        case 'isBefore': {
            if (filter.values.length === 0) {
                return true
            }
            if (dateValue !== undefined) {
                const numericFilter = parseInt(filter.values[0], 10)
                if (template && (template.type === 'createdTime' || template.type === 'updatedTime')) {
                    // createdTime and updatedTime include the time
                    // So to check if create and/or updated "isBefore" date.
                    // Need to subtract 12 hours to filter
                    if (dateValue.from) {
                        return dateValue.from < (numericFilter - halfDay)
                    }
                    return false
                }

                return dateValue.from ? dateValue.from < numericFilter : false
            }
            return false
        }
        case 'isAfter': {
            if (filter.values.length === 0) {
                return true
            }
            if (dateValue !== undefined) {
                const numericFilter = parseInt(filter.values[0], 10)
                if (template && (template.type === 'createdTime' || template.type === 'updatedTime')) {
                    // createdTime and updatedTime include the time
                    // So to check if create and/or updated "isAfter" date.
                    // Need to add 12 hours to filter
                    if (dateValue.from) {
                        return dateValue.from > (numericFilter + halfDay)
                    }
                    return false
                }

                if (dateValue.to) {
                    return dateValue.to > numericFilter
                }
                return dateValue.from ? dateValue.from > numericFilter : false
            }
            return false
        }

        default: {
            Utils.assertFailure(`Invalid filter condition ${filter.condition}`)
        }
        }
        return true
    }

    static propertiesThatMeetFilterGroup(filterGroup: FilterGroup | undefined, templates: readonly IPropertyTemplate[]): Record<string, string> {
        // TODO: Handle filter groups
        if (!filterGroup) {
            return {}
        }

        const filters = filterGroup.filters.filter((o) => !isAFilterGroupInstance(o))
        if (filters.length < 1) {
            return {}
        }

        if (filterGroup.operation === 'or') {
            // Just need to meet the first clause
            const property = this.propertyThatMeetsFilterClause(filters[0] as FilterClause, templates)
            const result: Record<string, string> = {}
            if (property.value) {
                result[property.id] = property.value
            }
            return result
        }

        // And: Need to meet all clauses
        const result: Record<string, string> = {}
        filters.forEach((filterClause) => {
            const property = this.propertyThatMeetsFilterClause(filterClause as FilterClause, templates)
            if (property.value) {
                result[property.id] = property.value
            }
        })
        return result
    }

    static propertyThatMeetsFilterClause(filterClause: FilterClause, templates: readonly IPropertyTemplate[]): { id: string, value?: string } {
        const template = templates.find((o) => o.id === filterClause.propertyId)
        if (!template) {
            Utils.assertFailure(`propertyThatMeetsFilterClause. Cannot find template: ${filterClause.propertyId}`)
            return {id: filterClause.propertyId}
        }

        if (template.type === 'createdBy' || template.type === 'updatedBy') {
            return {id: filterClause.propertyId}
        }

        switch (filterClause.condition) {
        case 'includes': {
            if (filterClause.values.length < 1) {
                return {id: filterClause.propertyId}
            }
            return {id: filterClause.propertyId, value: filterClause.values[0]}
        }
        case 'notIncludes': {
            return {id: filterClause.propertyId}
        }
        case 'isEmpty': {
            return {id: filterClause.propertyId}
        }
        case 'isNotEmpty': {
            if (template.type === 'select') {
                if (template.options.length > 0) {
                    const option = template.options[0]
                    return {id: filterClause.propertyId, value: option.id}
                }
                return {id: filterClause.propertyId}
            }

            // TODO: Handle non-select types
            return {id: filterClause.propertyId}
        }
        default: {
            // Handle filter clause that cannot be set
            return {id: filterClause.propertyId}
        }
        }
    }
}

export {CardFilter}
