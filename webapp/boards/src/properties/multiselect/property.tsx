// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {IntlShape} from 'react-intl'

import {IPropertyTemplate} from 'src/blocks/board'
import {Card} from 'src/blocks/card'
import {Utils} from 'src/utils'

import {FilterValueType, PropertyType, PropertyTypeEnum} from 'src/properties/types'

import MultiSelect from './multiselect'

export default class MultiSelectProperty extends PropertyType {
    Editor = MultiSelect
    name = 'MultiSelect'
    type = 'multiSelect' as PropertyTypeEnum
    canFilter = true
    filterValueType = 'options' as FilterValueType
    displayName = (intl: IntlShape) => intl.formatMessage({id: 'PropertyType.MultiSelect', defaultMessage: 'Multi select'})
    displayValue = (propertyValue: string | string[] | undefined, card: Card, propertyTemplate: IPropertyTemplate) => {
        if (propertyValue?.length) {
            const options = propertyTemplate.options.filter((o) => propertyValue.includes(o.id))
            if (!options.length) {
                Utils.assertFailure(`Invalid multiSelect option IDs ${propertyValue}, block.title: ${card.title}`)
            }

            return options.map((o) => o.value)
        }

        return ''
    }

    exportValue = (value: string | string[] | undefined, card: Card, template: IPropertyTemplate): string => {
        const displayValue = this.displayValue(value, card, template)

        return ((displayValue as unknown || []) as string[]).join('|')
    }

    valueLength = (value: string | string[] | undefined, card: Card, template: IPropertyTemplate, _: IntlShape, fontDescriptor: string, perItemPadding?: number): number => {
        const displayValue = this.displayValue(value, card, template)
        if (!displayValue) {
            return 0
        }
        const displayValues = displayValue as string[]
        let result = 0
        displayValues.forEach((v) => {
            result += Utils.getTextWidth(v.toUpperCase(), fontDescriptor) + (perItemPadding || 0)
        })

        return result
    }
}
