// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {IntlShape} from 'react-intl'

import {Options} from 'src/components/calculations/options'
import {IPropertyTemplate} from 'src/blocks/board'
import {Card} from 'src/blocks/card'
import {Utils} from 'src/utils'

import {DatePropertyType, PropertyTypeEnum} from 'src/properties/types'

import CreatedTime from './createdTime'

export default class CreatedAtProperty extends DatePropertyType {
    Editor = CreatedTime
    name = 'Created At'
    type = 'createdTime' as PropertyTypeEnum
    isReadOnly = true
    displayName = (intl: IntlShape) => intl.formatMessage({id: 'PropertyType.CreatedTime', defaultMessage: 'Created time'})
    calculationOptions = [Options.none, Options.count, Options.countEmpty,
        Options.countNotEmpty, Options.percentEmpty, Options.percentNotEmpty,
        Options.countValue, Options.countUniqueValue, Options.earliest,
        Options.latest, Options.dateRange]
    displayValue = (_1: string | string[] | undefined, card: Card, _2: IPropertyTemplate, intl: IntlShape) => Utils.displayDateTime(new Date(card.createAt), intl)
    getDateFrom = (_: string | string[] | undefined, card: Card) => new Date(card.createAt || 0)
    getDateTo = (_: string | string[] | undefined, card: Card) => new Date(card.createAt || 0)
}
