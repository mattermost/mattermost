// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';

import {MAX_BOOKMARKS_PER_CHANNEL} from 'components/channel_bookmarks/utils';
import {WithTestMenuContext} from 'components/menu/menu_context_test';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ChannelBookmarksSubmenu from './channel_bookmarks_submenu';

jest.mock('components/channel_bookmarks/utils', () => {
    const actual = jest.requireActual('components/channel_bookmarks/utils');
    return {
        ...actual,
        useChannelBookmarkPermission: () => true,
        useCanUploadFiles: () => true,
    };
});

jest.mock('components/channel_bookmarks/channel_bookmarks_menu', () => ({
    useBookmarkAddActions: () => ({
        handleCreateLink: jest.fn(),
        handleCreateFile: jest.fn(),
    }),
}));

function pluginState(bookmarkCount: number) {
    const bookmarks: Record<string, ChannelBookmark> = {};
    for (let i = 0; i < bookmarkCount; i++) {
        const id = `b${i}`;
        bookmarks[id] = {id} as ChannelBookmark;
    }
    return {
        entities: {
            channelBookmarks: {
                byChannelId: {
                    c1: bookmarks,
                },
            },
        },
        plugins: {
            components: {
                ChannelBookmarksMenu: [{
                    id: 'artifacts',
                    pluginId: 'ai',
                    text: 'Add channel artifact',
                    action,
                    icon: <i className='icon'/>,
                }],
            },
        },
    };
}

const action = jest.fn();

describe('ChannelBookmarksSubmenu plugin items', () => {
    const channel = TestHelper.getChannelMock({id: 'c1'});

    beforeEach(() => {
        action.mockClear();
    });

    async function openPluginItem(bookmarkCount: number) {
        renderWithContext(
            <WithTestMenuContext>
                <ChannelBookmarksSubmenu channel={channel}/>
            </WithTestMenuContext>,
            pluginState(bookmarkCount),
        );
        await userEvent.hover(screen.getByText('Bookmarks Bar'));
        return screen.getByRole('menuitem', {name: /Add channel artifact/});
    }

    test('runs the plugin action', async () => {
        const item = await openPluginItem(0);
        await userEvent.click(item);
        expect(action).toHaveBeenCalledWith('c1');
    });

    test('does not run the plugin action when the bookmark limit is reached', async () => {
        const item = await openPluginItem(MAX_BOOKMARKS_PER_CHANNEL);
        expect(item).toHaveAttribute('aria-disabled', 'true');
        await userEvent.click(item);
        expect(action).not.toHaveBeenCalled();
    });
});
