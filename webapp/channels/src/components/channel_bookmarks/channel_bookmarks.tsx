// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import BookmarkItem from './bookmark_item';
import PlusMenu from './channel_bookmarks_plus_menu';
import {useChannelBookmarks, useIsChannelBookmarksEnabled} from './utils';

import './menu_buttons.scss';

type Props = {
    channelId: string;
}

const ChannelBookmarks = ({
    channelId,
}: Props) => {
    const show = useIsChannelBookmarksEnabled();
    const {order} = useChannelBookmarks(channelId);

    if (!show) {
        return null;
    }

    return (
        <Container>
            {order.map((id) => {
                return (
                    <BookmarkItem
                        key={id}
                        id={id}
                        channelId={channelId}
                    />
                );
            })}
            <PlusMenu
                channelId={channelId}
                hasBookmarks={Boolean(order?.length)}
            />
        </Container>
    );
};

export default ChannelBookmarks;

const Container = styled.div`
    display: flex;
    padding: 6px;
    align-items: center;
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.12);
    overflow-x: auto;
    overflow-y: hidden;
    overflow-y: clip;
`;
