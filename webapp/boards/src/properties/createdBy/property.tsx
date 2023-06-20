// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {IntlShape} from 'react-intl'

import {FilterValueType, PropertyType, PropertyTypeEnum} from 'src/properties/types'

import CreatedBy from './createdBy'

export default class CreatedByProperty extends PropertyType {
    Editor = CreatedBy
    name = 'Created By'
    type = 'createdBy' as PropertyTypeEnum
    isReadOnly = true
    displayName = (intl: IntlShape) => intl.formatMessage({id: 'PropertyType.CreatedBy', defaultMessage: 'Created by'})
    canFilter = true
    filterValueType = 'person' as FilterValueType
    canGroup = true
}
