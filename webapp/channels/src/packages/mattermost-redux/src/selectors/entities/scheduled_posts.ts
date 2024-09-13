// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ScheduledPost} from '@mattermost/types/schedule_post';
import type {GlobalState} from '@mattermost/types/store';

export function getScheduledPostsByTeam(state: GlobalState, teamId: string, includeDirectChannels: boolean): ScheduledPost[] {
    const teamScheduledPosts = state.entities.scheduledPosts.byTeamId[teamId] || [];
    let directChannelScheduledPosts: ScheduledPost[] = [];

    if (includeDirectChannels) {
        directChannelScheduledPosts = state.entities.scheduledPosts.byTeamId.directChannels || [];
    }

    return [...teamScheduledPosts, ...directChannelScheduledPosts];
}
