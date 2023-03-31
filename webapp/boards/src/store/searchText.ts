// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSlice, PayloadAction} from '@reduxjs/toolkit'

import {RootState} from './index'

const searchTextSlice = createSlice({
    name: 'searchText',
    initialState: {value: ''} as {value: string},
    reducers: {
        setSearchText: (state, action: PayloadAction<string>) => {
            state.value = action.payload
        },
    },
})

export const {setSearchText} = searchTextSlice.actions
export const {reducer} = searchTextSlice

export function getSearchText(state: RootState): string {
    return state.searchText.value
}
