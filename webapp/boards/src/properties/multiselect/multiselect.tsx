// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback} from 'react'
import {useIntl} from 'react-intl'

import {IPropertyOption} from 'src/blocks/board'
import {Utils, IDType} from 'src/utils'

import mutator from 'src/mutator'

import Label from 'src/widgets/label'
import ValueSelector from 'src/widgets/valueSelector'

import {PropertyProps} from 'src/properties/types'

const MultiSelectProperty = (props: PropertyProps): JSX.Element => {
    const {propertyTemplate, propertyValue, board, card} = props
    const isEditable = !props.readOnly && Boolean(board)
    const [open, setOpen] = useState(false)
    const intl = useIntl()

    const emptyDisplayValue = props.showEmptyPlaceholder ? intl.formatMessage({id: 'PropertyValueElement.empty', defaultMessage: 'Empty'}) : ''

    const onChange = useCallback((newValue) => mutator.changePropertyValue(board.id, card, propertyTemplate.id, newValue), [board.id, card, propertyTemplate])
    const onChangeColor = useCallback((option: IPropertyOption, colorId: string) => mutator.changePropertyOptionColor(board.id, board.cardProperties, propertyTemplate, option, colorId), [board, propertyTemplate])
    const onDeleteOption = useCallback((option: IPropertyOption) => mutator.deletePropertyOption(board.id, board.cardProperties, propertyTemplate, option), [board, propertyTemplate])

    const onDeleteValue = useCallback((valueToDelete: IPropertyOption, currentValues: IPropertyOption[]) => {
        const newValues = currentValues.
            filter((currentValue) => currentValue.id !== valueToDelete.id).
            map((currentValue) => currentValue.id)
        mutator.changePropertyValue(board.id, card, propertyTemplate.id, newValues)
    }, [board.id, card, propertyTemplate.id])

    const onCreateValue = useCallback((newValue: string, currentValues: IPropertyOption[]) => {
        const option: IPropertyOption = {
            id: Utils.createGuid(IDType.BlockID),
            value: newValue,
            color: 'propColorDefault',
        }
        currentValues.push(option)
        mutator.insertPropertyOption(board.id, board.cardProperties, propertyTemplate, option, 'add property option').then(() => {
            mutator.changePropertyValue(board.id, card, propertyTemplate.id, currentValues.map((v: IPropertyOption) => v.id))
        })
    }, [board, board.id, card, propertyTemplate])

    const values = Array.isArray(propertyValue) && propertyValue.length > 0 ? propertyValue.map((v) => propertyTemplate.options.find((o) => o!.id === v)).filter((v): v is IPropertyOption => Boolean(v)) : []

    if (!isEditable || !open) {
        return (
            <div
                className={props.property.valueClassName(!isEditable)}
                tabIndex={0}
                data-testid='multiselect-non-editable'
                onClick={() => setOpen(true)}
            >
                {values.map((v) => (
                    <Label
                        key={v.id}
                        color={v.color}
                    >
                        {v.value}
                    </Label>
                ))}
                {values.length === 0 && (
                    <Label
                        color='empty'
                    >{emptyDisplayValue}</Label>
                )}
            </div>
        )
    }

    return (
        <ValueSelector
            isMulti={true}
            emptyValue={emptyDisplayValue}
            options={propertyTemplate.options}
            value={values}
            onChange={onChange}
            onChangeColor={onChangeColor}
            onDeleteOption={onDeleteOption}
            onDeleteValue={(valueToRemove) => onDeleteValue(valueToRemove, values)}
            onCreate={(newValue) => onCreateValue(newValue, values)}
            onBlur={() => setOpen(false)}
        />
    )
}

export default MultiSelectProperty
