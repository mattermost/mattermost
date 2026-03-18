// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {ScheduledPost} from '@mattermost/types/schedule_post';
import type {UserProfile, UserStatus} from '@mattermost/types/users';

import {fetchMissingChannels} from 'mattermost-redux/actions/channels';
import {hasScheduledPostError} from 'mattermost-redux/selectors/entities/scheduled_posts';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import type {GlobalState} from 'types/store';

import EmptyScheduledPostList from './empty_scheduled_post_list';
import NonVirtualizedScheduledPostList from './non_virtualized_scheduled_post_list';
import ScheduledPostError from './scheduled_post_error';

import './scheduled_post_list.scss';

type Props = {
    scheduledPosts: ScheduledPost[];
    currentUser: UserProfile;
    userDisplayName: string;
    userStatus: UserStatus['status'];
};

export default function ScheduledPostList(props: Props) {
    const dispatch = useDispatch();

    const currentTeamId = useSelector(getCurrentTeamId);

    const scheduledPostsHasError = useSelector((state: GlobalState) => hasScheduledPostError(state, currentTeamId));

    useEffect(() => {
        if (props.scheduledPosts.length > 0) {
            dispatch(fetchMissingChannels(props.scheduledPosts.map((post) => post.channel_id)));
        }
    }, [dispatch, props.scheduledPosts]);

    if (props.scheduledPosts.length === 0) {
        return (
            <EmptyScheduledPostList/>
        );
    }

    return (
        <div className='ScheduledPostList nonVirtualizedScheduledPostList'>
            {scheduledPostsHasError && (<ScheduledPostError/>)}

            <NonVirtualizedScheduledPostList
                scheduledPosts={props.scheduledPosts}
                currentUser={props.currentUser}
                userDisplayName={props.userDisplayName}
                userStatus={props.userStatus}
            />
        </div>
    );
}
