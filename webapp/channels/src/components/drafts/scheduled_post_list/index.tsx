// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import fetchTeamScheduledPosts from 'actions/schedule_message';

type Props = {

}

export default function ScheduledPostList({}: Props) {
    const dispatch = useDispatch();
    const currentTeamId = useSelector(getCurrentTeamId);
    // const scheduledPosts = useSelector()

    useEffect(() => {
        dispatch(fetchTeamScheduledPosts(currentTeamId));
    }, [currentTeamId, dispatch]);

    return (
        <div className='harshil'>
            <h1>{'Harshil'}</h1>
        </div>
    );
}
