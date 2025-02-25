// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import WithTooltip from 'components/with_tooltip';

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

    const tooltipText = (
        <FormattedMessage
            id='scheduled_posts.row_title_thread.placeholder_tooltip'
            defaultMessage={'The channel either doesn’t exist or you do not have access to it.'}
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

    return (
        <WithTooltip
            title={tooltipText}
        >
            <div>
                {title}
            </div>
        </WithTooltip>
    );
}
