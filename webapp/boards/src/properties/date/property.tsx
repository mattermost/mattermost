// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {IntlShape} from 'react-intl'
import {DateUtils} from 'react-day-picker'

import {Options} from 'src/components/calculations/options'
import {IPropertyTemplate} from 'src/blocks/board'
import {Card} from 'src/blocks/card'
import {Utils} from 'src/utils'

import {PropertyTypeEnum, DatePropertyType} from 'src/properties/types'

import DateComponent, {createDatePropertyFromString} from './date'

const timeZoneOffset = (date: number): number => {
    return new Date(date).getTimezoneOffset() * 60 * 1000
}

export default class DateProperty extends DatePropertyType {
    Editor = DateComponent
    name = 'Date'
    type = 'date' as PropertyTypeEnum
    displayName = (intl: IntlShape) => intl.formatMessage({id: 'PropertyType.Date', defaultMessage: 'Date'})
    calculationOptions = [Options.none, Options.count, Options.countEmpty,
        Options.countNotEmpty, Options.percentEmpty, Options.percentNotEmpty,
        Options.countValue, Options.countUniqueValue]
    displayValue = (propertyValue: string | string[] | undefined, _1: Card, _2: IPropertyTemplate, intl: IntlShape) => {
        let displayValue = ''
        if (propertyValue && typeof propertyValue === 'string') {
            const singleDate = new Date(parseInt(propertyValue, 10))
            if (singleDate && DateUtils.isDate(singleDate)) {
                displayValue = Utils.displayDate(new Date(parseInt(propertyValue, 10)), intl)
            } else {
                try {
                    const dateValue = JSON.parse(propertyValue as string)
                    if (dateValue.from) {
                        displayValue = Utils.displayDate(new Date(dateValue.from), intl)
                    }
                    if (dateValue.to) {
                        displayValue += ' -> '
                        displayValue += Utils.displayDate(new Date(dateValue.to), intl)
                    }
                } catch {
                    // do nothing
                }
            }
        }
        return displayValue
    }

    getDateFrom = (value: string | string[] | undefined) => {
        const dateProperty = createDatePropertyFromString(value as string)
        if (!dateProperty.from) {
            return undefined
        }

        // date properties are stored as 12 pm UTC, convert to 12 am (00) UTC for calendar
        const dateFrom = dateProperty.from ? new Date(dateProperty.from + (dateProperty.includeTime ? 0 : timeZoneOffset(dateProperty.from))) : new Date()
        dateFrom.setHours(0, 0, 0, 0)
        return dateFrom
    }

    getDateTo = (value: string | string[] | undefined) => {
        const dateProperty = createDatePropertyFromString(value as string)
        if (!dateProperty.to) {
            return undefined
        }
        const dateToNumber = dateProperty.to + (dateProperty.includeTime ? 0 : timeZoneOffset(dateProperty.to))
        const dateTo = new Date(dateToNumber)
        dateTo.setHours(0, 0, 0, 0)
        return dateTo
    }
}
