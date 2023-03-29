// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSlice, createAsyncThunk} from '@reduxjs/toolkit'

import {default as client} from 'src/octoClient'
import {Board} from 'src/blocks/board'

import {Constants} from 'src/constants'

import {RootState} from './index'

export const fetchGlobalTemplates = createAsyncThunk(
    'globalTemplates/fetch',
    async () => {
        const templates = await client.getTeamTemplates(Constants.globalTeamId)
        return templates.sort((a, b) => a.title.localeCompare(b.title))
    },
)

const globalTemplatesSlice = createSlice({
    name: 'globalTemplates',
    initialState: {value: []} as {value: Board[]},
    reducers: {},
    extraReducers: (builder) => {
        builder.addCase(fetchGlobalTemplates.fulfilled, (state, action) => {
            state.value = action.payload || []
        })
    },
})

export const {reducer} = globalTemplatesSlice

export function getGlobalTemplates(state: RootState): Board[] {
    return state.globalTemplates.value
}
