// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ScheduledPost} from '@mattermost/types/schedule_post';
import type {GlobalState} from '@mattermost/types/store';

import {getScheduledPostTeamId, isRecurringScheduledPostsEnabled, showChannelOrThreadScheduledPostIndicator} from './scheduled_posts';

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

describe('isRecurringScheduledPostsEnabled', () => {
    function makeState(scheduledPosts: string, featureFlag: string, isLicensed: string): GlobalState {
        return {
            entities: {
                general: {
                    config: {
                        ScheduledPosts: scheduledPosts,
                        FeatureFlagRecurringScheduledPosts: featureFlag,
                    },
                    license: {IsLicensed: isLicensed},
                },
            },
        } as unknown as GlobalState;
    }

    it('should be enabled only when scheduled posts, the license and the feature flag all allow it', () => {
        expect(isRecurringScheduledPostsEnabled(makeState('true', 'true', 'true'))).toBe(true);
        expect(isRecurringScheduledPostsEnabled(makeState('false', 'true', 'true'))).toBe(false);
        expect(isRecurringScheduledPostsEnabled(makeState('true', 'false', 'true'))).toBe(false);
        expect(isRecurringScheduledPostsEnabled(makeState('true', 'true', 'false'))).toBe(false);
    });

    it('should be disabled when the feature flag is missing from the config', () => {
        const state = {
            entities: {
                general: {
                    config: {ScheduledPosts: 'true'},
                    license: {IsLicensed: 'true'},
                },
            },
        } as unknown as GlobalState;

        expect(isRecurringScheduledPostsEnabled(state)).toBe(false);
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

    it('should return null when every scheduled post is recurring', () => {
        const state = makeState([
            makePost('post1', {repeat_type: 'weekly'}),
            makePost('post2', {repeat_type: 'weekly'}),
        ]);

        expect(showChannelOrThreadScheduledPostIndicator(state, 'channel1')).toBeNull();
    });

    it('should show the indicator when the only scheduled post is a one-shot', () => {
        const scheduledPost = makePost('post1');
        const state = makeState([scheduledPost]);

        expect(showChannelOrThreadScheduledPostIndicator(state, 'channel1')).toEqual({
            count: 1,
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
        });
    });

    it('should ignore errored posts', () => {
        const state = makeState([
            makePost('post1', {error_code: 'unknown'}),
            makePost('post2', {repeat_type: 'weekly'}),
        ]);

        expect(showChannelOrThreadScheduledPostIndicator(state, 'channel1')).toBeNull();
    });

    it('should ignore ids without a loaded post', () => {
        const scheduledPost = makePost('post1');
        const state = makeState([scheduledPost]);
        (state.entities.scheduledPosts.byChannelOrThreadId.channel1 as string[]).push('dangling');

        expect(showChannelOrThreadScheduledPostIndicator(state, 'channel1')).toEqual({
            count: 1,
            scheduledPost,
        });
    });

    it('should return null for an empty channel', () => {
        expect(showChannelOrThreadScheduledPostIndicator(makeState([]), 'channel2')).toBeNull();
    });
});
