// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.


import type {PostDraft} from 'types/store/draft';

export type PostScheduledPost = PostDraft & {
    // use ScheduleInfo instead of duplicating below mentioned fields
    id: string;
    scheduled_at: string;
    processed_at?: string;
    error_code?: string;
};
