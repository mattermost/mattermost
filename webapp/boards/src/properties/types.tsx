// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {IntlShape} from 'react-intl'

import {Card} from 'src/blocks/card'
import {Board, IPropertyTemplate, PropertyTypeEnum as BoardPropertyTypeEnum} from 'src/blocks/board'
import {Options} from 'src/components/calculations/options'
import {Utils} from 'src/utils'

const hashSignToken = '___hash_sign___'
function encodeText(text: string): string {
    return text.replace(/"/g, '""').replace(/#/g, hashSignToken)
}

export type PropertyTypeEnum = BoardPropertyTypeEnum

export type FilterValueType = 'none'|'options'|'boolean'|'text'|'date'|'person'

export type FilterCondition = {
    id: string
    label: string
}

export type PropertyProps = {
    property: PropertyType
    card: Card
    board: Board
    readOnly: boolean
    propertyValue: string | string[]
    propertyTemplate: IPropertyTemplate
    showEmptyPlaceholder: boolean
}

export abstract class PropertyType {
    canGroup = false
    canFilter = false
    filterValueType: FilterValueType = 'none'
    isReadOnly = false
    calculationOptions = [Options.none, Options.count, Options.countEmpty,
        Options.countNotEmpty, Options.percentEmpty, Options.percentNotEmpty,
        Options.countValue, Options.countUniqueValue]
    displayValue: (value: string | string[] | undefined, card: Card, template: IPropertyTemplate, intl: IntlShape) => string | string[] | undefined
    valueLength: (value: string | string[] | undefined, card: Card, template: IPropertyTemplate, intl: IntlShape, fontDescriptor: string, perItemPadding?: number) => number

    constructor() {
        this.displayValue = (value: string | string[] | undefined) => value
        this.valueLength = (value: string | string[] | undefined, card: Card, template: IPropertyTemplate, intl: IntlShape, fontDescriptor: string): number => {
            const displayValue = this.displayValue(value, card, template, intl) || ''
            return Utils.getTextWidth(displayValue.toString(), fontDescriptor)
        }
    }

    exportValue = (value: string | string[] | undefined, card: Card, template: IPropertyTemplate, intl: IntlShape): string => {
        const displayValue = this.displayValue(value, card, template, intl)
        if (typeof displayValue === 'string') {
            return `"${encodeText(displayValue)}"`
        } else if (Array.isArray(displayValue)) {
            return `"${encodeText((displayValue as string[]).join('|'))}"`
        }
        return ''
    }

    valueClassName = (readonly: boolean): string => {
        return `octo-propertyvalue${readonly ? ' octo-propertyvalue--readonly' : ''}`
    }

    abstract Editor: React.FunctionComponent<PropertyProps>
    abstract name: string
    abstract type: PropertyTypeEnum
    abstract displayName: (intl: IntlShape) => string
}

export abstract class DatePropertyType extends PropertyType {
    canFilter = true
    filterValueType: FilterValueType = 'date'
    getDateFrom: (value: string | string[] | undefined, card: Card) => Date | undefined
    getDateTo: (value: string | string[] | undefined, card: Card) => Date | undefined

    constructor() {
        super()
        this.getDateFrom = () => undefined
        this.getDateTo = () => undefined
    }
}
