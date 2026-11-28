// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import SidebarBrowseOrAddChannelMenu from './sidebar_browse_or_add_channel_menu';

describe('SidebarBrowseOrAddChannelMenu', () => {
    const props = {
        canCreateChannel: true,
        onCreateNewChannelClick: jest.fn(),
        canJoinPublicChannel: true,
        onBrowseChannelClick: jest.fn(),
        onOpenDirectMessageClick: jest.fn(),
        canCreateCustomGroups: true,
        onCreateNewUserGroupClick: jest.fn(),
        unreadFilterEnabled: false,
        onCreateNewCategoryClick: jest.fn(),
        onInvitePeopleClick: jest.fn(),
    };

    const stateWithPluginItems = (items: Array<{id: string; text: string; placement?: 'default' | 'afterCreateChannel'}>) => ({
        entities: {
            teams: {currentTeamId: 'team_id'},
        },
        plugins: {
            components: {
                SidebarBrowseOrAddChannelMenu: items.map((item) => ({
                    ...item,
                    pluginId: 'plugin_id',
                    action: jest.fn(),
                    icon: null,
                })),
            },
        },
    });

    async function menuItemIds(items: Parameters<typeof stateWithPluginItems>[0]) {
        renderWithContext(<SidebarBrowseOrAddChannelMenu {...props}/>, stateWithPluginItems(items));
        await userEvent.click(screen.getByRole('button', {name: 'Browse or create channels'}));
        return screen.getAllByRole('menuitem').map((item) => item.id);
    }

    test('lists a plugin item after the built-in items by default', async () => {
        const ids = await menuItemIds([{id: 'default_item', text: 'Default item'}]);

        expect(ids.indexOf('default_item_pluginmenuitem')).toBe(ids.indexOf('createUserGroupMenuItem') + 1);
    });

    test('lists a plugin item placed afterCreateChannel second, right below "Create new channel"', async () => {
        const ids = await menuItemIds([
            {id: 'default_item', text: 'Default item'},
            {id: 'create_item', text: 'Create item', placement: 'afterCreateChannel'},
        ]);

        expect(ids.slice(0, 3)).toEqual(['createNewChannelMenuItem', 'create_item_pluginmenuitem', 'browseChannelsMenuItem']);
        expect(ids.indexOf('default_item_pluginmenuitem')).toBe(ids.indexOf('createUserGroupMenuItem') + 1);
    });
});
