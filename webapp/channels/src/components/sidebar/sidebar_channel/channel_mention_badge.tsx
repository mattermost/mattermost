// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {MessageDescriptor} from 'react-intl';

import {WithTooltip} from '@mattermost/shared/components/tooltip';

type Props = {
    unreadMentions: number;
    hasUrgent?: boolean;
    icon?: React.ReactNode;
    className?: string;
    tooltip?: MessageDescriptor;
    'data-testid'?: string;
};

export default function ChannelMentionBadge({unreadMentions, hasUrgent, icon, className, tooltip, 'data-testid': dataTestId}: Props) {
    if (unreadMentions > 0) {
        const badge = (
            <span
                id='unreadMentions'
                className={classNames({badge: true, urgent: hasUrgent}, className)}
                data-testid={dataTestId}
            >
                {icon}
                <span className='unreadMentions'>
                    {unreadMentions}
                </span>
            </span>
        );

        if (tooltip) {
            return (
                <WithTooltip title={tooltip}>
                    {badge}
                </WithTooltip>
            );
        }

        return badge;
    }

    return null;
}
