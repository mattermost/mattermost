// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelCategory, ChannelCategoryType} from '@mattermost/types/channel_categories';
import {CategorySorting} from '@mattermost/types/channel_categories';
import type {Channel} from '@mattermost/types/channels';

import * as Menu from 'components/menu';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import ChannelMoveToSubMenu from './index';

describe('components/channel_move_to_sub_menu', () => {
    const currentUserId = 'current_user';

    const makeCategory = (id: string, type: ChannelCategoryType, displayName: string): ChannelCategory => ({
        id,
        team_id: 'team1',
        user_id: currentUserId,
        type,
        display_name: displayName,
        sorting: CategorySorting.Alphabetical,
        channel_ids: [],
        muted: false,
        collapsed: false,
    });

    const categories = [
        makeCategory('favorites', 'favorites', 'Favorites'),
        makeCategory('channels', 'channels', 'Channels'),
        makeCategory('dms', 'direct_messages', 'Direct Messages'),
        makeCategory('agents', 'agents', 'Agents'),
        makeCategory('custom', 'custom', 'My Category'),
    ];

    const initialState = {
        entities: {
            users: {
                currentUserId,
                profiles: {
                    agent: {id: 'agent', is_bot: true, is_agent: true},
                    teammate: {id: 'teammate'},
                },
            },
            teams: {
                currentTeamId: 'team1',
                teams: {team1: {id: 'team1', name: 'team1'}},
            },
            channels: {
                channels: {},
            },
            channelCategories: {
                byId: Object.fromEntries(categories.map((category) => [category.id, category])),
                orderByTeam: {team1: categories.map((category) => category.id)},
                managedCategoryMappings: {},
            },
            general: {
                config: {},
            },
        },
        views: {
            channelSidebar: {
                multiSelectedChannelIds: [],
            },
        },
    };

    const renderMenu = async (channel: Partial<Channel>) => {
        renderWithContext(
            <Menu.Container
                menuButton={{id: 'menuButton', children: 'Open menu'}}
                menu={{id: 'menu'}}
            >
                <ChannelMoveToSubMenu channel={channel as Channel}/>
            </Menu.Container>,
            initialState,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Open menu'}));
        await userEvent.click(screen.getByRole('menuitem', {name: /move to/i}));
    };

    const offeredCategories = () => screen.getAllByRole('menuitem').
        map((item) => item.id.replace(/^moveToCategory-.*-/, '')).
        filter((id) => categories.some((category) => category.id === id));

    test('should offer agent DMs every category except Channels and Direct Messages', async () => {
        await renderMenu({id: 'agent_dm', type: 'D', name: `${currentUserId}__agent`});

        expect(offeredCategories()).toEqual(['favorites', 'agents', 'custom']);
    });

    test('should not offer the Agents category for regular DMs', async () => {
        await renderMenu({id: 'teammate_dm', type: 'D', name: `${currentUserId}__teammate`});

        expect(offeredCategories()).toEqual(['favorites', 'dms', 'custom']);
    });

    test('should not offer the Agents or Direct Messages categories for channels', async () => {
        await renderMenu({id: 'public_channel', type: 'O', name: 'public'});

        expect(offeredCategories()).toEqual(['favorites', 'channels', 'custom']);
    });
});
