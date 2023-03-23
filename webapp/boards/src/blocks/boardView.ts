// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Block, createBlock} from './block'
import {FilterGroup, createFilterGroup} from './filterGroup'

type IViewType = 'board' | 'table' | 'gallery' | 'calendar'
type ISortOption = { propertyId: '__title' | string, reversed: boolean }

type KanbanCalculationFields = {
    calculation: string
    propertyId: string
}

type BoardViewFields = {
    viewType: IViewType
    groupById?: string
    dateDisplayPropertyId?: string
    sortOptions: ISortOption[]
    visiblePropertyIds: string[]
    visibleOptionIds: string[]
    hiddenOptionIds: string[]
    collapsedOptionIds: string[]
    filter: FilterGroup
    cardOrder: string[]
    columnWidths: Record<string, number>
    columnCalculations: Record<string, string>
    kanbanCalculations: Record<string, KanbanCalculationFields>
    defaultTemplateId: string
}

type BoardView = Block & {
    fields: BoardViewFields
}

function createBoardView(block?: Block): BoardView {
    return {
        ...createBlock(block),
        type: 'view',
        fields: {
            viewType: block?.fields.viewType || 'board',
            groupById: block?.fields.groupById,
            dateDisplayPropertyId: block?.fields.dateDisplayPropertyId,
            sortOptions: block?.fields.sortOptions?.map((o: ISortOption) => ({...o})) || [],
            visiblePropertyIds: block?.fields.visiblePropertyIds?.slice() || [],
            visibleOptionIds: block?.fields.visibleOptionIds?.slice() || [],
            hiddenOptionIds: block?.fields.hiddenOptionIds?.slice() || [],
            collapsedOptionIds: block?.fields.collapsedOptionIds?.slice() || [],
            filter: createFilterGroup(block?.fields.filter),
            cardOrder: block?.fields.cardOrder?.slice() || [],
            columnWidths: {...(block?.fields.columnWidths || {})},
            columnCalculations: {...(block?.fields.columnCalculations) || {}},
            kanbanCalculations: {...(block?.fields.kanbanCalculations) || {}},
            defaultTemplateId: block?.fields.defaultTemplateId || '',
        },
    }
}

function sortBoardViewsAlphabetically(views: BoardView[]): BoardView[] {
    // Strip leading emoji to prevent unintuitive results
    return views.map((v) => {
        return {view: v, title: v.title.replace(/^\p{Emoji}*\s*/u, '')}
    }).sort((v1, v2) => v1.title.localeCompare(v2.title)).map((v) => v.view)
}

export {BoardView, IViewType, ISortOption, sortBoardViewsAlphabetically, createBoardView, KanbanCalculationFields}
