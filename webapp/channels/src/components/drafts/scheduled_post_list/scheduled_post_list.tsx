// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import fetchTeamScheduledPosts from 'actions/schedule_message';
import {getScheduledPostsByTeam} from 'selectors/scheduled_posts';

import type {GlobalState} from 'types/store';

export default function ScheduledPostList() {
    const dispatch = useDispatch();
    const currentTeamId = useSelector(getCurrentTeamId);
    const scheduledPosts = useSelector((state: GlobalState) => getScheduledPostsByTeam(state, currentTeamId, true));

    useEffect(() => {
        dispatch(fetchTeamScheduledPosts(currentTeamId, true));
    }, [currentTeamId, dispatch]);

    return (
        <div className='harshil'>
            <h1>{`Scheduled Posts Count: ${scheduledPosts?.length}`}</h1>
        </div>
    );
}
