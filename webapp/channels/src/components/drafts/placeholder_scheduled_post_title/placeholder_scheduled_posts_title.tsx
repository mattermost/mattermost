// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

type Props = {
    type: 'channel' | 'thread';
}

export default function PlaceholderScheduledPostsTitle({type}: Props) {
    let title;

    const icon = (
        <i
            className='icon icon-pencil-outline'
        />
    );

    if (type === 'thread') {
        title = (
            <FormattedMessage
                id='scheduled_posts.row_title_thread.placeholder'
                defaultMessage={'Thread to: {icon} No Destination'}
                values={{
                    icon,
                }}
            />
        );
    } else {
        title = (
            <FormattedMessage
                id='scheduled_posts.row_title_channel.placeholder'
                defaultMessage={'In: {icon} No Destination'}
                values={{
                    icon,
                }}
            />
        );
    }

    return title;
}
