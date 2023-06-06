// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PayloadAction, createAsyncThunk, createSlice} from '@reduxjs/toolkit'

import {ClientConfig} from 'src/config/clientConfig'

import {default as client} from 'src/octoClient'

import {ShowUsername} from 'src/utils'

import {RootState} from './index'

export const fetchClientConfig = createAsyncThunk(
    'clientConfig/fetchClientConfig',
    async () => client.getClientConfig(),
)

const clientConfigSlice = createSlice({
    name: 'config',
    initialState: {value: {telemetry: false, telemetryid: '', enablePublicSharedBoards: false, teammateNameDisplay: ShowUsername, featureFlags: {}, maxFileSize: 0}} as {value: ClientConfig},
    reducers: {
        setClientConfig: (state, action: PayloadAction<ClientConfig>) => {
            state.value = action.payload
        },
    },
    extraReducers: (builder) => {
        builder.addCase(fetchClientConfig.fulfilled, (state, action) => {
            state.value = action.payload || {telemetry: false, telemetryid: '', enablePublicSharedBoards: false, teammateNameDisplay: ShowUsername, featureFlags: {}, maxFileSize: 0}
        })
    },
})

export const {setClientConfig} = clientConfigSlice.actions
export const {reducer} = clientConfigSlice

export function getClientConfig(state: RootState): ClientConfig {
    return state.clientConfig.value
}
