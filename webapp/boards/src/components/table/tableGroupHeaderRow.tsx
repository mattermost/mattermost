// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
/* eslint-disable max-lines */
import React, {useState, useEffect} from 'react'
import {FormattedMessage, useIntl} from 'react-intl'

import {Constants} from 'src/constants'
import {
    IPropertyOption,
    Board,
    IPropertyTemplate,
    BoardGroup
} from 'src/blocks/board'
import {BoardView} from 'src/blocks/boardView'
import {useSortable} from 'src/hooks/sortable'
import mutator from 'src/mutator'
import Button from 'src/widgets/buttons/button'
import IconButton from 'src/widgets/buttons/iconButton'
import AddIcon from 'src/widgets/icons/add'
import DeleteIcon from 'src/widgets/icons/delete'
import CompassIcon from 'src/widgets/icons/compassIcon'
import HideIcon from 'src/widgets/icons/hide'
import OptionsIcon from 'src/widgets/icons/options'
import Menu from 'src/widgets/menu'
import MenuWrapper from 'src/widgets/menuWrapper'
import Editable from 'src/widgets/editable'
import Label from 'src/widgets/label'

import {useColumnResize} from './tableColumnResizeContext'

type Props = {
    board: Board
    activeView: BoardView
    group: BoardGroup
    groupByProperty?: IPropertyTemplate
    readonly: boolean
    hideGroup: (groupByOptionId: string) => void
    addCard: (groupByOptionId?: string) => Promise<void>
    propertyNameChanged: (option: IPropertyOption, text: string) => Promise<void>
    onDrop: (srcOption: IPropertyOption, dstOption?: IPropertyOption) => void
}

const TableGroupHeaderRow = (props: Props): JSX.Element => {
    const {board, activeView, group, groupByProperty} = props
    const [groupTitle, setGroupTitle] = useState(group.option.value)

    const [isDragging, isOver, groupHeaderRef] = useSortable('groupHeader', group.option, !props.readonly, props.onDrop)
    const intl = useIntl()
    const columnResize = useColumnResize()

    useEffect(() => {
        setGroupTitle(group.option.value)
    }, [group.option.value])
    let className = 'octo-group-header-cell'
    if (isOver) {
        className += ' dragover'
    }
    if (activeView.fields.collapsedOptionIds.indexOf(group.option.id || 'undefined') < 0) {
        className += ' expanded'
    }

    const canEditOption = groupByProperty?.type !== 'person' && group.option.id

    return (
        <div
            key={group.option.id + 'header'}
            ref={groupHeaderRef}
            style={{opacity: isDragging ? 0.5 : 1}}
            className={className}
        >
            <div
                className='octo-table-cell'
                style={{width: columnResize.width(Constants.titleColumnId)}}
                ref={(ref) => columnResize.updateRef(group.option.id, Constants.titleColumnId, ref)}
            >
                <IconButton
                    icon={
                        <CompassIcon
                            icon='menu-right'
                        />}
                    onClick={() => (props.readonly ? {} : props.hideGroup(group.option.id || 'undefined'))}
                    className={`octo-table-cell__expand ${props.readonly ? 'readonly' : ''}`}
                />

                {!group.option.id &&
                    <Label
                        title={intl.formatMessage({
                            id: 'BoardComponent.no-property-title',
                            defaultMessage: 'Items with an empty {property} property will go here. This column cannot be removed.',
                        }, {property: groupByProperty?.name})}
                    >
                        <FormattedMessage
                            id='BoardComponent.no-property'
                            defaultMessage='No {property}'
                            values={{
                                property: groupByProperty?.name,
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
                            readonly={props.readonly || !group.option.id}
                            spellCheck={true}
                        />
                    </Label>}
            </div>
            <Button>{`${group.cards.length}`}</Button>
            {!props.readonly &&
                <>
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
                    <IconButton
                        icon={<AddIcon/>}
                        onClick={() => props.addCard(group.option.id)}
                    />
                </>
            }
        </div>
    )
}

export default React.memo(TableGroupHeaderRow)
