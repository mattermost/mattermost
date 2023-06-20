// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PayloadAction, createSelector, createSlice} from '@reduxjs/toolkit'

import {ContentBlock} from 'src/blocks/contentBlock'

import {getCards, getTemplates} from './cards'
import {initialReadOnlyLoad, loadBoardData} from './initialLoad'

import {RootState} from './index'

type ContentsState = {
    contents: {[key: string]: ContentBlock}
    contentsByCard: {[key: string]: ContentBlock[]}
}

const contentsSlice = createSlice({
    name: 'contents',
    initialState: {contents: {}, contentsByCard: {}} as ContentsState,
    reducers: {
        updateContents: (state, action: PayloadAction<ContentBlock[]>) => {
            for (const content of action.payload) {
                if (content.deleteAt === 0) {
                    let existsInParent = false
                    state.contents[content.id] = content
                    if (!state.contentsByCard[content.parentId]) {
                        state.contentsByCard[content.parentId] = [content]

                        return
                    }
                    for (let i = 0; i < state.contentsByCard[content.parentId].length; i++) {
                        if (state.contentsByCard[content.parentId][i].id === content.id) {
                            state.contentsByCard[content.parentId][i] = content
                            existsInParent = true
                            break
                        }
                    }
                    if (!existsInParent) {
                        state.contentsByCard[content.parentId].push(content)
                    }
                } else {
                    const parentId = state.contents[content.id]?.parentId
                    if (!state.contentsByCard[parentId]) {
                        delete state.contents[content.id]

                        return
                    }
                    for (let i = 0; i < state.contentsByCard[parentId].length; i++) {
                        if (state.contentsByCard[parentId][i].id === content.id) {
                            state.contentsByCard[parentId].splice(i, 1)
                        }
                    }
                    delete state.contents[content.id]
                }
            }
        },
    },
    extraReducers: (builder) => {
        builder.addCase(initialReadOnlyLoad.fulfilled, (state, action) => {
            state.contents = {}
            state.contentsByCard = {}
            for (const block of action.payload.blocks) {
                if (block.type !== 'board' && block.type !== 'view' && block.type !== 'comment') {
                    state.contents[block.id] = block as ContentBlock
                    state.contentsByCard[block.parentId] = state.contentsByCard[block.parentId] || []
                    state.contentsByCard[block.parentId].push(block as ContentBlock)
                    state.contentsByCard[block.parentId].sort((a, b) => a.createAt - b.createAt)
                }
            }
        })
        builder.addCase(loadBoardData.fulfilled, (state, action) => {
            state.contents = {}
            state.contentsByCard = {}
            for (const block of action.payload.blocks) {
                if (block.type !== 'board' && block.type !== 'view' && block.type !== 'comment') {
                    state.contents[block.id] = block as ContentBlock
                    state.contentsByCard[block.parentId] = state.contentsByCard[block.parentId] || []
                    state.contentsByCard[block.parentId].push(block as ContentBlock)
                    state.contentsByCard[block.parentId].sort((a, b) => a.createAt - b.createAt)
                }
            }
        })
    },
})

export const {updateContents} = contentsSlice.actions
export const {reducer} = contentsSlice

export const getContentsById = (state: RootState): {[key: string]: ContentBlock} => state.contents.contents

export const getContents = createSelector(
    getContentsById,
    (contents) => Object.values(contents),
)

export function getCardContents(cardId: string): (state: RootState) => Array<ContentBlock|ContentBlock[]> {
    return createSelector(
        (state: RootState) => (state.contents?.contentsByCard && state.contents.contentsByCard[cardId]) || [],
        (state: RootState) => getCards(state)[cardId]?.fields?.contentOrder || getTemplates(state)[cardId]?.fields?.contentOrder,
        (contents, contentOrder): Array<ContentBlock|ContentBlock[]> => {
            const result: Array<ContentBlock|ContentBlock[]> = []
            if (!contents) {
                return []
            }
            if (contentOrder) {
                for (const contentId of contentOrder) {
                    if (typeof contentId === 'string') {
                        const content = contents.find((c) => c.id === contentId)
                        if (content) {
                            result.push(content)
                        }
                    } else if (typeof contentId === 'object' && contentId) {
                        const subResult: ContentBlock[] = []
                        for (const subContentId of contentId) {
                            if (typeof subContentId === 'string') {
                                const subContent = contents.find((c) => c.id === subContentId)
                                if (subContent) {
                                    subResult.push(subContent)
                                }
                            }
                        }
                        result.push(subResult)
                    }
                }
            }

            return result
        },
    )
}

export function getLastCardContent(cardId: string): (state: RootState) => ContentBlock|undefined {
    return (state: RootState): ContentBlock|undefined => {
        const contents = state.contents?.contentsByCard && state.contents?.contentsByCard[cardId]

        return contents?.[contents?.length - 1]
    }
}
