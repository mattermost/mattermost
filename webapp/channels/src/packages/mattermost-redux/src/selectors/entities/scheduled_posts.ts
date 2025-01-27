// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ClientLicense, ClientConfig} from '@mattermost/types/config';
import type {ScheduledPost, ScheduledPostsState} from '@mattermost/types/schedule_post';
import type {GlobalState} from '@mattermost/types/store';

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';

const emptyList: string[] = [];

export type ChannelScheduledPostIndicatorData = {
    scheduledPost?: ScheduledPost;
    count: number;
}

export function makeGetScheduledPostsByTeam(): (state: GlobalState, teamId: string, includeDirectChannels: boolean) => ScheduledPost[] {
    return createSelector(
        'makeGetScheduledPostsByTeam',
        (state: GlobalState) => state.entities.scheduledPosts.byId,
        (state: GlobalState, teamId: string, includeDirectChannels: boolean) => includeDirectChannels,
        (state: GlobalState, teamId: string) => state.entities.scheduledPosts.byTeamId[teamId] || emptyList,
        (state: GlobalState) => state.entities.scheduledPosts.byTeamId.directChannels || emptyList,
        (scheduledPostsById: ScheduledPostsState['byId'], includeDirectChannels: boolean, teamScheduledPostsIDs: string[], directChannelScheduledPostsIDs: string[]) => {
            const scheduledPosts: ScheduledPost[] = [];

            const extractor = (scheduledPostId: string) => {
                const scheduledPost = scheduledPostsById[scheduledPostId];
                if (scheduledPost) {
                    scheduledPosts.push(scheduledPost);
                }
            };

            teamScheduledPostsIDs.forEach(extractor);

            if (includeDirectChannels) {
                directChannelScheduledPostsIDs.forEach(extractor);
            }

            // Most recently upcoming post shows up first.
            scheduledPosts.sort((a, b) => a.scheduled_at - b.scheduled_at || a.create_at - b.create_at);

            return scheduledPosts;
        },
    );
}

export function getScheduledPostsByTeamCount(state: GlobalState, teamId: string, includeDirectChannels: boolean) {
    let count = state.entities.scheduledPosts.byTeamId[teamId]?.length || 0;
    if (includeDirectChannels) {
        count += (state.entities.scheduledPosts.byTeamId.directChannels?.length || 0);
    }

    return count;
}

export function hasScheduledPostError(state: GlobalState, teamId: string) {
    return state.entities.scheduledPosts.errorsByTeamId[teamId]?.length > 0 || state.entities.scheduledPosts.errorsByTeamId.directChannels?.length > 0;
}

export function showChannelOrThreadScheduledPostIndicator(state: GlobalState, channelOrThreadId: string): ChannelScheduledPostIndicatorData {
    const allChannelScheduledPosts = state.entities.scheduledPosts.byChannelOrThreadId[channelOrThreadId] || emptyList;
    const eligibleScheduledPosts = allChannelScheduledPosts.filter((scheduledPostId: string) => {
        const scheduledPost = state.entities.scheduledPosts.byId[scheduledPostId];
        return !scheduledPost?.error_code;
    });

    const data = {
        count: eligibleScheduledPosts.length,
    } as ChannelScheduledPostIndicatorData;

    if (data.count === 1) {
        const scheduledPostId = eligibleScheduledPosts[0];
        data.scheduledPost = state.entities.scheduledPosts.byId[scheduledPostId];
    }

    return data;
}

export const isScheduledPostsEnabled: (a: GlobalState) => boolean = createSelector(
    'isScheduledPostsEnabled',
    getConfig,
    getLicense,
    (config: Partial<ClientConfig>, license: ClientLicense): boolean => {
        return config.ScheduledPosts === 'true' && license.IsLicensed === 'true';
    },
);
