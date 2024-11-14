// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';
import {Link} from 'react-router-dom';

import {showChannelOrThreadScheduledPostIndicator} from 'mattermost-redux/selectors/entities/scheduled_posts';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {
    ShortScheduledPostIndicator,
} from 'components/advanced_text_editor/scheduled_post_indicator/short_scheduled_post_indicator';
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
    const isThread = location === Locations.RHS_COMMENT;
    const id = isThread ? postId : channelId;
    const scheduledPostData = useSelector((state: GlobalState) => showChannelOrThreadScheduledPostIndicator(state, id));

    const currentTeamName = useSelector((state: GlobalState) => getCurrentTeam(state)?.name);
    const scheduledPostLinkURL = `/${currentTeamName}/scheduled_posts?target_id=${id}`;

    if (!scheduledPostData?.count) {
        return null;
    }

    if (remoteUserHourDisplayed) {
        return (
            <ShortScheduledPostIndicator
                scheduledPostData={scheduledPostData}
                scheduledPostLinkURL={scheduledPostLinkURL}
            />
        );
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
        scheduledPostText = isThread ? (
            <FormattedMessage
                id='scheduled_post.channel_indicator.multiple_in_thread'
                defaultMessage='{count} scheduled messages in thread.'
                values={{
                    count: scheduledPostData.count,
                }}
            />
        ) : (
            <FormattedMessage
                id='scheduled_post.channel_indicator.multiple_in_channel'
                defaultMessage='{count} scheduled messages in channel.'
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
            <Link to={scheduledPostLinkURL}>
                <FormattedMessage
                    id='scheduled_post.channel_indicator.link_to_scheduled_posts.text'
                    defaultMessage='See all.'
                />
            </Link>
        </div>
    );
}
