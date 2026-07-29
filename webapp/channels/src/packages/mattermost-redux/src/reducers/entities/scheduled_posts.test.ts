// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ScheduledPost} from '@mattermost/types/schedule_post';

import {ScheduledPostTypes} from 'mattermost-redux/action_types';

import reducer from './scheduled_posts';

describe('scheduled_posts reducer', () => {
    const initialState = reducer(undefined, {type: ''} as any);

    function makeScheduledPost(overrides: Partial<ScheduledPost>): ScheduledPost {
        return {
            id: 'post1',
            channel_id: 'channel1',
            scheduled_at: 100,
            ...overrides,
        } as ScheduledPost;
    }

    describe('SCHEDULED_POST_UPDATED', () => {
        it('should add an errored post to its team error list', () => {
            const scheduledPost = makeScheduledPost({error_code: 'unable_to_send'});

            const state = reducer(initialState, {
                type: ScheduledPostTypes.SCHEDULED_POST_UPDATED,
                data: {scheduledPost, teamId: 'team1'},
            });

            expect(state.errorsByTeamId.team1).toEqual(['post1']);
        });

        it('should fall back to directChannels when there is no team', () => {
            const scheduledPost = makeScheduledPost({error_code: 'unable_to_send'});

            const state = reducer(initialState, {
                type: ScheduledPostTypes.SCHEDULED_POST_UPDATED,
                data: {scheduledPost, teamId: undefined},
            });

            expect(state.errorsByTeamId.directChannels).toEqual(['post1']);
        });

        it('should remove a no-longer-errored post from every team error list', () => {
            const erroredPost = makeScheduledPost({error_code: 'unable_to_send'});
            let state = reducer(initialState, {
                type: ScheduledPostTypes.SCHEDULED_POST_UPDATED,
                data: {scheduledPost: erroredPost, teamId: 'team1'},
            });

            const recoveredPost = makeScheduledPost({error_code: undefined});
            state = reducer(state, {
                type: ScheduledPostTypes.SCHEDULED_POST_UPDATED,
                data: {scheduledPost: recoveredPost, teamId: 'team1'},
            });

            expect(state.errorsByTeamId.team1).toEqual([]);
        });

        it('should move an errored post between team error lists', () => {
            const scheduledPost = makeScheduledPost({error_code: 'unable_to_send'});
            let state = reducer(initialState, {
                type: ScheduledPostTypes.SCHEDULED_POST_UPDATED,
                data: {scheduledPost, teamId: 'team1'},
            });

            state = reducer(state, {
                type: ScheduledPostTypes.SCHEDULED_POST_UPDATED,
                data: {scheduledPost, teamId: 'team2'},
            });

            expect(state.errorsByTeamId.team1).toEqual([]);
            expect(state.errorsByTeamId.team2).toEqual(['post1']);
        });

        it('should not duplicate a post already in its team error list', () => {
            const scheduledPost = makeScheduledPost({error_code: 'unable_to_send'});
            let state = reducer(initialState, {
                type: ScheduledPostTypes.SCHEDULED_POST_UPDATED,
                data: {scheduledPost, teamId: 'team1'},
            });

            state = reducer(state, {
                type: ScheduledPostTypes.SCHEDULED_POST_UPDATED,
                data: {scheduledPost, teamId: 'team1'},
            });

            expect(state.errorsByTeamId.team1).toEqual(['post1']);
        });
    });
});
