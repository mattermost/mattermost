// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'

import {CalculationOptions, CommonCalculationOptionProps, optionsByType} from 'src/components/calculations/options'
import {IPropertyTemplate, PropertyTypeEnum} from 'src/blocks/board'

import './calculationOption.scss'
import {Option, OptionProps} from './kanbanOption'

type Props = CommonCalculationOptionProps & {
    cardProperties: IPropertyTemplate[]
    onChange: (data: {calculation: string, propertyId: string}) => void
}

// contains mapping of property types which are effectly the same as other property type.
const equivalentPropertyType = new Map<PropertyTypeEnum, PropertyTypeEnum>([
    ['createdTime', 'date'],
    ['updatedTime', 'date'],
])

export function getEquivalentPropertyType(propertyType: PropertyTypeEnum): PropertyTypeEnum {
    return equivalentPropertyType.get(propertyType) || propertyType
}

export const KanbanCalculationOptions = (props: Props): JSX.Element => {
    const options: OptionProps[] = []

    // Show common options, first,
    // followed by type-specific functions
    optionsByType.get('common')!.forEach((typeOption) => {
        if (typeOption.value !== 'none') {
            options.push({
                ...typeOption,
                cardProperties: props.cardProperties,
                onChange: props.onChange,
                activeValue: props.value,
                activeProperty: props.property!,
            })
        }
    })

    const seen: Record<string, boolean> = {}
    props.cardProperties.forEach((property) => {
        // skip already processed property types
        if (seen[getEquivalentPropertyType(property.type)]) {
            return
        }

        (optionsByType.get(property.type) || [])
            .forEach((typeOption) => {
                options.push({
                    ...typeOption,
                    cardProperties: props.cardProperties,
                    onChange: props.onChange,
                    activeValue: props.value,
                    activeProperty: props.property!,
                })
            })

        seen[getEquivalentPropertyType(property.type)] = true
    })

    return (
        <CalculationOptions
            value={props.value}
            menuOpen={props.menuOpen}
            onClose={props.onClose}
            onChange={props.onChange}
            property={props.property}
            options={options}
            components={{Option}}
        />
    )
}
