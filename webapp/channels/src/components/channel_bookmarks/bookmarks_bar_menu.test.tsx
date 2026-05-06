// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';

import {renderWithContext} from 'tests/react_testing_utils';

import BookmarksBarMenu from './bookmarks_bar_menu';

const mockDropTargetForElements: jest.Mock = jest.fn(() => () => undefined);

jest.mock('@atlaskit/pragmatic-drag-and-drop/element/adapter', () => ({
    dropTargetForElements: (arg: unknown) => mockDropTargetForElements(arg),
}));

function makeBookmark(id: string): ChannelBookmark {
    return {
        id,
        channel_id: 'c1',
        owner_id: 'u1',
        type: 'link',
        link_url: 'https://example.com',
        display_name: `bm-${id}`,
        sort_order: 0,
        create_at: 0,
        update_at: 0,
        delete_at: 0,
    } as ChannelBookmark;
}

const baseProps = {
    channelId: 'c1',
    bookmarks: {} as Record<string, ChannelBookmark>,
    hasBookmarks: true,
    limitReached: false,
    canUploadFiles: true,
    canReorder: true,
    isDragging: false,
    canAdd: true,
};

type DropTargetConfig = {
    canDrop: (args: {source: {data: Record<string, unknown>}}) => boolean;
    getData: () => Record<string, unknown>;
};

describe('BookmarksBarMenu — overflow drop target', () => {
    beforeEach(() => {
        mockDropTargetForElements.mockClear();
    });

    test('canDrop returns false when there is no overflow', () => {
        renderWithContext(
            <BookmarksBarMenu
                {...baseProps}
                overflowItems={[]}
            />,
        );

        expect(mockDropTargetForElements).toHaveBeenCalledTimes(1);
        const config = mockDropTargetForElements.mock.calls[0][0] as unknown as DropTargetConfig;
        expect(config.getData()).toEqual({type: 'overflow-trigger'});
        expect(config.canDrop({source: {data: {type: 'bookmark'}}})).toBe(false);
    });

    test('canDrop returns true for bookmark sources when overflow items exist', () => {
        const overflowItems = ['a', 'b'];
        const bookmarks = {a: makeBookmark('a'), b: makeBookmark('b')};

        renderWithContext(
            <BookmarksBarMenu
                {...baseProps}
                overflowItems={overflowItems}
                bookmarks={bookmarks}
            />,
        );

        expect(mockDropTargetForElements).toHaveBeenCalledTimes(1);
        const config = mockDropTargetForElements.mock.calls[0][0] as unknown as DropTargetConfig;
        expect(config.canDrop({source: {data: {type: 'bookmark'}}})).toBe(true);
    });

    test('canDrop returns false for non-bookmark sources even with overflow', () => {
        const overflowItems = ['a'];
        const bookmarks = {a: makeBookmark('a')};

        renderWithContext(
            <BookmarksBarMenu
                {...baseProps}
                overflowItems={overflowItems}
                bookmarks={bookmarks}
            />,
        );

        const config = mockDropTargetForElements.mock.calls[0][0] as unknown as DropTargetConfig;
        expect(config.canDrop({source: {data: {type: 'something-else'}}})).toBe(false);
    });
});
