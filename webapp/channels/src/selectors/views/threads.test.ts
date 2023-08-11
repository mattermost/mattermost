// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from 'types/store';

import * as selectors from './threads';

describe('selectors/views/threads', () => {
    const makeState = (selectedThreadId: string|null, selectedPostId: string, isSidebarOpen = true) => ({
        entities: {
            teams: {
                currentTeamId: 'current_team_id',
            },
            threads: {
                selected_thread_id: {
                    id: 'selected_thread_id',
                },
                selected_post_id: {
                    id: 'selected_post_id',
                },
                post_id: {
                    id: 'post_id',
                },
            },
        },
        views: {
            threads: {
                selectedThreadIdInTeam: {
                    current_team_id: selectedThreadId,
                },
            },
            rhs: {
                selectedPostId,
                isSidebarOpen,
            },
            rhsSuppressed: false,
        },
    }) as unknown as GlobalState;

    describe('isThreadOpen', () => {
        test('should return true when a specific thread is open', () => {
            const state = makeState('selected_thread_id', '');
            expect(selectors.isThreadOpen(state, 'selected_thread_id')).toBe(true);
        });

        test('should return false when another thread is open', () => {
            const state = makeState(null, 'selected_post_id');
            expect(selectors.isThreadOpen(state, 'selected_thread_id')).toBe(false);
        });

        test('should return false when no threads are open', () => {
            const state = makeState(null, '');
            expect(selectors.isThreadOpen(state, 'post_id')).toBe(false);
        });

        test('should return true for either thread with both threads are open', () => {
            const state = makeState('selected_thread_id', 'selected_post_id');
            expect(selectors.isThreadOpen(state, 'selected_thread_id')).toBe(true);
            expect(selectors.isThreadOpen(state, 'selected_post_id')).toBe(true);
        });
    });
});
