// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    PayloadAction,
    createAsyncThunk,
    createSelector,
    createSlice,
} from '@reduxjs/toolkit'

import {default as client} from 'src/octoClient'
import {Board, BoardMember} from 'src/blocks/board'
import {IUser} from 'src/user'

import {
    initialLoad,
    initialReadOnlyLoad,
    loadBoardData,
    loadBoards,
    loadMyBoardsMemberships,
} from './initialLoad'

import {addBoardUsers, removeBoardUsersById, setBoardUsers} from './users'

import {RootState} from './index'

type BoardsState = {
    current: string
    loadingBoard: boolean
    linkToChannel: string
    boards: {[key: string]: Board}
    templates: {[key: string]: Board}
    membersInBoards: {[key: string]: {[key: string]: BoardMember}}
    myBoardMemberships: {[key: string]: BoardMember}
}

export const fetchBoardMembers = createAsyncThunk(
    'boardMembers/fetch',
    async ({teamId, boardId}: {teamId: string, boardId: string}, thunkAPI: any) => {
        const members = await client.getBoardMembers(teamId, boardId)
        const users = [] as IUser[]
        const userIDs = members.map((member) => member.userId)

        const usersData = await client.getTeamUsersList(userIDs, teamId)
        users.push(...usersData)

        thunkAPI.dispatch(setBoardUsers(users))

        return members
    },
)

export const updateMembersEnsuringBoardsAndUsers = createAsyncThunk(
    'updateMembersEnsuringBoardsAndUsers',
    async (members: BoardMember[], thunkAPI: any) => {
        const me = thunkAPI.getState().users.me
        if (me) {
            // ensure the boards for the new memberships get loaded or removed
            const boards = thunkAPI.getState().boards.boards
            const myMemberships = members.filter((m) => m.userId === me.id)
            const boardsToUpdate: Board[] = []
            /* eslint-disable no-await-in-loop */
            for (const member of myMemberships) {
                if (!member.schemeAdmin && !member.schemeEditor && !member.schemeViewer && !member.schemeCommenter) {
                    boardsToUpdate.push({id: member.boardId, deleteAt: 1} as Board)
                    continue
                }

                if (boards[member.boardId]) {
                    continue
                }

                const board = await client.getBoard(member.boardId)
                if (board) {
                    boardsToUpdate.push(board)
                }
            }
            /* eslint-enable no-await-in-loop */

            thunkAPI.dispatch(updateBoards(boardsToUpdate))
        }

        // ensure the users for the new memberships get loaded
        const boardUsers = thunkAPI.getState().users.boardUsers
        members.forEach(async (m) => {
            const deleted = !m.schemeAdmin && !m.schemeEditor && !m.schemeViewer && !m.schemeCommenter
            if (deleted) {
                thunkAPI.dispatch(removeBoardUsersById([m.userId]))

                return
            }
            if (boardUsers[m.userId]) {
                return
            }

            const board = await client.getBoard(m.boardId)
            if (board) {
                const user = await client.getTeamUsersList([m.userId], board.teamId)
                if (user) {
                    thunkAPI.dispatch(addBoardUsers(user))
                }
            }
        })

        return members
    },
)

export const updateMembersHandler = (state: BoardsState, action: PayloadAction<BoardMember[]>) => {
    if (action.payload.length === 0) {
        return
    }

    const boardId = action.payload[0].boardId
    const boardMembers = state.membersInBoards[boardId] || {}

    for (const member of action.payload) {
        if (!member.schemeAdmin && !member.schemeEditor && !member.schemeViewer && !member.schemeCommenter) {
            delete boardMembers[member.userId]
        } else {
            boardMembers[member.userId] = member
        }
    }

    for (const member of action.payload) {
        if (state.myBoardMemberships[member.boardId] && state.myBoardMemberships[member.boardId].userId === member.userId) {
            if (!member.schemeAdmin && !member.schemeEditor && !member.schemeViewer && !member.schemeCommenter) {
                delete state.myBoardMemberships[member.boardId]
            } else {
                state.myBoardMemberships[member.boardId] = member
            }
        }
    }
}

