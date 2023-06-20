// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'

import {Board, IPropertyTemplate} from 'src/blocks/board'
import {Constants} from 'src/constants'
import {Card} from 'src/blocks/card'
import {BoardView} from 'src/blocks/boardView'
import SortDownIcon from 'src/widgets/icons/sortDown'
import SortUpIcon from 'src/widgets/icons/sortUp'
import MenuWrapper from 'src/widgets/menuWrapper'
import Label from 'src/widgets/label'
import {useSortable} from 'src/hooks/sortable'
import {Utils} from 'src/utils'

import HorizontalGrip from './horizontalGrip'

import './table.scss'
import TableHeaderMenu from './tableHeaderMenu'
import {useColumnResize} from './tableColumnResizeContext'

type Props = {
    readonly: boolean
    sorted: 'up'|'down'|'none'
    name: React.ReactNode
    board: Board
    activeView: BoardView
    cards: Card[]
    views: BoardView[]
    template: IPropertyTemplate
    onDrop: (template: IPropertyTemplate, container: IPropertyTemplate) => void
    onAutoSizeColumn: (columnID: string, headerWidth: number) => void
}

const TableHeader = (props: Props): JSX.Element => {
    const [isDragging, isOver, columnRef] = useSortable('column', props.template, !props.readonly, props.onDrop)

    const columnResize = useColumnResize()

    const onAutoSizeColumn = (templateId: string) => {
        let width = Constants.minColumnWidth
        if (columnRef.current) {
            const {fontDescriptor, padding} = Utils.getFontAndPaddingFromCell(columnRef.current)
            const textWidth = Utils.getTextWidth(columnRef.current.innerText.toUpperCase(), fontDescriptor)
            width = textWidth + padding
        }
        props.onAutoSizeColumn(templateId, width)
    }

    let className = 'octo-table-cell header-cell'
    if (isOver) {
        className += ' dragover'
    }

    const templateId = props.template.id

    return (
        <div
            className={className}
            style={{
                overflow: 'unset',
                opacity: isDragging ? 0.5 : 1,
                width: columnResize.width(templateId),
            }}
            ref={(ref) => {
                if (ref && templateId !== Constants.titleColumnId) {
                    (columnRef as React.MutableRefObject<HTMLDivElement>).current = ref
                }
                columnResize.updateRef(Constants.tableHeaderId, templateId, ref)
            }}
        >
            <MenuWrapper disabled={props.readonly}>
                <Label>
                    {props.name}
                    {props.sorted === 'up' && <SortUpIcon/>}
                    {props.sorted === 'down' && <SortDownIcon/>}
                </Label>
                <TableHeaderMenu
                    board={props.board}
                    activeView={props.activeView}
                    views={props.views}
                    cards={props.cards}
                    templateId={templateId}
                />
            </MenuWrapper>

            <div className='octo-spacer'/>

            {!props.readonly &&
                <HorizontalGrip
                    templateId={templateId}
                    columnWidth={props.activeView.fields.columnWidths[templateId] || 0}
                    onAutoSizeColumn={onAutoSizeColumn}
                />
            }
        </div>
    )
}

export default React.memo(TableHeader)
