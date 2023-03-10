// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {IntlShape} from 'react-intl'

import {PropertyType, PropertyTypeEnum, FilterValueType} from 'src/properties/types'

import Text from './text'

export default class TextProperty extends PropertyType {
    Editor = Text
    name = 'Text'
    type = 'text' as PropertyTypeEnum
    displayName = (intl: IntlShape) => intl.formatMessage({id: 'PropertyType.Text', defaultMessage: 'Text'})
    canFilter = true
    filterValueType = 'text' as FilterValueType
}
