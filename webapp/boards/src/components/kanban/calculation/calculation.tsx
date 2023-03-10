// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {useIntl} from 'react-intl'

import {Card} from 'src/blocks/card'
import Button from 'src/widgets/buttons/button'
import './calculation.scss'
import {IPropertyTemplate} from 'src/blocks/board'

import Calculations from 'src/components/calculations/calculations'

import {KanbanCalculationOptions} from './calculationOptions'

type Props = {
    cards: Card[]
    cardProperties: IPropertyTemplate[]
    menuOpen: boolean
    onMenuClose: () => void
    onMenuOpen: () => void
    onChange: (data: { calculation: string, propertyId: string }) => void
    value: string
    property: IPropertyTemplate
    readonly: boolean
}

function KanbanCalculation(props: Props): JSX.Element {
    const intl = useIntl()

    return (
        <div className='KanbanCalculation'>
            <Button
                onClick={() => (props.menuOpen ? props.onMenuClose : props.onMenuOpen)()}
                onBlur={props.onMenuClose}
                title={Calculations[props.value] ? Calculations[props.value](props.cards, props.property, intl) : ''}
            >
                {Calculations[props.value] ? Calculations[props.value](props.cards, props.property, intl) : ''}
            </Button>

            {
                !props.readonly && props.menuOpen && (
                    <KanbanCalculationOptions
                        value={props.value}
                        property={props.property}
                        menuOpen={props.menuOpen}
                        onChange={(data: { calculation: string, propertyId: string }) => {
                            props.onChange(data)
                            props.onMenuClose()
                        }}
                        cardProperties={props.cardProperties}
                    />
                )
            }
        </div>
    )
}

export {
    KanbanCalculation,
}
