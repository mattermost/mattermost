// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    PayloadAction,
    createAsyncThunk,
    createSelector,
    createSlice,
} from '@reduxjs/toolkit'

import {default as client} from 'src/octoClient'

import {Utils} from 'src/utils'

import {RootState} from './index'

export type CategoryType = 'system' | 'custom'

interface Category {
    id: string
    name: string
    userID: string
    teamID: string
    createAt: number
    updateAt: number
    deleteAt: number
    collapsed: boolean
    sortOrder: number
    type: CategoryType
    isNew: boolean
}

interface CategoryBoardMetadata {
    boardID: string
    hidden: boolean
}

interface CategoryBoards extends Category {
    boardMetadata: CategoryBoardMetadata[]
}

interface BoardCategoryWebsocketData {
    boardID: string
    categoryID: string
    hidden: boolean
}

interface CategoryBoardsReorderData {
    categoryID: string
    boardsMetadata: CategoryBoardMetadata[]
}

export const DefaultCategory: CategoryBoards = {
    id: '',
    name: 'Boards',
} as CategoryBoards

export const fetchSidebarCategories = createAsyncThunk(
    'sidebarCategories/fetch',
    async (teamID: string) => {
        return client.getSidebarCategories(teamID)
    },
)

type Sidebar = {
    categoryAttributes: CategoryBoards[]
    hiddenBoardIDs: string[]
}

const sidebarSlice = createSlice({
    name: 'sidebar',
    initialState: {categoryAttributes: [], hiddenBoardIDs: []} as Sidebar,
    reducers: {
        updateCategories: (state, action: PayloadAction<Category[]>) => {
            action.payload.forEach((updatedCategory) => {
                const index = state.categoryAttributes.findIndex((c) => c.id === updatedCategory.id)

                // when new category got created,
                if (index === -1) {
                    // new categories should always show up on the top
                    state.categoryAttributes.unshift({
                        ...updatedCategory,
                        boardMetadata: [],
                        isNew: true,
                    })
                } else if (updatedCategory.deleteAt) {
                    // when category is deleted
                    state.categoryAttributes.splice(index, 1)
                } else {
                    // else all, update the category
                    state.categoryAttributes[index] = {
                        ...state.categoryAttributes[index],
                        name: updatedCategory.name,
                        updateAt: updatedCategory.updateAt,
                        isNew: false,
                    }
                }
            })
        },
        updateBoardCategories: (state, action: PayloadAction<BoardCategoryWebsocketData[]>) => {
            const updatedCategoryAttributes: CategoryBoards[] = []
            let updatedHiddenBoardIDs = state.hiddenBoardIDs

            action.payload.forEach((boardCategory) => {
                for (let i = 0; i < state.categoryAttributes.length; i++) {
                    const categoryAttribute = state.categoryAttributes[i]

                    if (categoryAttribute.id === boardCategory.categoryID) {
                        const categoryBoardMetadataIndex = categoryAttribute.boardMetadata.findIndex((boardMetadata) => boardMetadata.boardID === boardCategory.boardID)
                        if (categoryBoardMetadataIndex >= 0) {
                            categoryAttribute.boardMetadata[categoryBoardMetadataIndex] = {
                                ...categoryAttribute.boardMetadata[categoryBoardMetadataIndex],
                                hidden: boardCategory.hidden,
                            }
                        } else {
                            categoryAttribute.boardMetadata.unshift({boardID: boardCategory.boardID, hidden: boardCategory.hidden})
                            categoryAttribute.isNew = false
                        }
                    } else {
                        // remove the board from other categories
                        categoryAttribute.boardMetadata = categoryAttribute.boardMetadata.filter((metadata) => metadata.boardID !== boardCategory.boardID)
                    }

                    updatedCategoryAttributes[i] = categoryAttribute

                    if (boardCategory.hidden) {
                        if (updatedHiddenBoardIDs.indexOf(boardCategory.boardID) < 0) {
                            updatedHiddenBoardIDs.push(boardCategory.boardID)
                        }
                    } else {
                        updatedHiddenBoardIDs = updatedHiddenBoardIDs.filter((hiddenBoardID) => hiddenBoardID !== boardCategory.boardID)
                    }
                }
            })

            if (updatedCategoryAttributes.length > 0) {
                state.categoryAttributes = updatedCategoryAttributes
            }
            state.hiddenBoardIDs = updatedHiddenBoardIDs
        },
        updateCategoryOrder: (state, action: PayloadAction<string[]>) => {
            if (action.payload.length === 0) {
                return
            }

            const categoryById = new Map<string, CategoryBoards>()
            state.categoryAttributes.forEach((categoryBoards: CategoryBoards) => categoryById.set(categoryBoards.id, categoryBoards))

            const newOrderedCategories: CategoryBoards[] = []
            action.payload.forEach((categoryId) => {
                const category = categoryById.get(categoryId)
                if (!category) {
                    Utils.logError('Category ID from updated category order not found in store. CategoryID: ' + categoryId)

                    return
                }
                newOrderedCategories.push(category)
            })

            state.categoryAttributes = newOrderedCategories
        },
        updateCategoryBoardsOrder: (state, action: PayloadAction<CategoryBoardsReorderData>) => {
            if (action.payload.boardsMetadata.length === 0) {
                return
            }

            const categoryIndex = state.categoryAttributes.findIndex((categoryBoards) => categoryBoards.id === action.payload.categoryID)
            if (categoryIndex < 0) {
                Utils.logError('Category ID from updated category boards order not found in store. CategoryID: ' + action.payload.categoryID)

                return
            }

            const category = state.categoryAttributes[categoryIndex]
            const updatedCategory: CategoryBoards = {
                ...category,
                boardMetadata: action.payload.boardsMetadata,
                isNew: false,
            }

            // creating a new reference of array so redux knows it changed
            state.categoryAttributes = state.categoryAttributes.map((original, i) => (i === categoryIndex ? updatedCategory : original))
        },
    },
    extraReducers: (builder) => {
        builder.addCase(fetchSidebarCategories.fulfilled, (state, action) => {
            state.categoryAttributes = action.payload || []
            state.hiddenBoardIDs = state.categoryAttributes.flatMap(
                (ca) => {
                    return ca.boardMetadata.reduce((collector, m) => {
                        if (m.hidden) {
                            collector.push(m.boardID)
                        }

                        return collector
                    }, [] as string[])
                },
            )
        })
    },
})

export const getSidebarCategories = createSelector(
    (state: RootState): CategoryBoards[] => state.sidebar.categoryAttributes,
    (sidebarCategories) => sidebarCategories,
)

export const getHiddenBoardIDs = (state: RootState): string[] => state.sidebar.hiddenBoardIDs

export function getCategoryOfBoard(boardID: string): (state: RootState) => CategoryBoards | undefined {
    return createSelector(
        (state: RootState): CategoryBoards[] => state.sidebar.categoryAttributes,
        (sidebarCategories) => sidebarCategories.find((category) => category.boardMetadata.findIndex((m) => m.boardID === boardID) >= 0),
    )
}

export const {reducer} = sidebarSlice

export const {updateCategories, updateBoardCategories, updateCategoryOrder, updateCategoryBoardsOrder} = sidebarSlice.actions

export {Category, CategoryBoards, BoardCategoryWebsocketData, CategoryBoardsReorderData, CategoryBoardMetadata}

