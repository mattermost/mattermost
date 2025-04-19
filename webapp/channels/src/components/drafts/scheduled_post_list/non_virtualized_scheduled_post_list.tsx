// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useRef} from 'react';

import type {ScheduledPost} from '@mattermost/types/schedule_post';
import type {UserProfile, UserStatus} from '@mattermost/types/users';

import DraftRow from 'components/drafts/draft_row';

import {useQuery} from 'utils/http_utils';

type Props = {
    scheduledPosts: ScheduledPost[];
    currentUser: UserProfile;
    userDisplayName: string;
    userStatus: UserStatus['status'];
}

export default function NonVirtualizedScheduledPostList(props: Props) {
    const query = useQuery();
    const targetId = query.get('target_id');
    const targetScheduledPostId = useRef<string>();

    return (
        <>
            {
                props.scheduledPosts.map((scheduledPost, index) => {
                    // find the first scheduled posst with the target and no error
                    const isInTargetChannelOrThread = scheduledPost.channel_id === targetId || scheduledPost.root_id === targetId;
                    const hasError = Boolean(scheduledPost.error_code);
                    const scrollIntoView = !targetScheduledPostId.current && (isInTargetChannelOrThread && !hasError);
                    if (scrollIntoView) {
                        // if found, save the scheduled post's ID
                        targetScheduledPostId.current = scheduledPost.id;
                    }

                    return (
                        <DraftRow
                            key={scheduledPost.id}
                            item={scheduledPost}
                            displayName={props.userDisplayName}
                            status={props.userStatus}
                            user={props.currentUser}
                            scrollIntoView={targetScheduledPostId.current === scheduledPost.id} // scroll into view if this is the target scheduled post
                            containerClassName={classNames('nonVirtualizedScheduledPostRow', {firstRow: index === 0})}
                        />
                    );
                })
            }
        </>
    );
}
