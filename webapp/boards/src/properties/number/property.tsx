// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {IntlShape} from 'react-intl'

import {Options} from 'src/components/calculations/options'
import {PropertyType, PropertyTypeEnum} from 'src/properties/types'

import NumberProp from './number'

export default class NumberProperty extends PropertyType {
    Editor = NumberProp
    name = 'Number'
    type = 'number' as PropertyTypeEnum
    displayName = (intl: IntlShape) => intl.formatMessage({id: 'PropertyType.Number', defaultMessage: 'Number'})
    calculationOptions = [Options.none, Options.count, Options.countEmpty,
        Options.countNotEmpty, Options.percentEmpty, Options.percentNotEmpty,
        Options.countValue, Options.countUniqueValue, Options.sum,
        Options.average, Options.median, Options.min, Options.max,
        Options.range]

    exportValue = (value: string | string[] | undefined): string => (value ? Number(value).toString() : '')
}
