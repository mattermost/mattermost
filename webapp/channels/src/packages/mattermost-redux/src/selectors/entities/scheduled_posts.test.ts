// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ScheduledPost} from '@mattermost/types/schedule_post';
import type {GlobalState} from '@mattermost/types/store';

import {getScheduledPostTeamId, showChannelOrThreadScheduledPostIndicator} from './scheduled_posts';

describe('getScheduledPostTeamId', () => {
    const scheduledPost = {id: 'post1', channel_id: 'channel1'} as ScheduledPost;

    function makeState(channels: Record<string, {team_id: string}>, byTeamId: Record<string, string[]>): GlobalState {
        return {
            entities: {
                channels: {channels},
                scheduledPosts: {byTeamId},
            },
        } as unknown as GlobalState;
    }

    it('should return the team of the post channel when the channel is loaded', () => {
        const state = makeState({channel1: {team_id: 'team1'}}, {});
        expect(getScheduledPostTeamId(state, scheduledPost)).toBe('team1');
    });

    it('should return an empty team for loaded DM/GM channels', () => {
        const state = makeState({channel1: {team_id: ''}}, {});
        expect(getScheduledPostTeamId(state, scheduledPost)).toBe('');
    });

    it('should fall back to the bucket already holding the post when the channel is not loaded', () => {
        const state = makeState({}, {team2: ['other', 'post1'], directChannels: []});
        expect(getScheduledPostTeamId(state, scheduledPost)).toBe('team2');
    });

    it('should return undefined when the channel is not loaded and no bucket holds the post', () => {
        const state = makeState({}, {team2: ['other']});
        expect(getScheduledPostTeamId(state, scheduledPost)).toBeUndefined();
    });
});

describe('showChannelOrThreadScheduledPostIndicator', () => {
    function makeState(scheduledPosts: ScheduledPost[]): GlobalState {
        return {
            entities: {
                scheduledPosts: {
                    byId: Object.fromEntries(scheduledPosts.map((post) => [post.id, post])),
                    byChannelOrThreadId: {channel1: scheduledPosts.map((post) => post.id)},
                },
            },
        } as unknown as GlobalState;
    }

    function makePost(id: string, overrides: Partial<ScheduledPost> = {}): ScheduledPost {
        return {id, channel_id: 'channel1', ...overrides} as ScheduledPost;
    }

    it('should report no non-recurring post when every scheduled post is recurring', () => {
        const state = makeState([
            makePost('post1', {repeat_type: 'weekly'}),
            makePost('post2', {repeat_type: 'weekly'}),
        ]);

        expect(showChannelOrThreadScheduledPostIndicator(state, 'channel1')).toEqual({
            count: 2,
            hasNonRecurringPost: false,
        });
    });

    it('should report a non-recurring post when the only scheduled post is a one-shot', () => {
        const scheduledPost = makePost('post1');
        const state = makeState([scheduledPost]);

        expect(showChannelOrThreadScheduledPostIndicator(state, 'channel1')).toEqual({
            count: 1,
            hasNonRecurringPost: true,
            scheduledPost,
        });
    });

    it('should count recurring posts alongside a non-recurring one', () => {
        const state = makeState([
            makePost('post1', {repeat_type: 'weekly'}),
            makePost('post2'),
        ]);

        expect(showChannelOrThreadScheduledPostIndicator(state, 'channel1')).toEqual({
            count: 2,
            hasNonRecurringPost: true,
        });
    });

    it('should ignore errored posts', () => {
        const scheduledPost = makePost('post2', {repeat_type: 'weekly'});
        const state = makeState([
            makePost('post1', {error_code: 'unknown'}),
            scheduledPost,
        ]);

        expect(showChannelOrThreadScheduledPostIndicator(state, 'channel1')).toEqual({
            count: 1,
            hasNonRecurringPost: false,
            scheduledPost,
        });
    });

    it('should report an empty channel', () => {
        expect(showChannelOrThreadScheduledPostIndicator(makeState([]), 'channel2')).toEqual({
            count: 0,
            hasNonRecurringPost: false,
        });
    });
});
