// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {IntlShape} from 'react-intl'

import {FilterValueType, PropertyType, PropertyTypeEnum} from 'src/properties/types'

import Url from './url'

export default class UrlProperty extends PropertyType {
    Editor = Url
    name = 'Url'
    type = 'url' as PropertyTypeEnum
    displayName = (intl: IntlShape) => intl.formatMessage({id: 'PropertyType.Url', defaultMessage: 'URL'})
    canFilter = true
    filterValueType = 'text' as FilterValueType
}
