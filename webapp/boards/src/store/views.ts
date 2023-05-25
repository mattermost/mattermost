// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PayloadAction, createSelector, createSlice} from '@reduxjs/toolkit'
import isEqual from 'lodash/isEqual'

import {BoardView, createBoardView} from 'src/blocks/boardView'
import {Utils} from 'src/utils'

import {initialReadOnlyLoad, loadBoardData} from './initialLoad'
import {getCurrentBoard} from './boards'

import {RootState} from './index'

type ViewsState = {
    current: string
    views: {[key: string]: BoardView}
}

// This update ensure that we are not regenerating that fields all the time
const smartViewUpdate = (oldView: BoardView, newView: BoardView) => {
    if (!oldView) {
        return newView
    }

    if (isEqual(newView.fields.sortOptions, oldView.fields.sortOptions)) {
        newView.fields.sortOptions = oldView.fields.sortOptions
    }
    if (isEqual(newView.fields.visiblePropertyIds, oldView.fields.visiblePropertyIds)) {
        newView.fields.visiblePropertyIds = oldView.fields.visiblePropertyIds
    }
    if (isEqual(newView.fields.visibleOptionIds, oldView.fields.visibleOptionIds)) {
        newView.fields.visibleOptionIds = oldView.fields.visibleOptionIds
    }
    if (isEqual(newView.fields.hiddenOptionIds, oldView.fields.hiddenOptionIds)) {
        newView.fields.hiddenOptionIds = oldView.fields.hiddenOptionIds
    }
    if (isEqual(newView.fields.collapsedOptionIds, oldView.fields.collapsedOptionIds)) {
        newView.fields.collapsedOptionIds = oldView.fields.collapsedOptionIds
    }
    if (isEqual(newView.fields.filter, oldView.fields.filter)) {
        newView.fields.filter = oldView.fields.filter
    }
    if (isEqual(newView.fields.cardOrder, oldView.fields.cardOrder)) {
        newView.fields.cardOrder = oldView.fields.cardOrder
    }
    if (isEqual(newView.fields.columnWidths, oldView.fields.columnWidths)) {
        newView.fields.columnWidths = oldView.fields.columnWidths
    }
    if (isEqual(newView.fields.columnCalculations, oldView.fields.columnCalculations)) {
        newView.fields.columnCalculations = oldView.fields.columnCalculations
    }
    if (isEqual(newView.fields.kanbanCalculations, oldView.fields.kanbanCalculations)) {
        newView.fields.kanbanCalculations = oldView.fields.kanbanCalculations
    }

    return newView
}

const viewsSlice = createSlice({
    name: 'views',
    initialState: {views: {}, current: ''} as ViewsState,
    reducers: {
        setCurrent: (state, action: PayloadAction<string>) => {
            state.current = action.payload
        },
        updateViews: (state, action: PayloadAction<BoardView[]>) => {
            for (const view of action.payload) {
                if (view.deleteAt === 0) {
                    state.views[view.id] = smartViewUpdate(state.views[view.id], view)
                } else {
                    delete state.views[view.id]
                }
            }
        },
        updateView: (state, action: PayloadAction<BoardView>) => {
            state.views[action.payload.id] = action.payload
        },
    },
    extraReducers: (builder) => {
        builder.addCase(initialReadOnlyLoad.fulfilled, (state, action) => {
            state.views = {}
            for (const block of action.payload.blocks) {
                if (block.type === 'view') {
                    state.views[block.id] = block as BoardView
                }
            }
        })
        builder.addCase(loadBoardData.fulfilled, (state, action) => {
            state.views = {}
            for (const block of action.payload.blocks) {
                if (block.type === 'view') {
                    state.views[block.id] = block as BoardView
                }
            }
        })
    },
})

export const {updateViews, setCurrent, updateView} = viewsSlice.actions
export const {reducer} = viewsSlice

export const getViews = (state: RootState): {[key: string]: BoardView} => state.views.views
export const getSortedViews = createSelector(
    getViews,
    (views) => {
        return Object.values(views).sort((a, b) => a.title.localeCompare(b.title)).map((v) => createBoardView(v))
    },
)

export const getViewsByBoard = createSelector(
    getViews,
    (views) => {
        const result: {[key: string]: BoardView[]} = {}
        Object.values(views).forEach((view) => {
            if (result[view.parentId]) {
                result[view.parentId].push(view)
            } else {
                result[view.parentId] = [view]
            }
        })

        return result
    },
)

export function getView(viewId: string): (state: RootState) => BoardView|null {
    return (state: RootState): BoardView|null => {
        return state.views.views[viewId] || null
    }
}

export const getCurrentBoardViews = createSelector(
    (state: RootState) => state.boards.current,
    getViews,
    (boardId, views) => {
        Utils.log(`getCurrentBoardViews boardId: ${boardId} views: ${views.length}`)

        return Object.values(views).filter((v) => v.boardId === boardId).sort((a, b) => a.title.localeCompare(b.title)).map((v) => createBoardView(v))
    },
)

export const getCurrentViewId = (state: RootState): string => state.views.current

export const getCurrentView = createSelector(
    getViews,
    getCurrentViewId,
    (views, viewId) => views[viewId],
)

export const getCurrentViewGroupBy = createSelector(
    getCurrentBoard,
    getCurrentView,
    (currentBoard, currentView) => {
        if (!currentBoard) {
            return undefined
        }
        if (!currentView) {
            return undefined
        }

        return currentBoard.cardProperties.find((o) => o.id === currentView.fields.groupById)
    },
)

export const getCurrentViewDisplayBy = createSelector(
    getCurrentBoard,
    getCurrentView,
    (currentBoard, currentView) => {
        if (!currentBoard) {
            return undefined
        }
        if (!currentView) {
            return undefined
        }

        return currentBoard.cardProperties.find((o) => o.id === currentView.fields.dateDisplayPropertyId)
    },
)
