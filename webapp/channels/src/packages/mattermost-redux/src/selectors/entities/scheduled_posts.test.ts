// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ScheduledPost} from '@mattermost/types/schedule_post';
import type {GlobalState} from '@mattermost/types/store';

import {getScheduledPostTeamId, isRecurringScheduledPostsEnabled} from './scheduled_posts';

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
