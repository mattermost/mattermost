// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {FormattedMessage} from 'react-intl';

import * as PostList from 'mattermost-redux/utils/post_list';

import PostSeparator from 'design_system/components/patterns/post_separator';

import type {NewMessagesSeparatorActionComponent} from 'types/store/plugins';

import './index.scss';

type Props = {
    separatorId: string;
    wrapperRef?: React.RefObject<HTMLDivElement>;
    newMessagesSeparatorActions: NewMessagesSeparatorActionComponent[];
    channelId?: string;
    threadId?: string;
}

const NewMessageSeparator = ({
    newMessagesSeparatorActions,
    channelId,
    threadId,
    wrapperRef,
    separatorId,
}: Props) => {
    const lastViewedAt = PostList.getTimestampForStartOfNewMessages(separatorId);

    const pluginItems = newMessagesSeparatorActions?.
        map((item) => {
            if (!item.component) {
                return null;
            }

            const Component = item.component;
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
            <PostSeparator
                className='NotificationSeparator'
                testId='NotificationSeparator'
            >
                <FormattedMessage
                    id='posts_view.newMsg'
                    defaultMessage='New Messages'
                />
                {pluginItems}
            </PostSeparator>
        </div>
    );
};

export default memo(NewMessageSeparator);
