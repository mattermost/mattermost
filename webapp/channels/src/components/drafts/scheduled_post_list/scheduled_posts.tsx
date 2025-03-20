// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef} from 'react';

import type {ScheduledPost} from '@mattermost/types/schedule_post';
import type {UserStatus} from '@mattermost/types/users';

import type {UserProfile} from 'components/suggestion/command_provider/app_command_parser/app_command_parser_dependencies';

import {useQuery} from 'utils/http_utils';

import DraftRow from '../draft_row';

interface Props {
    scheduledPosts: ScheduledPost[];
    user: UserProfile;
    displayName: string;
    status: UserStatus['status'];
}

export default function ScheduledPosts(props: Props) {
    const query = useQuery();
    const targetId = query.get('target_id');
    const targetScheduledPostId = useRef<string>();

    if (props.scheduledPosts.length === 0) {
        return null;
    }

    return (
        <>
            {props.scheduledPosts.map((scheduledPost) => {
            // find the first scheduled posst with the target and no error
                const isInTargetChannelOrThread = scheduledPost.channel_id === targetId || scheduledPost.root_id === targetId;
                const hasError = Boolean(scheduledPost.error_code);
                const scrollIntoView = !targetScheduledPostId.current && isInTargetChannelOrThread && !hasError;
                if (scrollIntoView) {
                // if found, save the scheduled post's ID
                    targetScheduledPostId.current = scheduledPost.id;
                }

                return (
                    <DraftRow
                        key={scheduledPost.id}
                        item={scheduledPost}
                        displayName={props.displayName}
                        status={props.status}
                        user={props.user}
                        scrollIntoView={targetScheduledPostId.current === scheduledPost.id} // scroll into view if this is the target scheduled post
                    />
                );
            })}
        </>
    );
}
