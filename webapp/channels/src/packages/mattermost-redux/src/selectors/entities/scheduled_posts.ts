// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ScheduledPost} from '@mattermost/types/schedule_post';
import type {GlobalState} from '@mattermost/types/store';

import {createSelector} from 'mattermost-redux/selectors/create_selector';

export function makeGetScheduledPostsByTeam(): (state: GlobalState, teamId: string, includeDirectChannels: boolean) => ScheduledPost[] {
    return createSelector(
        'makeGetScheduledPostsByTeam',
        (state: GlobalState, teamId: string, includeDirectChannels: boolean) => includeDirectChannels,
        (state: GlobalState, teamId: string) => state.entities.scheduledPosts.byTeamId[teamId],
        (state: GlobalState) => state.entities.scheduledPosts.byTeamId.directChannels,
        (includeDirectChannels: boolean, teamScheduledPosts: ScheduledPost[], directChannelScheduledPosts: ScheduledPost[]) => {
            const team = teamScheduledPosts || [];
            const direct = directChannelScheduledPosts || [];
            if (!includeDirectChannels) {
                return team;
            }

            return [...team, ...direct];
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
    console.log('hasScheduledPostError called');
    let hasError = (state.entities.scheduledPosts.byTeamId[teamId] || []).some((scheduledPost) => scheduledPost.error_code !== '');
    if (!hasError) {
        hasError = (state.entities.scheduledPosts.byTeamId.directChannels || []).some((scheduledPost) => scheduledPost.error_code !== '');
    }

    return hasError;
}
