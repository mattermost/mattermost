// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router-dom';

import type {ChannelScheduledPostIndicatorData} from 'mattermost-redux/selectors/entities/scheduled_posts';

type Props = {
    scheduledPostData: ChannelScheduledPostIndicatorData;
    scheduledPostLinkURL: string;
}

export function ShortScheduledPostIndicator({scheduledPostData, scheduledPostLinkURL}: Props) {
    if (scheduledPostData.count === 0) {
        return null;
    }

    return (
        <div className='ScheduledPostIndicator'>
            <FormattedMessage
                id='scheduled_post.channel_indicator.with_other_user_late_time'
                defaultMessage='You have {count, plural, =1 {one} other {#}} <a>scheduled {count, plural, =1 {message} other {messages}}</a>.'
                values={{
                    count: scheduledPostData.count,
                    a: (chunks) => (
                        <Link to={scheduledPostLinkURL}>
                            {chunks}
                        </Link>
                    ),
                }}
            />
        </div>
    );
}
