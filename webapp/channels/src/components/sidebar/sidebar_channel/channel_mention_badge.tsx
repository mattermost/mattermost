// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

type Props = {
    unreadMentions: number;
    hasUrgent?: boolean;
    icon?: React.ReactNode;
};

export default function ChannelMentionBadge({unreadMentions, hasUrgent, icon}: Props) {
    if (unreadMentions > 0) {
        return (
            <span
                id='unreadMentions'
                className={classNames({badge: true, urgent: hasUrgent})}
            >
                {icon}
                {unreadMentions}
            </span>
        );
    }

    return null;
}
