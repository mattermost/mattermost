// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSlice} from '@reduxjs/toolkit';
import type {PayloadAction} from '@reduxjs/toolkit';
import findKey from 'lodash/findKey';

import type {Post} from '@mattermost/types/posts';
import type {Team} from '@mattermost/types/teams';
import type {UserThread} from '@mattermost/types/threads';
import type {RelationOneToOne} from '@mattermost/types/utilities';

import {PostTypes, UserTypes} from 'mattermost-redux/action_types';

import {ActionTypes} from 'utils/constants';

import type {GlobalState} from 'types/store';

export type ThreadsViewState = {
    selectedThreadIdInTeam: RelationOneToOne<Team, UserThread['id'] | null>;
    lastViewedAt: {[id: string]: number};
    lastUpdateAt: {[id: string]: number};
    manuallyUnread: {[id: string]: boolean};
    toastStatus: boolean;
};

type PostRemovedAction = {type: typeof PostTypes.POST_REMOVED; data: Post};

const initialState: ThreadsViewState = {
    selectedThreadIdInTeam: {},
    lastViewedAt: {},
    lastUpdateAt: {},
    manuallyUnread: {},
    toastStatus: false,
};

const threadsSlice = createSlice({
    name: 'views/threads',
    initialState,
    reducers: {
        threadsViewThreadChanged(state, action: PayloadAction<{teamId: Team['id']; threadId: UserThread['id'] | null}>) {
            state.selectedThreadIdInTeam[action.payload.teamId] = action.payload.threadId;
        },
        threadLastViewedAtChanged(state, action: PayloadAction<{threadId: UserThread['id']; lastViewedAt: number}>) {
            state.lastViewedAt[action.payload.threadId] = action.payload.lastViewedAt;
            state.manuallyUnread[action.payload.threadId] = false;
        },
        threadMarkedUnread(state, action: PayloadAction<{threadId: UserThread['id']; lastViewedAt: number}>) {
            state.lastViewedAt[action.payload.threadId] = action.payload.lastViewedAt;
            state.manuallyUnread[action.payload.threadId] = true;
        },
        threadLastUpdateAtChanged(state, action: PayloadAction<{threadId: UserThread['id']; lastUpdateAt: number}>) {
            state.lastUpdateAt[action.payload.threadId] = action.payload.lastUpdateAt;
        },
        threadToastStatusChanged(state, action: PayloadAction<boolean>) {
            state.toastStatus = action.payload;
        },
    },
    extraReducers: (builder) => {
        builder.
            addCase<PostRemovedAction['type'], PostRemovedAction>(PostTypes.POST_REMOVED, (state, action) => {
                const teamId = findKey(state.selectedThreadIdInTeam, (id) => id === action.data.id);
                if (teamId) {
                    state.selectedThreadIdInTeam[teamId] = null;
                }
            }).
            addCase(ActionTypes.SELECT_POST, (state) => {
                state.toastStatus = false;
            }).
            addCase(UserTypes.LOGOUT_SUCCESS, () => initialState);
    },
    selectors: {
        getSelectedThreadIdInTeam: (state) => state.selectedThreadIdInTeam,
        getThreadLastViewedAt: (state, threadId: UserThread['id']): number | undefined => state.lastViewedAt[threadId],
        getThreadLastUpdateAt: (state, threadId: UserThread['id']) => state.lastUpdateAt[threadId] || 0,
        isThreadManuallyUnread: (state, threadId: UserThread['id']) => state.manuallyUnread[threadId] || false,
        getThreadToastStatus: (state) => state.toastStatus,
    },
});

export const {
    threadsViewThreadChanged,
    threadLastViewedAtChanged,
    threadMarkedUnread,
    threadLastUpdateAtChanged,
    threadToastStatusChanged,
} = threadsSlice.actions;

export const {
    getSelectedThreadIdInTeam,
    getThreadLastViewedAt,
    getThreadLastUpdateAt,
    isThreadManuallyUnread,
    getThreadToastStatus,
} = threadsSlice.getSelectors((state: GlobalState) => state.views.threads);

export default threadsSlice.reducer;
