// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useState} from 'react'

import {useIntl} from 'react-intl'

import {PropertyType} from 'src/properties/types'
import {IPropertyTemplate} from 'src/blocks/board'
import {FilterClause} from 'src/blocks/filterClause'
import {createFilterGroup} from 'src/blocks/filterGroup'
import {BoardView} from 'src/blocks/boardView'
import mutator from 'src/mutator'
import {Utils} from 'src/utils'
import Button from 'src/widgets/buttons/button'
import Menu from 'src/widgets/menu'
import Editable from 'src/widgets/editable'
import MenuWrapper from 'src/widgets/menuWrapper'

import DateFilter from './dateFilter'

import './filterValue.scss'
import MultiPersonFilterValue from './multipersonFilterValue'

type Props = {
    view: BoardView
    filter: FilterClause
    template?: IPropertyTemplate
    propertyType: PropertyType
}

const filterValue = (props: Props): JSX.Element|null => {
    const {filter, template, view, propertyType} = props
    const [value, setValue] = useState(filter.values.length > 0 ? filter.values[0] : '')
    const intl = useIntl()

    if (propertyType.filterValueType === 'none') {
        return null
    }

    if (propertyType.filterValueType === 'boolean') {
        return null
    }

    if ((propertyType.filterValueType === 'options' || propertyType.filterValueType === 'person') && filter.condition !== 'includes' && filter.condition !== 'notIncludes') {
        return null
    }

    if (propertyType.filterValueType === 'text') {
        return (
            <Editable
                onChange={setValue}
                value={value}
                placeholderText={intl.formatMessage({id: 'FilterByText.placeholder', defaultMessage: 'filter text'})}
                onSave={() => {
                    const filterIndex = view.fields.filter.filters.indexOf(filter)
                    Utils.assert(filterIndex >= 0, "Can't find filter")

                    const filterGroup = createFilterGroup(view.fields.filter)
                    const newFilter = filterGroup.filters[filterIndex] as FilterClause
                    Utils.assert(newFilter, `No filter at index ${filterIndex}`)

                    newFilter.values = [value]
                    mutator.changeViewFilter(view.boardId, view.id, view.fields.filter, filterGroup)
                }}
            />
        )
    }

    if (propertyType.filterValueType === 'person') {
        return (
            <MultiPersonFilterValue
                view={view}
                filter={filter}
            />
        )
    }
    if (propertyType.filterValueType === 'date') {
        if (filter.condition === 'isSet' || filter.condition === 'isNotSet') {
            return null
        }

        return (
            <DateFilter
                view={view}
                filter={filter}
            />
        )
    }

    let displayValue: string
    if (filter.values.length > 0) {
        displayValue = filter.values.map((id) => {
            const option = template?.options.find((o) => o.id === id)
            return option?.value || '(Unknown)'
        }).join(', ')
    } else {
        displayValue = intl.formatMessage({id: 'FilterValue.empty', defaultMessage: '(empty)'})
    }

    return (
        <MenuWrapper className='filterValue'>
            <Button>{displayValue}</Button>

            <Menu>
                {template?.options.map((o) => (
                    <Menu.Switch
                        key={o.id}
                        id={o.id}
                        name={o.value}
                        isOn={filter.values.includes(o.id)}
                        suppressItemClicked={true}
                        onClick={(optionId) => {
                            const filterIndex = view.fields.filter.filters.indexOf(filter)
                            Utils.assert(filterIndex >= 0, "Can't find filter")

                            const filterGroup = createFilterGroup(view.fields.filter)
                            const newFilter = filterGroup.filters[filterIndex] as FilterClause
                            Utils.assert(newFilter, `No filter at index ${filterIndex}`)
                            if (filter.values.includes(o.id)) {
                                newFilter.values = newFilter.values.filter((id) => id !== optionId)
                                mutator.changeViewFilter(view.boardId, view.id, view.fields.filter, filterGroup)
                            } else {
                                newFilter.values.push(optionId)
                                mutator.changeViewFilter(view.boardId, view.id, view.fields.filter, filterGroup)
                            }
                        }}
                    />
                ))}
            </Menu>
        </MenuWrapper>
    )
}

export default filterValue
