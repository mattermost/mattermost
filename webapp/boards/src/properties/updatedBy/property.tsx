// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {IntlShape} from 'react-intl'

import {FilterValueType, PropertyType, PropertyTypeEnum} from 'src/properties/types'

import UpdatedBy from './updatedBy'

export default class UpdatedByProperty extends PropertyType {
    Editor = UpdatedBy
    name = 'Last Modified By'
    type = 'updatedBy' as PropertyTypeEnum
    isReadOnly = true
    displayName = (intl: IntlShape) => intl.formatMessage({id: 'PropertyType.UpdatedBy', defaultMessage: 'Last updated by'})
    canFilter = true
    filterValueType = 'person' as FilterValueType
    canGroup = true
}
