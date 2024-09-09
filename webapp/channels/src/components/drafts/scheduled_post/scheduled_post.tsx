// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ScheduledPost} from '@mattermost/types/schedule_post';

type Props = {
    scheduledPost: ScheduledPost;
}

export default function ScheduledPostItem({scheduledPost}: Props) {
    return (
        <div>
            {scheduledPost.message}
        </div>
    );
}
