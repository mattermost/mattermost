// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSlice, PayloadAction} from '@reduxjs/toolkit'

import {RootState} from './index'

export const ChannelTypeOpen = 'O'
export const ChannelTypePrivate = 'P'
export const ChannelTypeDirectMessage = 'D'
export const ChannelTypeGroupMessage = 'G'
const channelTypes = [ChannelTypeOpen, ChannelTypePrivate, ChannelTypeDirectMessage, ChannelTypeGroupMessage]
type ChannelType = typeof channelTypes[number]

export interface Channel {
    id: string
    name: string
    display_name: string
    type: ChannelType
}

type ChannelState = {
    current: Channel | null
}

const channelSlice = createSlice({
    name: 'channels',
    initialState: {
        current: null,
    } as ChannelState,
    reducers: {
        setChannel: (state, action: PayloadAction<Channel>) => {
            const channel = action.payload
            if (state.current === channel) {
                return
            }

            state.current = channel
        },
    },
})

export const {setChannel} = channelSlice.actions
export const {reducer} = channelSlice

export const getCurrentChannel = (state: RootState): Channel|null => state.channels.current
