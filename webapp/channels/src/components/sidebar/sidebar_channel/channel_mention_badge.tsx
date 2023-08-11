// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import classNames from 'classnames';

type Props = {
    unreadMentions: number;
    hasUrgent?: boolean;
};

export default function ChannelMentionBadge({unreadMentions, hasUrgent}: Props) {
    if (unreadMentions > 0) {
        return (
            <span
                id='unreadMentions'
                className={classNames({badge: true, urgent: hasUrgent})}
            >
                {unreadMentions}
            </span>
        );
    }

    return null;
}
