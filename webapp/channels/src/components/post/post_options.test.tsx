// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {SystemEmoji} from '@mattermost/types/emojis';

import {Permissions} from 'mattermost-redux/constants';

import {testPluginComponentErrorHandling} from 'tests/helpers/plugin_error_handling';
import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {Locations} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import type {PostActionComponent} from 'types/store/plugins';

import PostOptions from './post_options';

// Minimal Redux state: grant ADD_REACTION to the current user so that
// ChannelPermissionGate lets the quick-reaction emoji buttons render.
const currentUserId = 'currentUser';
const channel = TestHelper.getChannelMock({team_id: 'team1'});
const baseState = {
    entities: {
        roles: {
            roles: {
                system_user: TestHelper.getRoleMock({permissions: [Permissions.ADD_REACTION]}),
            },
        },
        users: {
            currentUserId,
            profiles: {
                [currentUserId]: TestHelper.getUserMock({id: currentUserId, roles: 'system_user'}),
            },
        },
    },
};

// Proper SystemEmoji shapes — getEmojiName() reads `short_name` for system emojis.
const makeSystemEmoji = (shortName: string): SystemEmoji => ({
    name: shortName,
    short_name: shortName,
    short_names: [shortName],
    category: 'people-body',
    unified: shortName.toUpperCase(),
});

const post = TestHelper.getPostMock({type: '', channel_id: channel.id});

const baseProps = {
    post,
    teamId: channel.team_id,
    isFlagged: false,
    removePost: jest.fn(),
    enableEmojiPicker: true,
    isReadOnly: false,
    channelIsArchived: false,
    handleDropdownOpened: jest.fn(),
    oneClickReactionsEnabled: true,
    recentEmojis: [
        makeSystemEmoji('thumbsup'),
        makeSystemEmoji('grinning'),
        makeSystemEmoji('white_check_mark'),
    ],
    isMobileView: false,
    location: Locations.RHS_ROOT as keyof typeof Locations,
    pluginActions: [],
    isChannelAutotranslated: false,
    actions: {
        emitShortcutReactToLastPostFrom: jest.fn(),
    },
};

describe('PostOptions - quick reaction count (MM-68681)', () => {
    test('CENTER location always shows 3 quick reaction emojis', () => {
        renderWithContext(
            <PostOptions
                {...baseProps}
                location={Locations.CENTER}
                isExpanded={false}
                hover={true}
            />,
            baseState,
        );

        expect(screen.getAllByTestId('post-menu__item_emoji')).toHaveLength(3);
    });

    test('RHS_ROOT with isExpanded false (narrow sidebar) shows 1 quick reaction emoji', () => {
        renderWithContext(
            <PostOptions
                {...baseProps}
                location={Locations.RHS_ROOT}
                isExpanded={false}
                hover={true}
            />,
            baseState,
        );

        expect(screen.getAllByTestId('post-menu__item_emoji')).toHaveLength(1);
    });

    test('RHS_ROOT with isExpanded true (expanded sidebar or Global Threads view) shows 3 quick reaction emojis', () => {
        renderWithContext(
            <PostOptions
                {...baseProps}
                location={Locations.RHS_ROOT}
                isExpanded={true}
                hover={true}
            />,
            baseState,
        );

        expect(screen.getAllByTestId('post-menu__item_emoji')).toHaveLength(3);
    });

    test('RHS_COMMENT with isExpanded true shows 3 quick reaction emojis', () => {
        renderWithContext(
            <PostOptions
                {...baseProps}
                location={Locations.RHS_COMMENT}
                isExpanded={true}
                hover={true}
            />,
            baseState,
        );

        expect(screen.getAllByTestId('post-menu__item_emoji')).toHaveLength(3);
    });

    testPluginComponentErrorHandling((pluginComponent) => {
        renderWithContext(
            <PostOptions
                {...baseProps}
                isExpanded={true}
                hover={true}
                pluginActions={[pluginComponent]}
            />,
        );
    });
});

describe('PostOptions - plugin post actions (MM-68323)', () => {
    test('keeps plugin action visible when its menu is open and hover ends', async () => {
        const PluginAction = ({handleDropdownOpened}: {handleDropdownOpened?: (open: boolean) => void}) => (
            <button onClick={() => handleDropdownOpened?.(true)}>
                {'AI Actions'}
            </button>
        );
        const pluginAction: PostActionComponent = {
            id: 'ai-actions',
            pluginId: 'mattermost-ai',
            component: PluginAction,
        };

        const {rerender} = renderWithContext(
            <PostOptions
                {...baseProps}
                hover={true}
                pluginActions={[pluginAction]}
            />,
            baseState,
        );

        expect(screen.getByRole('button', {name: 'AI Actions'})).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', {name: 'AI Actions'}));

        rerender(
            <PostOptions
                {...baseProps}
                hover={false}
                pluginActions={[pluginAction]}
            />,
        );

        expect(screen.getByRole('button', {name: 'AI Actions'})).toBeInTheDocument();
    });
});
