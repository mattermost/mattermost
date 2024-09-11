// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ScheduledPost} from '@mattermost/types/schedule_post';

import type {GlobalState} from 'types/store';

export function getScheduledPostsByTeam(state: GlobalState, teamId: string, includeDirectChannels: boolean) {
    const teamScheduledPosts = state.views.scheduledPosts.byTeamId[teamId] || [];
    let directChannelScheduledPosts: ScheduledPost[] = [];

    if (includeDirectChannels) {
        directChannelScheduledPosts = state.views.scheduledPosts.byTeamId.directChannels || [];
    }

    return [...teamScheduledPosts, ...directChannelScheduledPosts];
}
