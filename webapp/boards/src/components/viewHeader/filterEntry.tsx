// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {FormattedMessage, useIntl} from 'react-intl'

import {FilterClause, areEqual as areFilterClausesEqual} from 'src/blocks/filterClause'
import {createFilterGroup, isAFilterGroupInstance} from 'src/blocks/filterGroup'
import mutator from 'src/mutator'
import {OctoUtils} from 'src/octoUtils'
import {Utils} from 'src/utils'
import {Board, IPropertyTemplate} from 'src/blocks/board'
import {BoardView} from 'src/blocks/boardView'
import Button from 'src/widgets/buttons/button'
import Menu from 'src/widgets/menu'
import MenuWrapper from 'src/widgets/menuWrapper'
import propsRegistry from 'src/properties'

import FilterValue from './filterValue'

import './filterEntry.scss'

type Props = {
    board: Board
    view: BoardView
    conditionClicked: (optionId: string, filter: FilterClause) => void
    filter: FilterClause
}

const FilterEntry = (props: Props): JSX.Element => {
    const {board, view, filter} = props
    const intl = useIntl()

    const template = board.cardProperties.find((o: IPropertyTemplate) => o.id === filter.propertyId)
    let propertyType = propsRegistry.get(template?.type || 'unknown')
    let propertyName = template ? template.name : '(unknown)'
    if (filter.propertyId === 'title') {
        propertyType = propsRegistry.get('text')
        propertyName = 'Title'
    }
    const key = `${filter.propertyId}-${filter.condition}}`
    return (
        <div
            className='FilterEntry'
            key={key}
        >
            <MenuWrapper>
                <Button>{propertyName}</Button>
                <Menu>
                    <Menu.Text
                        key={'title'}
                        id={'title'}
                        name={'Title'}
                        onClick={(optionId: string) => {
                            const filterIndex = view.fields.filter.filters.indexOf(filter)
                            Utils.assert(filterIndex >= 0, "Can't find filter")
                            const filterGroup = createFilterGroup(view.fields.filter)
                            const newFilter = filterGroup.filters[filterIndex] as FilterClause
                            Utils.assert(newFilter, `No filter at index ${filterIndex}`)
                            if (newFilter.propertyId !== optionId) {
                                newFilter.propertyId = optionId
                                newFilter.values = []
                                mutator.changeViewFilter(props.board.id, view.id, view.fields.filter, filterGroup)
                            }
                        }}
                    />
                    {board.cardProperties.filter((o: IPropertyTemplate) => propsRegistry.get(o.type).canFilter).map((o: IPropertyTemplate) => (
                        <Menu.Text
                            key={o.id}
                            id={o.id}
                            name={o.name}
                            onClick={(optionId: string) => {
                                const filterIndex = view.fields.filter.filters.indexOf(filter)
                                Utils.assert(filterIndex >= 0, "Can't find filter")
                                const filterGroup = createFilterGroup(view.fields.filter)
                                const newFilter = filterGroup.filters[filterIndex] as FilterClause
                                Utils.assert(newFilter, `No filter at index ${filterIndex}`)
                                if (newFilter.propertyId !== optionId) {
                                    newFilter.propertyId = optionId
                                    newFilter.condition = OctoUtils.filterConditionValidOrDefault(propsRegistry.get(o.type).filterValueType, newFilter.condition)
                                    newFilter.values = []
                                    mutator.changeViewFilter(props.board.id, view.id, view.fields.filter, filterGroup)
                                }
                            }}
                        />))}
                </Menu>
            </MenuWrapper>
            <MenuWrapper>
                <Button>{OctoUtils.filterConditionDisplayString(filter.condition, intl, propertyType.filterValueType)}</Button>
                <Menu>
                    {propertyType.filterValueType === 'options' &&
                        <>
                            <Menu.Text
                                id='includes'
                                name={intl.formatMessage({id: 'Filter.includes', defaultMessage: 'includes'})}
                                onClick={(id) => props.conditionClicked(id, filter)}
                            />
                            <Menu.Text
                                id='notIncludes'
                                name={intl.formatMessage({id: 'Filter.not-includes', defaultMessage: 'doesn\'t include'})}
                                onClick={(id) => props.conditionClicked(id, filter)}
                            />
                            <Menu.Text
                                id='isEmpty'
                                name={intl.formatMessage({id: 'Filter.is-empty', defaultMessage: 'is empty'})}
                                onClick={(id) => props.conditionClicked(id, filter)}
                            />
                            <Menu.Text
                                id='isNotEmpty'
                                name={intl.formatMessage({id: 'Filter.is-not-empty', defaultMessage: 'is not empty'})}
                                onClick={(id) => props.conditionClicked(id, filter)}
                            />
                        </>}
                    {propertyType.filterValueType === 'person' &&
                        <>
                            <Menu.Text
                                id='includes'
                                name={intl.formatMessage({id: 'Filter.includes', defaultMessage: 'includes'})}
                                onClick={(id) => props.conditionClicked(id, filter)}
                            />
                            <Menu.Text
                                id='notIncludes'
                                name={intl.formatMessage({id: 'Filter.not-includes', defaultMessage: 'doesn\'t include'})}
                                onClick={(id) => props.conditionClicked(id, filter)}
                            />
                        </>}
                    {(propertyType.type === 'person' || propertyType.type === 'multiPerson') &&
                        <>
                            <Menu.Text
                                id='isEmpty'
                                name={intl.formatMessage({id: 'Filter.is-empty', defaultMessage: 'is empty'})}
                                onClick={(id) => props.conditionClicked(id, filter)}
                            />
                            <Menu.Text
                                id='isNotEmpty'
                                name={intl.formatMessage({id: 'Filter.is-not-empty', defaultMessage: 'is not empty'})}
                                onClick={(id) => props.conditionClicked(id, filter)}
                            />
                        </>}
                    {propertyType.filterValueType === 'boolean' &&
                        <>
                            <Menu.Text
                                id='isSet'
                                name={intl.formatMessage({id: 'Filter.is-set', defaultMessage: 'is set'})}
                                onClick={(id) => props.conditionClicked(id, filter)}
                            />
                            <Menu.Text
                                id='isNotSet'
                                name={intl.formatMessage({id: 'Filter.is-not-set', defaultMessage: 'is not set'})}
                                onClick={(id) => props.conditionClicked(id, filter)}
                            />
                        </>}
                    {propertyType.filterValueType === 'text' &&
                        <>
                            <Menu.Text
                                id='is'
                                name={intl.formatMessage({id: 'Filter.is', defaultMessage: 'is'})}
                                onClick={(id) => props.conditionClicked(id, filter)}
                            />
                            <Menu.Text
                                id='contains'
                                name={intl.formatMessage({id: 'Filter.contains', defaultMessage: 'contains'})}
                                onClick={(id) => props.conditionClicked(id, filter)}
                            />
                            <Menu.Text
                                id='notContains'
                                name={intl.formatMessage({id: 'Filter.not-contains', defaultMessage: 'doesn\'t contain'})}
                                onClick={(id) => props.conditionClicked(id, filter)}
                            />
                            <Menu.Text
                                id='startsWith'
                                name={intl.formatMessage({id: 'Filter.starts-with', defaultMessage: 'starts with'})}
                                onClick={(id) => props.conditionClicked(id, filter)}
                            />
                            <Menu.Text
                                id='notStartsWith'
                                name={intl.formatMessage({id: 'Filter.not-starts-with', defaultMessage: 'doesn\'t start with'})}
                                onClick={(id) => props.conditionClicked(id, filter)}
                            />
                            <Menu.Text
                                id='endsWith'
                                name={intl.formatMessage({id: 'Filter.ends-with', defaultMessage: 'ends with'})}
                                onClick={(id) => props.conditionClicked(id, filter)}
                            />
                            <Menu.Text
                                id='notEndsWith'
                                name={intl.formatMessage({id: 'Filter.not-ends-with', defaultMessage: 'doesn\'t end with'})}
                                onClick={(id) => props.conditionClicked(id, filter)}
                            />
                        </>}
                    {propertyType.filterValueType === 'date' &&
                        <>
                            <Menu.Text
                                id='is'
                                name={intl.formatMessage({id: 'Filter.is', defaultMessage: 'is'})}
                                onClick={(id) => props.conditionClicked(id, filter)}
                            />
                            <Menu.Text
                                id='isBefore'
                                name={intl.formatMessage({id: 'Filter.isbefore', defaultMessage: 'is before'})}
                                onClick={(id) => props.conditionClicked(id, filter)}
                            />
                            <Menu.Text
                                id='isAfter'
                                name={intl.formatMessage({id: 'Filter.isafter', defaultMessage: 'is after'})}
                                onClick={(id) => props.conditionClicked(id, filter)}
                            />
                        </>}
                    {propertyType.type === 'date' &&
                        <>
                            <Menu.Text
                                id='isSet'
                                name={intl.formatMessage({id: 'Filter.is-set', defaultMessage: 'is set'})}
                                onClick={(id) => props.conditionClicked(id, filter)}
                            />
                            <Menu.Text
                                id='isNotSet'
                                name={intl.formatMessage({id: 'Filter.is-not-set', defaultMessage: 'is not set'})}
                                onClick={(id) => props.conditionClicked(id, filter)}
                            />
                        </>}
                </Menu>
            </MenuWrapper>
            <FilterValue
                filter={filter}
                template={template}
                view={view}
                propertyType={propertyType}
            />
            <div className='octo-spacer'/>
            <Button
                onClick={() => {
                    const filterGroup = createFilterGroup(view.fields.filter)
                    filterGroup.filters = filterGroup.filters.filter((o) => isAFilterGroupInstance(o) || !areFilterClausesEqual(o, filter))
                    mutator.changeViewFilter(props.board.id, view.id, view.fields.filter, filterGroup)
                }}
            >
                <FormattedMessage
                    id='FilterComponent.delete'
                    defaultMessage='Delete'
                />
            </Button>
        </div>
    )
}

export default React.memo(FilterEntry)
