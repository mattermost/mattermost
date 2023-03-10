// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {IntlShape} from 'react-intl'

import {IPropertyTemplate} from 'src/blocks/board'
import {Card} from 'src/blocks/card'
import {Utils} from 'src/utils'
import {PropertyType, PropertyTypeEnum, FilterValueType} from 'src/properties/types'

import Select from './select'

export default class SelectProperty extends PropertyType {
    Editor = Select
    name = 'Select'
    type = 'select' as PropertyTypeEnum
    canGroup = true
    canFilter = true
    filterValueType = 'options' as FilterValueType

    displayName = (intl: IntlShape) => intl.formatMessage({id: 'PropertyType.Select', defaultMessage: 'Select'})

    displayValue = (propertyValue: string | string[] | undefined, card: Card, propertyTemplate: IPropertyTemplate) => {
        if (propertyValue) {
            const option = propertyTemplate.options.find((o) => o.id === propertyValue)
            if (!option) {
                Utils.assertFailure(`Invalid select option ID ${propertyValue}, block.title: ${card.title}`)
            }
            return option?.value || '(Unknown)'
        }
        return ''
    }

    valueLength = (value: string | string[] | undefined, card: Card, template: IPropertyTemplate, _: IntlShape, fontDescriptor: string): number => {
        const displayValue = this.displayValue(value, card, template) || ''
        return Utils.getTextWidth(displayValue.toString().toUpperCase(), fontDescriptor)
    }
}
