// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PostTypes, UserTypes} from 'mattermost-redux/action_types';

import threadsReducer, {
    threadLastUpdateAtChanged,
    threadLastViewedAtChanged,
    threadMarkedUnread,
    threadsViewThreadChanged,
    threadToastStatusChanged,
} from 'reducers/views/threads';
import type {ThreadsViewState} from 'reducers/views/threads';

import {ActionTypes} from 'utils/constants';

describe('Reducers.views.threads', () => {
    const initialState: ThreadsViewState = {
        selectedThreadIdInTeam: {},
        lastViewedAt: {},
        lastUpdateAt: {},
        manuallyUnread: {},
        toastStatus: false,
    };

    test('should return the initial state', () => {
        expect(threadsReducer(undefined, {type: 'unknown'})).toEqual(initialState);
    });

    test('should track the thread shown in the Threads view per team', () => {
        let state = threadsReducer(initialState, threadsViewThreadChanged({teamId: 'team1', threadId: 'thread1'}));
        state = threadsReducer(state, threadsViewThreadChanged({teamId: 'team2', threadId: 'thread2'}));
        expect(state.selectedThreadIdInTeam).toEqual({team1: 'thread1', team2: 'thread2'});

        state = threadsReducer(state, threadsViewThreadChanged({teamId: 'team1', threadId: null}));
        expect(state.selectedThreadIdInTeam).toEqual({team1: null, team2: 'thread2'});
    });

    test('should clear a selected thread when its root post is removed', () => {
        const state = threadsReducer(
            {...initialState, selectedThreadIdInTeam: {team1: 'thread1', team2: 'thread2'}},
            {type: PostTypes.POST_REMOVED, data: {id: 'thread1'}},
        );

        expect(state.selectedThreadIdInTeam).toEqual({team1: null, team2: 'thread2'});
    });

    test('should mark a thread unread and clear the mark when it is viewed again', () => {
        const unread = threadsReducer(initialState, threadMarkedUnread({threadId: 'thread1', lastViewedAt: 100}));
        expect(unread.lastViewedAt).toEqual({thread1: 100});
        expect(unread.manuallyUnread).toEqual({thread1: true});

        const viewed = threadsReducer(unread, threadLastViewedAtChanged({threadId: 'thread1', lastViewedAt: 200}));
        expect(viewed.lastViewedAt).toEqual({thread1: 200});
        expect(viewed.manuallyUnread).toEqual({thread1: false});
    });

    test('should track the last update time per thread', () => {
        const state = threadsReducer(initialState, threadLastUpdateAtChanged({threadId: 'thread1', lastUpdateAt: 300}));

        expect(state.lastUpdateAt).toEqual({thread1: 300});
    });

    test('should hide the toast when a post is selected', () => {
        const shown = threadsReducer(initialState, threadToastStatusChanged(true));
        expect(shown.toastStatus).toBe(true);

        expect(threadsReducer(shown, {type: ActionTypes.SELECT_POST, postId: 'post1'}).toastStatus).toBe(false);
    });

    test('should reset everything on logout', () => {
        const state: ThreadsViewState = {
            selectedThreadIdInTeam: {team1: 'thread1'},
            lastViewedAt: {thread1: 100},
            lastUpdateAt: {thread1: 300},
            manuallyUnread: {thread1: true},
            toastStatus: true,
        };

        expect(threadsReducer(state, {type: UserTypes.LOGOUT_SUCCESS})).toEqual(initialState);
    });
});
