// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ScheduledPost} from '@mattermost/types/schedule_post';
import type {GlobalState} from '@mattermost/types/store';

import {createSelector} from 'mattermost-redux/selectors/create_selector';

export type ChannelScheduledPostIndicatorData = {
    scheduledPost?: ScheduledPost;
    count: number;
}

export function makeGetScheduledPostsByTeam(): (state: GlobalState, teamId: string, includeDirectChannels: boolean) => ScheduledPost[] {
    return createSelector(
        'makeGetScheduledPostsByTeam',
        (state: GlobalState) => state,
        (state: GlobalState, teamId: string, includeDirectChannels: boolean) => includeDirectChannels,
        (state: GlobalState, teamId: string) => state.entities.scheduledPosts.byTeamId[teamId],
        (state: GlobalState) => state.entities.scheduledPosts.byTeamId.directChannels,
        (state: GlobalState, includeDirectChannels: boolean, teamScheduledPostsIDs: string[], directChannelScheduledPostsIDs: string[]) => {
            const scheduledPosts: ScheduledPost[] = [];

            const extractor = (scheduledPostId: string) => {
                const scheduledPost = state.entities.scheduledPosts.byId[scheduledPostId];
                if (scheduledPost) {
                    scheduledPosts.push(scheduledPost);
                }
            };

            teamScheduledPostsIDs.forEach(extractor);

            if (includeDirectChannels) {
                directChannelScheduledPostsIDs.forEach(extractor);
            }

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

export function showChannelScheduledPostIndicator(state: GlobalState, channelId: string): ChannelScheduledPostIndicatorData {
    const data = {} as ChannelScheduledPostIndicatorData;
    const channelScheduledPosts = state.entities.scheduledPosts.byChannelId[channelId] || [];

    if (channelScheduledPosts.length === 0) {
        data.count = 0;
    } else if (channelScheduledPosts.length === 1) {
        const scheduledPostId = channelScheduledPosts[0];
        data.scheduledPost = state.entities.scheduledPosts.byId[scheduledPostId];
        data.count = 1;
    } else {
        data.count = channelScheduledPosts.length;
    }

    return data;
}
