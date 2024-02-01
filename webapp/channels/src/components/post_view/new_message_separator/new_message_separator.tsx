// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {FormattedMessage} from 'react-intl';

import NotificationSeparator from 'components/widgets/separator/notification-separator';

import type {PluginComponent} from 'types/store/plugins';

type Props = {
    separatorId: string;
    wrapperRef?: React.RefObject<HTMLDivElement>;
    newMessagesSeparatorActions: PluginComponent[];
    lastViewedAt: number;
    channelId?: string;
    threadId?: string;
}

const NewMessageSeparator = ({
    newMessagesSeparatorActions,
    lastViewedAt,
    channelId,
    threadId,
    wrapperRef,
    separatorId,
}: Props) => {
    const pluginItems = newMessagesSeparatorActions?.
        map((item) => {
            if (!item.component) {
                return null;
            }

            const Component = item.component as any;
            return (
                <Component
                    key={item.id}
                    lastViewedAt={lastViewedAt}
                    channelId={channelId}
                    threadId={threadId}
                />
            );
        });

    return (
        <div
            ref={wrapperRef}
            className='new-separator'
        >
            <NotificationSeparator id={separatorId}>
                <FormattedMessage
                    id='posts_view.newMsg'
                    defaultMessage='New Messages'
                />
                {pluginItems}
            </NotificationSeparator>
        </div>
    );
};

export default memo(NewMessageSeparator);
