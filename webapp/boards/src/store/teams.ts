// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PayloadAction, createAsyncThunk, createSlice} from '@reduxjs/toolkit'

import octoClient from 'src/octoClient'

import {Utils} from 'src/utils'

import {initialLoad} from './initialLoad'

import {RootState} from './index'

export interface Team {
    id: string
    title: string
    signupToken: string
    modifiedBy: string
    updateAt: number
}

export const fetchTeams = createAsyncThunk(
    'team/fetch',
    async () => octoClient.getTeams(),
)

export const regenerateSignupToken = createAsyncThunk(
    'team/regenerateSignupToken',
    async () => octoClient.regenerateTeamSignupToken(),
)

export const refreshCurrentTeam = createAsyncThunk(
    'team/refreshCurrentTeam',
    async () => octoClient.getTeam(),
)

type TeamState = {
    currentId: string
    current: Team | null
    allTeams: Team[]
}

const teamSlice = createSlice({
    name: 'teams',
    initialState: {
        current: null,
        currentId: '',
        allTeams: [],
    } as TeamState,
    reducers: {
        setTeam: (state, action: PayloadAction<string>) => {
            const teamID = action.payload
            state.currentId = teamID
            const team = state.allTeams.find((t) => t.id === teamID)
            if (!team) {
                Utils.log(`Unable to find team in store. TeamID: ${teamID}`)

                return
            }

            if (state.current === team) {
                return
            }

            state.current = team
        },
    },
    extraReducers: (builder) => {
        builder.addCase(initialLoad.fulfilled, (state, action) => {
            state.current = action.payload.team
            state.allTeams = action.payload.teams
            state.allTeams.sort((a: Team, b: Team) => (a.title < b.title ? -1 : 1))
        })
        builder.addCase(fetchTeams.fulfilled, (state, action) => {
            state.allTeams = action.payload
            state.allTeams.sort((a: Team, b: Team) => (a.title < b.title ? -1 : 1))
        })
        builder.addCase(refreshCurrentTeam.fulfilled, (state, action) => {
            state.current = action.payload
        })
    },
})

export const {setTeam} = teamSlice.actions
export const {reducer} = teamSlice

export const getCurrentTeamId = (state: RootState): string => state.teams.currentId
export const getCurrentTeam = (state: RootState): Team|null => state.teams.current
export const getFirstTeam = (state: RootState): Team|null => state.teams.allTeams[0]
export const getAllTeams = (state: RootState): Team[] => state.teams.allTeams
