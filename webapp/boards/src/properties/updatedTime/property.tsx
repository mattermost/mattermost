// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {IntlShape} from 'react-intl'

import {Options} from 'src/components/calculations/options'
import {IPropertyTemplate} from 'src/blocks/board'
import {Card} from 'src/blocks/card'
import {Utils} from 'src/utils'
import {DatePropertyType, PropertyTypeEnum} from 'src/properties/types'

import UpdatedTime from './updatedTime'

export default class UpdatedTimeProperty extends DatePropertyType {
    Editor = UpdatedTime
    name = 'Last Modified At'
    type = 'updatedTime' as PropertyTypeEnum
    isReadOnly = true
    displayName = (intl: IntlShape) => intl.formatMessage({id: 'PropertyType.UpdatedTime', defaultMessage: 'Last updated time'})
    calculationOptions = [Options.none, Options.count, Options.countEmpty,
        Options.countNotEmpty, Options.percentEmpty, Options.percentNotEmpty,
        Options.countValue, Options.countUniqueValue, Options.earliest,
        Options.latest, Options.dateRange]
    displayValue = (_1: string | string[] | undefined, card: Card, _2: IPropertyTemplate, intl: IntlShape) => Utils.displayDateTime(new Date(card.updateAt), intl)
    getDateFrom = (_: string | string[] | undefined, card: Card) => new Date(card.updateAt || 0)
    getDateTo = (_: string | string[] | undefined, card: Card) => new Date(card.updateAt || 0)
}
