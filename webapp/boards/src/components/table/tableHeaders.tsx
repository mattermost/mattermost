// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useCallback, useMemo} from 'react'

import {FormattedMessage, useIntl} from 'react-intl'

import {Board, IPropertyTemplate} from 'src/blocks/board'
import {BoardView, ISortOption, createBoardView} from 'src/blocks/boardView'
import {Card} from 'src/blocks/card'
import {Constants} from 'src/constants'
import mutator from 'src/mutator'
import {Utils} from 'src/utils'
import propsRegistry from 'src/properties'

import './table.scss'

import TableHeader from './tableHeader'
import {useColumnResize} from './tableColumnResizeContext'

type Props = {
    board: Board
    cards: Card[]
    activeView: BoardView
    views: BoardView[]
    readonly: boolean
}

const TableHeaders = (props: Props): JSX.Element => {
    const {board, cards, activeView, views} = props
    const intl = useIntl()
    const columnResize = useColumnResize()

    const onAutoSizeColumn = useCallback((columnID: string, headerWidth: number) => {
        let longestSize = headerWidth
        const visibleProperties = board.cardProperties.filter(() => activeView.fields.visiblePropertyIds.includes(columnID)) || []
        const columnRef = columnResize.cellRef(columnID)
        if (!columnRef) {
            return
        }

        let template: IPropertyTemplate | undefined
        const columnFontPadding = Utils.getFontAndPaddingFromCell(columnRef)
        let perItemPadding = 0
        if (columnID !== Constants.titleColumnId) {
            template = visibleProperties.find((t: IPropertyTemplate) => t.id === columnID)
            if (!template) {
                return
            }
            if (template.type === 'multiSelect') {
                // For multiselect, the padding calculated above depends on the number selected when calculating the padding.
                // Need to calculate it manually here.
                // DOM Object hierarchy should be {cell -> property -> [value1, value2, etc]}
                let valueCount = 0
                if (columnRef.childElementCount > 0) {
                    const propertyElement = columnRef.children.item(0) as Element
                    if (propertyElement) {
                        valueCount = propertyElement.childElementCount
                        if (valueCount > 0) {
                            const statusPadding = Utils.getFontAndPaddingFromChildren(propertyElement.children, 0)
                            perItemPadding = statusPadding.padding / valueCount
                        }
                    }
                }

                // remove the "value" portion of the original calculation
                columnFontPadding.padding -= (perItemPadding * valueCount)
            }
        }

        cards.forEach((card) => {
            let thisLen = 0
            if (columnID === Constants.titleColumnId) {
                thisLen = Utils.getTextWidth(card.title, columnFontPadding.fontDescriptor) + columnFontPadding.padding
            } else if (template) {
                const property = propsRegistry.get(template.type)
                property.valueLength(card.fields.properties[columnID], card, template as IPropertyTemplate, intl, columnFontPadding.fontDescriptor, perItemPadding)
                thisLen += columnFontPadding.padding
            }
            if (thisLen > longestSize) {
                longestSize = thisLen
            }
        })

        const columnWidths = {...activeView.fields.columnWidths}
        columnWidths[columnID] = longestSize
        const newView = createBoardView(activeView)
        newView.fields.columnWidths = columnWidths
        mutator.updateBlock(board.id, newView, activeView, 'autosize column')
    }, [activeView, board, cards])

    const visiblePropertyTemplates = useMemo(() => (
        activeView.fields.visiblePropertyIds.map((id) => board.cardProperties.find((t) => t.id === id)).filter((i) => i) as IPropertyTemplate[]
    ), [board.cardProperties, activeView.fields.visiblePropertyIds])

    const onDropToColumn = useCallback(async (template: IPropertyTemplate, container: IPropertyTemplate) => {
        Utils.log(`ondrop. Source column: ${template.name}, dest column: ${container.name}`)

        // Move template to new index
        const destIndex = container ? activeView.fields.visiblePropertyIds.indexOf(container.id) : 0
        await mutator.changeViewVisiblePropertiesOrder(board.id, activeView, template, destIndex >= 0 ? destIndex : 0)
    }, [board.id, activeView.fields.visiblePropertyIds])

    const titleSortOption = activeView.fields.sortOptions?.find((o) => o.propertyId === Constants.titleColumnId)
    let titleSorted: 'up' | 'down' | 'none' = 'none'
    if (titleSortOption) {
        titleSorted = titleSortOption.reversed ? 'down' : 'up'
    }

    return (
        <div
            className='octo-table-header TableHeaders'
            id='mainBoardHeader'
        >
            <TableHeader
                name={
                    <FormattedMessage
                        id='TableComponent.name'
                        defaultMessage='Name'
                    />
                }
                sorted={titleSorted}
                readonly={props.readonly}
                board={board}
                activeView={activeView}
                cards={cards}
                views={views}
                template={{id: Constants.titleColumnId, name: 'title', type: 'text', options: []}}
                onDrop={onDropToColumn}
                onAutoSizeColumn={onAutoSizeColumn}
            />

            {/* Table header row */}
            {visiblePropertyTemplates.map((template) => {
                let sorted: 'up' | 'down' | 'none' = 'none'
                const sortOption = activeView.fields.sortOptions.find((o: ISortOption) => o.propertyId === template.id)
                if (sortOption) {
                    sorted = sortOption.reversed ? 'down' : 'up'
                }

                return (
                    <TableHeader
                        name={template.name}
                        sorted={sorted}
                        readonly={props.readonly}
                        board={board}
                        activeView={activeView}
                        cards={cards}
                        views={views}
                        template={template}
                        key={template.id}
                        onDrop={onDropToColumn}
                        onAutoSizeColumn={onAutoSizeColumn}
                    />
                )
            })}
        </div>
    )
}

export default TableHeaders
