// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createAsyncThunk, createSelector} from '@reduxjs/toolkit'

import {default as client} from 'src/octoClient'
import {Subscription} from 'src/wsclient'
import {ErrorId} from 'src/errors'

import {RootState} from './index'

export const initialLoad = createAsyncThunk(
    'initialLoad',
    async () => {
        const [me, myConfig, team, teams, boards, boardsMemberships, boardTemplates, limits] = await Promise.all([
            client.getMe(),
            client.getMyConfig(),
            client.getTeam(),
            client.getTeams(),
            client.getBoards(),
            client.getMyBoardMemberships(),
            client.getTeamTemplates(),
            client.getBoardsCloudLimits(),
        ])

        // if no me, normally user not logged in
        if (!me) {
            throw new Error(ErrorId.NotLoggedIn)
        }

        // if no team, either bad id, or user doesn't have access
        if (!team) {
            throw new Error(ErrorId.TeamUndefined)
        }
        return {
            team,
            teams,
            boards,
            boardsMemberships,
            boardTemplates,
            limits,
            myConfig,
        }
    },
)

export const initialReadOnlyLoad = createAsyncThunk(
    'initialReadOnlyLoad',
    async (boardId: string) => {
        const [board, blocks] = await Promise.all([
            client.getBoard(boardId),
            client.getAllBlocks(boardId),
        ])

        // if no board, read_token invalid
        if (!board) {
            throw new Error(ErrorId.InvalidReadOnlyBoard)
        }

        return {board, blocks}
    },
)

export const loadBoardData = createAsyncThunk(
    'loadBoardData',
    async (boardID: string) => {
        const blocks = await client.getAllBlocks(boardID)
        return {
            blocks,
        }
    },
)

export const loadBoards = createAsyncThunk(
    'loadBoards',
    async () => {
        const boards = await client.getBoards()
        return {
            boards,
        }
    },
)

export const loadMyBoardsMemberships = createAsyncThunk(
    'loadMyBoardsMemberships',
    async () => {
        const boardsMemberships = await client.getMyBoardMemberships()
        return {
            boardsMemberships,
        }
    },
)

export const getUserBlockSubscriptions = (state: RootState): Subscription[] => state.users.blockSubscriptions

export const getUserBlockSubscriptionList = createSelector(
    getUserBlockSubscriptions,
    (subscriptions) => subscriptions,
)
