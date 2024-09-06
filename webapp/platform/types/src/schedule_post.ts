// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Draft} from './drafts';

export type SchedulingInfo = {
    scheduled_at: number;
    processed_at?: number;
    error_code?: string;
}

export type ScheduledPost = Omit<Draft, 'delete_at'> & SchedulingInfo & {
    id: string;
}

export type ScheduledPostsState = {
    byTeamId: {[teamId: string]: ScheduledPost[]};
}
