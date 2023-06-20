// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {useIntl} from 'react-intl'

import {MultiValue} from 'react-select'

import {Utils} from 'src/utils'
import mutator from 'src/mutator'
import {BoardView} from 'src/blocks/boardView'

import {FilterClause} from 'src/blocks/filterClause'
import {createFilterGroup} from 'src/blocks/filterGroup'

import PersonSelector from 'src/components/personSelector'
import {IUser} from 'src/user'

import './multiperson.scss'

type Props = {
    view: BoardView
    filter: FilterClause
}

const MultiPersonFilterValue = (props: Props): JSX.Element => {
    const {filter, view} = props
    const intl = useIntl()
    const emptyDisplayValue = intl.formatMessage({id: 'ConfirmPerson.search', defaultMessage: 'Search...'})

    return (
        <PersonSelector
            userIDs={filter.values}
            allowAddUsers={false}
            isMulti={true}
            readOnly={false}
            emptyDisplayValue={emptyDisplayValue}
            showMe={true}
            closeMenuOnSelect={false}
            onChange={(items: MultiValue<IUser>, action) => {
                const filterIndex = view.fields.filter.filters.indexOf(filter)
                Utils.assert(filterIndex >= 0, "Can't find filter")

                const filterGroup = createFilterGroup(view.fields.filter)
                const newFilter = filterGroup.filters[filterIndex] as FilterClause
                Utils.assert(newFilter, `No filter at index ${filterIndex}`)

                if (action.action === 'select-option') {
                    newFilter.values = items.map((a) => a.id)
                } else if (action.action === 'clear') {
                    newFilter.values = []
                } else if (action.action === 'remove-value') {
                    newFilter.values = items.filter((a) => a.id !== action.removedValue.id).map((b) => b.id) || []
                }
                mutator.changeViewFilter(view.boardId, view.id, view.fields.filter, filterGroup)
            }}
        />
    )
}

export default MultiPersonFilterValue
