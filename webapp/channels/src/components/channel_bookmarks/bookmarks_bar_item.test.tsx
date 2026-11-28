// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import BookmarksBarItem from './bookmarks_bar_item';

const bookmark = {
    id: 'bm1',
    channel_id: 'c1',
    owner_id: 'u1',
    type: 'link',
    link_url: 'https://example.com/page',
    display_name: 'Example',
    sort_order: 0,
    create_at: 0,
    update_at: 0,
    delete_at: 0,
} as ChannelBookmark;

describe('components/channel_bookmarks/bookmarks_bar_item', () => {
    const renderItem = (hidden: boolean) => renderWithContext(
        <BookmarksBarItem
            id={bookmark.id}
            bookmark={bookmark}
            disabled={true}
            isDraggingGlobal={false}
            hidden={hidden}
        />,
    );

    test('a visible item is keyed by bookmark id, with its link, icon and menu button inside', () => {
        renderItem(false);

        const item = screen.getByTestId('channel_bookmarks.bookmark:bm1');
        expect(item).toContainElement(screen.getByTestId('channel_bookmarks.bookmark.open--link'));
        expect(screen.getByTestId('channel_bookmarks.bookmark.open--link')).toHaveTextContent('Example');
        expect(item).toContainElement(screen.getByTestId('channel_bookmarks.bookmark.icon'));
        expect(item).toContainElement(screen.getByTestId('channel_bookmarks.bookmark.open_menu--button'));
    });

    test('the hidden copy kept for overflow measuring has no testid', () => {
        const {container} = renderItem(true);

        expect(container.querySelector('[data-bookmark-id="bm1"]')).toBeInTheDocument();
        expect(screen.queryByTestId('channel_bookmarks.bookmark:bm1')).not.toBeInTheDocument();
    });
});
