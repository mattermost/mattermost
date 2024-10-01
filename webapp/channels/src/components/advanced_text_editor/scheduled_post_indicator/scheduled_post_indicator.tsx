// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';
import {type match} from 'react-router-dom';
import {NavLink, useRouteMatch} from 'react-router-dom';

import {showChannelOrThreadScheduledPostIndicator} from 'mattermost-redux/selectors/entities/scheduled_posts';

import {SCHEDULED_POST_TIME_RANGES, scheduledPostTimeFormat} from 'components/drafts/panel/panel_header';
import Timestamp from 'components/timestamp';

import {Locations} from 'utils/constants';

import type {GlobalState} from 'types/store';

import './scheduled_post_indicator.scss';

type Props = {
    location: string;
    channelId: string;
    postId: string;
    remoteUserHourDisplayed?: boolean;
}

export default function ScheduledPostIndicator({location, channelId, postId, remoteUserHourDisplayed}: Props) {
    // we use RHS_COMMENT for RHS and threads view, and CENTER for center channel.
    // get scheduled posts of a thread if in RHS or threads view,
    // else, get those for the channel.
    // Fetch scheduled posts for the thread when opening a thread, and fetch for channel
    // when opening from center channel.
    const id = location === Locations.RHS_COMMENT ? postId : channelId;
    const scheduledPostData = useSelector((state: GlobalState) => showChannelOrThreadScheduledPostIndicator(state, id));
    const match: match<{team: string}> = useRouteMatch();

    const link = useMemo(() => (
        <NavLink to={`/${match.params.team}/scheduled_posts`}>
            <FormattedMessage
                id='scheduled_post.channel_indicator.link_to_scheduled_posts.text'
                defaultMessage='See all scheduled messages'
            />
        </NavLink>
    ), [match]);

    if (!scheduledPostData || scheduledPostData.count === 0) {
        return null;
    }

    let scheduledPostText: React.ReactNode;

    // display scheduled post's details of there is only one scheduled post
    if (scheduledPostData.count === 1 && scheduledPostData.scheduledPost) {
        scheduledPostText = (
            <FormattedMessage
                id='scheduled_post.channel_indicator.single'
                defaultMessage='Message scheduled for {dateTime}.'
                values={{
                    dateTime: (
                        <Timestamp
                            value={scheduledPostData.scheduledPost.scheduled_at}
                            ranges={SCHEDULED_POST_TIME_RANGES}
                            useSemanticOutput={false}
                            useTime={scheduledPostTimeFormat}
                        />
                    ),
                }}
            />
        );
    }

    // display scheduled post count if there are more than one scheduled post
    if (scheduledPostData.count > 1) {
        scheduledPostText = (
            <FormattedMessage
                id='scheduled_post.channel_indicator.multiple'
                defaultMessage='You have {count} scheduled messages.'
                values={{
                    count: scheduledPostData.count,
                }}
            />
        );
    }

    return (
        <div className='ScheduledPostIndicator'>
            <i
                data-testid='scheduledPostIcon'
                className='icon icon-draft-indicator icon-clock-send-outline'
            />
            {scheduledPostText}
            {link}
        </div>
    );
}
