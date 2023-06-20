// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {IntlShape} from 'react-intl'

import {FilterValueType, PropertyType, PropertyTypeEnum} from 'src/properties/types'

import Phone from './phone'

export default class PhoneProperty extends PropertyType {
    Editor = Phone
    name = 'Phone'
    type = 'phone' as PropertyTypeEnum
    displayName = (intl: IntlShape) => intl.formatMessage({id: 'PropertyType.Phone', defaultMessage: 'Phone'})
    canFilter = true
    filterValueType = 'text' as FilterValueType
}
