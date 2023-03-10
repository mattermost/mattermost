// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSlice, PayloadAction} from '@reduxjs/toolkit'

import {initialLoad, initialReadOnlyLoad} from './initialLoad'

import {RootState} from './index'

const globalErrorSlice = createSlice({
    name: 'globalError',
    initialState: {value: ''} as {value: string},
    reducers: {
        setGlobalError: (state, action: PayloadAction<string>) => {
            state.value = action.payload
        },
    },
    extraReducers: (builder) => {
        builder.addCase(initialReadOnlyLoad.rejected, (state, action) => {
            state.value = action.error.message || ''
        })
        builder.addCase(initialLoad.rejected, (state, action) => {
            state.value = action.error.message || ''
        })
    },
})

export const {setGlobalError} = globalErrorSlice.actions
export const {reducer} = globalErrorSlice

export const getGlobalError = (state: RootState): string => state.globalError.value
