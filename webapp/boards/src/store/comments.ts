// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSlice, PayloadAction, createSelector} from '@reduxjs/toolkit'

import {CommentBlock} from 'src/blocks/commentBlock'

import {loadBoardData, initialReadOnlyLoad} from './initialLoad'

import {RootState} from './index'

type CommentsState = {
    comments: {[key: string]: CommentBlock}
    commentsByCard: {[key: string]: CommentBlock[]}
}

const commentsSlice = createSlice({
    name: 'comments',
    initialState: {comments: {}, commentsByCard: {}} as CommentsState,
    reducers: {
        updateComments: (state, action: PayloadAction<CommentBlock[]>) => {
            for (const comment of action.payload) {
                if (comment.deleteAt === 0) {
                    state.comments[comment.id] = comment
                    if (!state.commentsByCard[comment.parentId]) {
                        state.commentsByCard[comment.parentId] = [comment]
                        return
                    }
                    for (let i = 0; i < state.commentsByCard[comment.parentId].length; i++) {
                        if (state.commentsByCard[comment.parentId][i].id === comment.id) {
                            state.commentsByCard[comment.parentId][i] = comment
                            return
                        }
                    }
                    state.commentsByCard[comment.parentId].push(comment)
                } else {
                    const parentId = state.comments[comment.id]?.parentId
                    if (!state.commentsByCard[parentId]) {
                        delete state.comments[comment.id]
                        return
                    }
                    for (let i = 0; i < state.commentsByCard[parentId].length; i++) {
                        if (state.commentsByCard[parentId][i].id === comment.id) {
                            state.commentsByCard[parentId].splice(i, 1)
                        }
                    }
                    delete state.comments[comment.id]
                }
            }
        },
    },
    extraReducers: (builder) => {
        builder.addCase(initialReadOnlyLoad.fulfilled, (state, action) => {
            state.comments = {}
            state.commentsByCard = {}
            for (const block of action.payload.blocks) {
                if (block.type === 'comment') {
                    state.comments[block.id] = block as CommentBlock
                    state.commentsByCard[block.parentId] = state.commentsByCard[block.parentId] || []
                    state.commentsByCard[block.parentId].push(block as CommentBlock)
                }
            }
            Object.values(state.commentsByCard).forEach((comment) => comment.sort((a, b) => a.createAt - b.createAt))
        })
        builder.addCase(loadBoardData.fulfilled, (state, action) => {
            state.comments = {}
            state.commentsByCard = {}
            for (const block of action.payload.blocks) {
                if (block.type === 'comment') {
                    state.comments[block.id] = block as CommentBlock
                    state.commentsByCard[block.parentId] = state.commentsByCard[block.parentId] || []
                    state.commentsByCard[block.parentId].push(block as CommentBlock)
                }
            }
            Object.values(state.commentsByCard).forEach((comment) => comment.sort((a, b) => a.createAt - b.createAt))
        })
    },
})

export const {updateComments} = commentsSlice.actions
export const {reducer} = commentsSlice

export function getCardComments(cardId: string): (state: RootState) => CommentBlock[] {
    return (state: RootState): CommentBlock[] => {
        return (state.comments?.commentsByCard && state.comments.commentsByCard[cardId]) || []
    }
}

export function getLastCardComment(cardId: string): (state: RootState) => CommentBlock|undefined {
    return (state: RootState): CommentBlock|undefined => {
        const comments = state.comments?.commentsByCard && state.comments.commentsByCard[cardId]
        return comments?.[comments?.length - 1]
    }
}

export const getLastCommentByCard = createSelector(
    (state: RootState) => state.comments?.commentsByCard || null,
    (commentsByCard: {[key: string]: CommentBlock[]}|null): {[key: string]: CommentBlock} => {
        const lastCommentByCard: {[key: string]: CommentBlock} = {}
        Object.keys(commentsByCard || {}).forEach((cardId) => {
            if (commentsByCard && commentsByCard[cardId]) {
                const comments = commentsByCard[cardId]
                lastCommentByCard[cardId] = comments?.[comments?.length - 1]
            }
        })
        return lastCommentByCard
    },
)
