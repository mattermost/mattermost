// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {IntlShape} from 'react-intl'

import {PropertyType, PropertyTypeEnum, FilterValueType} from 'src/properties/types'

import MultiPerson from './multiperson'

export default class MultiPersonProperty extends PropertyType {
    Editor = MultiPerson
    name = 'MultiPerson'
    type = 'multiPerson' as PropertyTypeEnum
    displayName = (intl: IntlShape) => intl.formatMessage({id: 'PropertyType.MultiPerson', defaultMessage: 'Multi person'})
    canFilter = true
    filterValueType = 'person' as FilterValueType
}
