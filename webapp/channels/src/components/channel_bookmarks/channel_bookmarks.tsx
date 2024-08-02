// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import BookmarkItem from './bookmark_item';
import PlusMenu from './channel_bookmarks_plus_menu';
import {useChannelBookmarkPermission, useChannelBookmarks, MAX_BOOKMARKS_PER_CHANNEL, useCanUploadFiles} from './utils';

import './channel_bookmarks.scss';

type Props = {
    channelId: string;
};

const ChannelBookmarks = ({
    channelId,
}: Props) => {
    const {order, bookmarks} = useChannelBookmarks(channelId);
    const canUploadFiles = useCanUploadFiles();
    const canAdd = useChannelBookmarkPermission(channelId, 'add');
    const hasBookmarks = Boolean(order?.length);

    if (!hasBookmarks && !canAdd) {
        return null;
    }

    return (
        <Container data-testid='channel-bookmarks-container'>
            {order.map((id) => {
                return (
                    <BookmarkItem
                        key={id}
                        bookmark={bookmarks[id]}
                    />
                );
            })}
            {canAdd && (
                <PlusMenu
                    channelId={channelId}
                    hasBookmarks={hasBookmarks}
                    limitReached={order.length >= MAX_BOOKMARKS_PER_CHANNEL}
                    canUploadFiles={canUploadFiles}
                />
            )}
        </Container>
    );
};

export default ChannelBookmarks;

const Container = styled.div`
    display: flex;
    padding: 8px 6px;
    padding-right: 0;
    align-items: center;
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.12);
    overflow-x: auto;
    overflow-y: hidden;
    overflow-y: clip;
`;
