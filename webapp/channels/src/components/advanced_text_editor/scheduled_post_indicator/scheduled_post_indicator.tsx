// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';
import {type match} from 'react-router-dom';

import {showChannelScheduledPostIndicator} from 'mattermost-redux/selectors/entities/scheduled_posts';

import './scheduled_post_indicator.scss';

import type {GlobalState} from 'types/store';

import {NavLink, useRouteMatch} from 'react-router-dom';

type Props = {
    channelId: string;
}

export default function ScheduledPostIndicator({channelId}: Props) {
    const scheduledPostData = useSelector((state: GlobalState) => showChannelScheduledPostIndicator(state, channelId));
    const match: match<{team: string}> = useRouteMatch();

    const link = useMemo(() => (
        <NavLink to={`/${match.params.team}/scheduled_posts`}>
            <FormattedMessage
                id='scheduled_post.channel_indicator.link_to_scheduled_posts.text'
                defaultMessage='See all scheduled messages'
            />
        </NavLink>
    ), [match]);

    if (scheduledPostData.count > 1) {
        return (
            <div className='ScheduledPostIndicator'>
                <i
                    data-testid='scheduledPostIcon'
                    className='icon icon-draft-indicator icon-clock-send-outline'
                />
                <FormattedMessage
                    id='scheduled_post.channel_indicator.multiple'
                    defaultMessage='You have {count} scheduled messages.'
                    values={{
                        count: scheduledPostData.count,
                    }}
                />

                {link}
            </div>
        );
    }
    return (null);
}
