// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useDispatch} from 'react-redux';

import type {ScheduledPost} from '@mattermost/types/schedule_post';
import type {UserProfile, UserStatus} from '@mattermost/types/users';

import {fetchMissingChannels} from 'mattermost-redux/actions/channels';

import './style.scss';
import EmptyScheduledPostList from './empty_scheduled_post_list';
import ScheduledPostError from './scheduled_post_error';
import ScheduledPosts from './scheduled_posts';

type Props = {
    scheduledPosts: ScheduledPost[];
    user: UserProfile;
    displayName: string;
    status: UserStatus['status'];
};

export default function ScheduledPostList({
    scheduledPosts,
    user,
    displayName,
    status,
}: Props) {
    const dispatch = useDispatch();

    useEffect(() => {
        dispatch(fetchMissingChannels(scheduledPosts.map((post) => post.channel_id)));
    }, [dispatch, scheduledPosts]);

    return (
        <div className='ScheduledPostList'>
            <ScheduledPostError/>
            <EmptyScheduledPostList scheduledPostsCount={scheduledPosts.length}/>
            <ScheduledPosts
                scheduledPosts={scheduledPosts}
                user={user}
                displayName={displayName}
                status={status}
            />
        </div>
    );
}
