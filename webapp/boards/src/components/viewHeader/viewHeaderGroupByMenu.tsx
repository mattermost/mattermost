// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {FormattedMessage, useIntl} from 'react-intl'

import {BoardGroup, IPropertyTemplate} from 'src/blocks/board'
import {BoardView} from 'src/blocks/boardView'
import mutator from 'src/mutator'
import Button from 'src/widgets/buttons/button'
import Menu from 'src/widgets/menu'
import MenuWrapper from 'src/widgets/menuWrapper'
import CheckIcon from 'src/widgets/icons/check'
import HideIcon from 'src/widgets/icons/hide'
import ShowIcon from 'src/widgets/icons/show'
import {useAppSelector} from 'src/store/hooks'
import {getCurrentViewCardsSortedFilteredAndGrouped} from 'src/store/cards'
import {getVisibleAndHiddenGroups} from 'src/boardUtils'
import propsRegistry from 'src/properties'

type Props = {
    properties: readonly IPropertyTemplate[]
    activeView: BoardView
    groupByProperty?: IPropertyTemplate
}

const ViewHeaderGroupByMenu = (props: Props) => {
    const {properties, activeView, groupByProperty} = props
    const intl = useIntl()

    const cards = useAppSelector(getCurrentViewCardsSortedFilteredAndGrouped)
    const {visible: visibleGroups, hidden: hiddenGroups} = getVisibleAndHiddenGroups(cards, activeView.fields.visibleOptionIds, activeView.fields.hiddenOptionIds, groupByProperty)

    const emptyVisibleGroups = visibleGroups.filter((g) => !g.cards.length)
    const emptyVisibleGroupsCount = emptyVisibleGroups.length
    const hiddenGroupsCount = hiddenGroups.length

    const handleToggleGroups = (show: boolean) => {
        const getColumnIds = (groups: BoardGroup[]) => groups.map((g) => g.option.id)

        if (show) {
            const columnsToShow = getColumnIds(hiddenGroups)
            mutator.unhideViewColumns(activeView.boardId, activeView, columnsToShow)
        } else {
            const columnsToHide = getColumnIds(emptyVisibleGroups)
            mutator.hideViewColumns(activeView.boardId, activeView, columnsToHide)
        }
    }

    return (
        <MenuWrapper>
            <Button>
                <FormattedMessage
                    id='ViewHeader.group-by'
                    defaultMessage='Group by: {property}'
                    values={{
                        property: (
                            <span
                                style={{color: 'rgb(var(--center-channel-color-rgb))'}}
                                id='groupByLabel'
                            >
                                {groupByProperty?.name}
                            </span>
                        ),
                    }}
                />
            </Button>
            <Menu>
                {activeView.fields.viewType === 'table' && activeView.fields.groupById &&
                    <>
                        {emptyVisibleGroupsCount > 0 &&
                            <Menu.Text
                                key={'hideEmptyGroups'}
                                id={'hideEmptyGroups'}
                                name={intl.formatMessage({id: 'GroupBy.hideEmptyGroups', defaultMessage: 'Hide {count} empty groups'}, {count: emptyVisibleGroupsCount})}
                                rightIcon={<HideIcon/>}
                                onClick={() => handleToggleGroups(false)}
                            />}
                        {hiddenGroupsCount > 0 &&
                            <Menu.Text
                                key={'showHiddenGroups'}
                                id={'showHiddenGroups'}
                                name={intl.formatMessage({id: 'GroupBy.showHiddenGroups', defaultMessage: 'Show {count} hidden groups'}, {count: hiddenGroupsCount})}
                                rightIcon={<ShowIcon/>}
                                onClick={() => handleToggleGroups(true)}
                            />}
                        <Menu.Text
                            key={'ungroup'}
                            id={''}
                            name={intl.formatMessage({id: 'GroupBy.ungroup', defaultMessage: 'Ungroup'})}
                            rightIcon={activeView.fields.groupById === '' ? <CheckIcon/> : undefined}
                            onClick={(id) => {
                                if (activeView.fields.groupById === id) {
                                    return
                                }
                                mutator.changeViewGroupById(activeView.boardId, activeView.id, activeView.fields.groupById, id)
                            }}
                        />
                        <Menu.Separator/>
                    </>}
                {properties?.filter((o: IPropertyTemplate) => propsRegistry.get(o.type).canGroup).map((option: IPropertyTemplate) => (
                    <Menu.Text
                        key={option.id}
                        id={option.id}
                        name={option.name}
                        rightIcon={groupByProperty?.id === option.id ? <CheckIcon/> : undefined}
                        onClick={(id) => {
                            if (activeView.fields.groupById === id) {
                                return
                            }

                            mutator.changeViewGroupById(activeView.boardId, activeView.id, activeView.fields.groupById, id)
                        }}
                    />
                ))}
            </Menu>
        </MenuWrapper>
    )
}

export default React.memo(ViewHeaderGroupByMenu)
