// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {START_OF_NEW_MESSAGES} from 'mattermost-redux/utils/post_list';

import NotificationSeparator from 'components/widgets/separator/notification-separator';

import type {GlobalState} from 'types/store';

type Props = {
    lastViewedAt: number;
    channelId?: string;
    threadId?: string;
}

const NewMessageSeparator = ({
    lastViewedAt,
    channelId,
    threadId,
}: Props) => {
    const actions = useSelector((state: GlobalState) => state.plugins.components.NewMessagesSeparatorAction);
    const pluginItems = actions?.
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
        <div className='new-separator'>
            <NotificationSeparator id={START_OF_NEW_MESSAGES}>
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