const boardsSlice = createSlice({
    name: 'boards',
    initialState: {loadingBoard: false, linkToChannel: '', boards: {}, templates: {}, membersInBoards: {}, myBoardMemberships: {}} as BoardsState,
    reducers: {
        setCurrent: (state, action: PayloadAction<string>) => {
            state.current = action.payload
        },
        setLinkToChannel: (state, action: PayloadAction<string>) => {
            state.linkToChannel = action.payload
        },
        updateBoards: (state, action: PayloadAction<Board[]>) => {
            for (const board of action.payload) {
                if (board.deleteAt !== 0) {
                    delete state.boards[board.id]
                    delete state.templates[board.id]
                } else if (board.isTemplate) {
                    state.templates[board.id] = board
                } else {
                    state.boards[board.id] = board
                }
            }
        },
        updateMembers: updateMembersHandler,
        addMyBoardMemberships: (state, action: PayloadAction<BoardMember[]>) => {
            action.payload.forEach((member) => {
                if (!member.schemeAdmin && !member.schemeEditor && !member.schemeViewer && !member.schemeCommenter) {
                    delete state.myBoardMemberships[member.boardId]
                } else {
                    state.myBoardMemberships[member.boardId] = member
                }
            })
        },
    },

    extraReducers: (builder) => {
        builder.addCase(loadBoardData.pending, (state) => {
            state.loadingBoard = true
        })
        builder.addCase(loadBoardData.fulfilled, (state) => {
            state.loadingBoard = false
        })
        builder.addCase(loadBoardData.rejected, (state) => {
            state.loadingBoard = false
        })
        builder.addCase(initialReadOnlyLoad.fulfilled, (state, action) => {
            state.boards = {}
            state.templates = {}
            if (action.payload.board) {
                if (action.payload.board.isTemplate) {
                    state.templates[action.payload.board.id] = action.payload.board
                } else {
                    state.boards[action.payload.board.id] = action.payload.board
                }
            }
        })
        builder.addCase(initialLoad.fulfilled, (state, action) => {
            state.boards = {}
            action.payload.boards.forEach((board) => {
                state.boards[board.id] = board
            })
            state.templates = {}
            action.payload.boardTemplates.forEach((board) => {
                state.templates[board.id] = board
            })
            state.myBoardMemberships = {}
            action.payload.boardsMemberships.forEach((boardMember) => {
                state.myBoardMemberships[boardMember.boardId] = boardMember
            })
        })
        builder.addCase(loadBoards.fulfilled, (state, action) => {
            state.boards = {}
            action.payload.boards.forEach((board) => {
                state.boards[board.id] = board
            })
        })
        builder.addCase(loadMyBoardsMemberships.fulfilled, (state, action) => {
            state.myBoardMemberships = {}
            action.payload.boardsMemberships.forEach((boardMember) => {
                state.myBoardMemberships[boardMember.boardId] = boardMember
            })
        })
        builder.addCase(fetchBoardMembers.fulfilled, (state, action) => {
            if (action.payload.length === 0) {
                return
            }

            // all members should belong to the same boardId, so we
            // get it from the first one
            const boardId = action.payload[0].boardId
            const boardMembersMap = action.payload.reduce((acc: {[key: string]: BoardMember}, val: BoardMember) => {
                acc[val.userId] = val

                return acc
            }, {})
            state.membersInBoards[boardId] = boardMembersMap
        })
        builder.addCase(updateMembersEnsuringBoardsAndUsers.fulfilled, updateMembersHandler)
    },
})

export const {updateBoards, setCurrent, setLinkToChannel, updateMembers, addMyBoardMemberships} = boardsSlice.actions
export const {reducer} = boardsSlice

export const getBoards = (state: RootState): {[key: string]: Board} => state.boards?.boards || {}

export const getMySortedBoards = createSelector(
    getBoards,
    (state: RootState): {[key: string]: BoardMember} => state.boards?.myBoardMemberships || {},
    (boards, myBoardMemberships: {[key: string]: BoardMember}) => {
        return Object.values(boards).filter((b) => myBoardMemberships[b.id])
            .sort((a, b) => a.title.localeCompare(b.title))
    },
)

export const getTemplates = (state: RootState): {[key: string]: Board} => state.boards.templates

export const getSortedTemplates = createSelector(
    getTemplates,
    (templates) => {
        return Object.values(templates).sort((a, b) => a.title.localeCompare(b.title))
    },
)

export function getBoard(boardId: string): (state: RootState) => Board|null {
    return (state: RootState): Board|null => {
        if (state.boards.boards && state.boards.boards[boardId]) {
            return state.boards.boards[boardId]
        } else if (state.boards.templates && state.boards.templates[boardId]) {
            return state.boards.templates[boardId]
        }

        return null
    }
}

export const isLoadingBoard = (state: RootState): boolean => state.boards.loadingBoard

export const getCurrentBoardId = (state: RootState): string => state.boards.current || ''

export const getCurrentBoard = createSelector(
    getCurrentBoardId,
    getBoards,
    getTemplates,
    (boardId, boards, templates) => {
        return boards[boardId] || templates[boardId]
    },
)

export const getCurrentBoardMembers = createSelector(
    (state: RootState): string => state.boards.current,
    (state: RootState): {[key: string]: {[key: string]: BoardMember}} => state.boards.membersInBoards,
    (boardId: string, membersInBoards: {[key: string]: {[key: string]: BoardMember}}): {[key: string]: BoardMember} => {
        return membersInBoards[boardId] || {}
    },
)

export function getMyBoardMembership(boardId: string): (state: RootState) => BoardMember|null {
    return (state: RootState): BoardMember|null => {
        return state.boards.myBoardMemberships[boardId] || null
    }
}

export const getCurrentLinkToChannel = (state: RootState): string => state.boards.linkToChannel
