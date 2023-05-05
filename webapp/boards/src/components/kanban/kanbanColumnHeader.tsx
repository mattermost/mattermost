// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef, useState} from 'react'
import {FormattedMessage, useIntl} from 'react-intl'
import {useDrag, useDrop} from 'react-dnd'

import {Constants, Permission} from 'src/constants'
import {
    Board,
    BoardGroup,
    IPropertyOption,
    IPropertyTemplate,
} from 'src/blocks/board'
import {BoardView} from 'src/blocks/boardView'
import {Card} from 'src/blocks/card'
import mutator from 'src/mutator'
import IconButton from 'src/widgets/buttons/iconButton'
import AddIcon from 'src/widgets/icons/add'
import DeleteIcon from 'src/widgets/icons/delete'
import HideIcon from 'src/widgets/icons/hide'
import OptionsIcon from 'src/widgets/icons/options'
import Menu from 'src/widgets/menu'
import MenuWrapper from 'src/widgets/menuWrapper'
import Editable from 'src/widgets/editable'
import Label from 'src/widgets/label'
import {useHasCurrentBoardPermissions} from 'src/hooks/permissions'

import BoardPermissionGate from 'src/components/permissions/boardPermissionGate'

import {KanbanCalculation} from './calculation/calculation'

type Props = {
    board: Board
    activeView: BoardView
    group: BoardGroup
    groupByProperty?: IPropertyTemplate
    readonly: boolean
    addCard: (groupByOptionId?: string, show?: boolean) => Promise<void>
    propertyNameChanged: (option: IPropertyOption, text: string) => Promise<void>
    onDropToColumn: (srcOption: IPropertyOption, card?: Card, dstOption?: IPropertyOption) => void
    calculationMenuOpen: boolean
    onCalculationMenuOpen: () => void
    onCalculationMenuClose: () => void
}

const defaultCalculation = 'count'
const defaultProperty: IPropertyTemplate = {
    id: Constants.titleColumnId,
} as IPropertyTemplate

export default function KanbanColumnHeader(props: Props): JSX.Element {
    const intl = useIntl()
    const {board, activeView, group, groupByProperty} = props
    let readonly = props.readonly
    if (!readonly) {
        readonly = !useHasCurrentBoardPermissions([Permission.ManageBoardProperties])
    }

    const [groupTitle, setGroupTitle] = useState(group.option.value)
    const canEditOption = groupByProperty?.type !== 'person' && group.option.id

    const headerRef = useRef<HTMLDivElement>(null)

    const [{isDragging}, drag] = useDrag(() => ({
        type: 'column',
        item: group.option,
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    }))
    const [{isOver}, drop] = useDrop(() => ({
        accept: 'column',
        collect: (monitor) => ({
            isOver: monitor.isOver(),
        }),
        drop: (item: IPropertyOption) => {
            props.onDropToColumn(item, undefined, group.option)
        },
    }), [props.onDropToColumn])

    useEffect(() => {
        setGroupTitle(group.option.value)
    }, [group.option.value])

    if (!readonly) {
        drop(drag(headerRef))
    }

    let className = 'octo-board-header-cell KanbanColumnHeader'
    if (isOver) {
        className += ' dragover'
    }

    const groupCalculation = props.activeView.fields.kanbanCalculations[props.group.option.id]
    const calculationValue = groupCalculation ? groupCalculation.calculation : defaultCalculation
    const calculationProperty = groupCalculation ? props.board.cardProperties.find((property) => property.id === groupCalculation.propertyId) || defaultProperty : defaultProperty

    return (
        <div
            key={group.option.id || 'empty'}
            ref={headerRef}
            style={{opacity: isDragging ? 0.5 : 1}}
            className={className}
            draggable={!readonly}
        >
            {!group.option.id &&
                <Label
                    title={intl.formatMessage({
                        id: 'BoardComponent.no-property-title',
                        defaultMessage: "Items with an empty {property} property will go here. This column can't be removed.",
                    }, {property: groupByProperty!.name})}
                >
                    <FormattedMessage
                        id='BoardComponent.no-property'
                        defaultMessage='No {property}'
                        values={{
                            property: groupByProperty!.name,
                        }}
                    />
                </Label>}
            {groupByProperty?.type === 'person' &&
                <Label>
                    {groupTitle}
                </Label>}
            {canEditOption &&
                <Label color={group.option.color}>
                    <Editable
                        value={groupTitle}
                        placeholderText='New Select'
                        onChange={setGroupTitle}
                        onSave={() => {
                            if (groupTitle.trim() === '') {
                                setGroupTitle(group.option.value)
                            }
                            props.propertyNameChanged(group.option, groupTitle)
                        }}
                        onCancel={() => {
                            setGroupTitle(group.option.value)
                        }}
                        readonly={readonly}
                        spellCheck={true}
                    />
                </Label>}
            <KanbanCalculation
                cards={group.cards}
                menuOpen={props.calculationMenuOpen}
                value={calculationValue}
                property={calculationProperty}
                onMenuClose={props.onCalculationMenuClose}
                onMenuOpen={props.onCalculationMenuOpen}
                cardProperties={board.cardProperties}
                readonly={readonly}
                onChange={(data: {calculation: string, propertyId: string}) => {
                    if (data.calculation === calculationValue && data.propertyId === calculationProperty.id) {
                        return
                    }

                    const newCalculations = {
                        ...props.activeView.fields.kanbanCalculations,
                    }
                    newCalculations[props.group.option.id] = {
                        calculation: data.calculation,
                        propertyId: data.propertyId,
                    }

                    mutator.changeViewKanbanCalculations(board.id, props.activeView.id, props.activeView.fields.kanbanCalculations, newCalculations)
                }}
            />
            <div className='octo-spacer'/>
            {!props.readonly &&
                <>
                    <BoardPermissionGate permissions={[Permission.ManageBoardProperties]}>
                        <MenuWrapper>
                            <IconButton icon={<OptionsIcon/>}/>
                            <Menu>
                                <Menu.Text
                                    id='hide'
                                    icon={<HideIcon/>}
                                    name={intl.formatMessage({id: 'BoardComponent.hide', defaultMessage: 'Hide'})}
                                    onClick={() => mutator.hideViewColumn(board.id, activeView, group.option.id || '')}
                                />
                                {canEditOption &&
                                    <>
                                        <Menu.Text
                                            id='delete'
                                            icon={<DeleteIcon/>}
                                            name={intl.formatMessage({id: 'BoardComponent.delete', defaultMessage: 'Delete'})}
                                            onClick={() => mutator.deletePropertyOption(board.id, board.cardProperties, groupByProperty!, group.option)}
                                        />
                                        <Menu.Separator/>
                                        {Object.entries(Constants.menuColors).map(([key, color]) => (
                                            <Menu.Color
                                                key={key}
                                                id={key}
                                                name={color}
                                                onClick={() => mutator.changePropertyOptionColor(board.id, board.cardProperties, groupByProperty!, group.option, key)}
                                            />
                                        ))}
                                    </>}
                            </Menu>
                        </MenuWrapper>
                    </BoardPermissionGate>
                    <BoardPermissionGate permissions={[Permission.ManageBoardCards]}>
                        <IconButton
                            icon={<AddIcon/>}
                            onClick={() => {
                                props.addCard(group.option.id, true)
                            }}
                        />
                    </BoardPermissionGate>
                </>
            }
        </div>
    )
}
