// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PayloadAction, createSlice} from '@reduxjs/toolkit'

import {RootState} from './index'

const storedValue = localStorage.getItem('ongoingTask');

const triggerSlice = createSlice({
    
    name: 'itpTimeRecorder',
    initialState: { isTriggered: false },
    reducers: {
        setTrigger: (state, action: PayloadAction<boolean>) => {
            localStorage.setItem('ongoingTask', String(action.payload))
            console.log(action.payload);
            state.isTriggered = action.payload;
            
          },
    },
  });
  

export const {reducer} = triggerSlice
export const { setTrigger } = triggerSlice.actions;

export const getTrigger = (state: RootState): boolean => state.itpTimeRecorder.isTriggered

