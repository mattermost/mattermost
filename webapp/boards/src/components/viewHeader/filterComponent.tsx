// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {FormattedMessage} from 'react-intl'

import {FilterClause, FilterCondition, createFilterClause} from 'src/blocks/filterClause'
import {createFilterGroup, isAFilterGroupInstance} from 'src/blocks/filterGroup'
import {Board, IPropertyTemplate} from 'src/blocks/board'
import {BoardView} from 'src/blocks/boardView'
import mutator from 'src/mutator'
import {Utils} from 'src/utils'
import Button from 'src/widgets/buttons/button'
import propsRegistry from 'src/properties'

import Modal from 'src/components/modal'

import FilterEntry from './filterEntry'

import './filterComponent.scss'

type Props = {
    board: Board
    activeView: BoardView
    onClose: () => void
}

const FilterComponent = (props: Props): JSX.Element => {
    const conditionClicked = (optionId: string, filter: FilterClause): void => {
        const {activeView} = props

        const filterIndex = activeView.fields.filter.filters.indexOf(filter)
        Utils.assert(filterIndex >= 0, "Can't find filter")

        const filterGroup = createFilterGroup(activeView.fields.filter)
        const newFilter = filterGroup.filters[filterIndex] as FilterClause

        Utils.assert(newFilter, `No filter at index ${filterIndex}`)
        if (newFilter.condition !== optionId) {
            newFilter.condition = optionId as FilterCondition
            mutator.changeViewFilter(board.id, activeView.id, activeView.fields.filter, filterGroup)
        }
    }

    const addFilterClicked = () => {
        const {board, activeView} = props

        const filters = activeView.fields.filter?.filters.filter((o) => !isAFilterGroupInstance(o)) as FilterClause[] || []
        const filterGroup = createFilterGroup(activeView.fields.filter)
        const filter = createFilterClause()

        // Pick the first filterable property that isn't already filtered on
        const selectProperty = board.cardProperties
            .filter((o: IPropertyTemplate) => !filters.find((f) => f.propertyId === o.id))
            .find((o: IPropertyTemplate) => propsRegistry.get(o.type).canFilter)
        if (selectProperty) {
            filter.propertyId = selectProperty.id
        }
        filterGroup.filters.push(filter)

        mutator.changeViewFilter(board.id, activeView.id, activeView.fields.filter, filterGroup)
    }

    const {board, activeView} = props

    const filters: FilterClause[] = activeView.fields.filter?.filters.filter((o) => !isAFilterGroupInstance(o)) as FilterClause[] || []

    return (
        <Modal
            onClose={props.onClose}
        >
            <div
                className='FilterComponent'
            >
                {filters.map((filter) => (
                    <FilterEntry
                        key={`${filter.propertyId}-${filter.condition}`}
                        board={board}
                        view={activeView}
                        conditionClicked={conditionClicked}
                        filter={filter}
                    />
                ))}

                <br/>

                <Button onClick={() => addFilterClicked()}>
                    <FormattedMessage
                        id='FilterComponent.add-filter'
                        defaultMessage='+ Add filter'
                    />
                </Button>
            </div>
        </Modal>
    )
}

export default React.memo(FilterComponent)
