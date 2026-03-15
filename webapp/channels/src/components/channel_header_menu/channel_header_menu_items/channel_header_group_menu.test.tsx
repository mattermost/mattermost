// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {WithTestMenuContext} from 'components/menu/menu_context_test';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';
import type {ChannelSettingsTabComponent} from 'types/store/plugins';

import ChannelHeaderGroupMenu from './channel_header_group_menu';

jest.mock('components/menu', () => {
    const React = require('react');

    return {
        Separator: () => null,
        SubMenu: ({labels, children}: {labels: React.ReactNode; children: React.ReactNode}) => React.createElement(React.Fragment, null, labels, children),
    };
});

jest.mock('components/menu/menu_context_test', () => ({
    WithTestMenuContext: ({children}: {children: React.ReactNode}) => children,
}));

jest.mock('utils/url', () => ({
    isValidUrl: jest.fn((url = '') => (/^https?:\/\//i).test(url)),
}));

jest.mock('components/channel_move_to_sub_menu', () => {
    return function MockChannelMoveToSubMenu() {
        return null;
    };
});

jest.mock('components/permissions_gates/channel_permission_gate', () => {
    return function MockChannelPermissionGate({children}: {children: React.ReactNode}) {
        return <>{children}</>;
    };
});

jest.mock('../menu_items/autotranslation', () => {
    return function MockMenuItemAutotranslation() {
        return <div>{'Auto-translation'}</div>;
    };
});

jest.mock('../menu_items/channel_bookmarks_submenu', () => {
    return function MockMenuItemChannelBookmarks() {
        return null;
    };
});

jest.mock('../menu_items/channel_settings_menu', () => {
    return function MockMenuItemChannelSettings() {
        return <div>{'Channel Settings'}</div>;
    };
});

jest.mock('../menu_items/close_message', () => {
    return function MockCloseMessage() {
        return null;
    };
});

jest.mock('../menu_items/convert_gm_to_private', () => {
    return function MockMenuItemConvertToPrivate() {
        return null;
    };
});

jest.mock('../menu_items/edit_conversation_header', () => {
    return function MockEditConversationHeader() {
        return <div>{'Edit Header'}</div>;
    };
});

jest.mock('../menu_items/notification', () => {
    return function MockMenuItemNotification() {
        return null;
    };
});

jest.mock('../menu_items/open_members_rhs', () => {
    return function MockMenuItemOpenMembersRHS() {
        return null;
    };
});

jest.mock('../menu_items/plugins_submenu', () => {
    return function MockMenuItemPluginItems() {
        return null;
    };
});

jest.mock('../menu_items/toggle_favorite_channel', () => {
    return function MockMenuItemToggleFavoriteChannel() {
        return null;
    };
});

jest.mock('../menu_items/toggle_info', () => {
    return function MockMenuItemToggleInfo() {
        return null;
    };
});

jest.mock('../menu_items/toggle_mute_channel', () => {
    return function MockMenuItemToggleMuteChannel() {
        return null;
    };
});

jest.mock('../menu_items/view_pinned_posts', () => {
    return function MockMenuItemViewPinnedPosts() {
        return null;
    };
});

const GM_CHANNEL_ID = 'gm_channel_id';
const CURRENT_USER_ID = 'user_id';
const DummyChannelSettingsTab = () => null;

function createVisiblePluginTab(): ChannelSettingsTabComponent {
    return {
        id: 'plugin-tab',
        pluginId: 'plugin-id',
        uiName: 'Plugin Tab',
        shouldRender: jest.fn(() => true),
        component: DummyChannelSettingsTab,
    };
}

function getBaseState(): DeepPartial<GlobalState> {
    const channel = TestHelper.getChannelMock({
        id: GM_CHANNEL_ID,
        type: 'G' as const,
        group_constrained: false,
        delete_at: 0,
    });
    const currentUser = TestHelper.getUserMock({id: CURRENT_USER_ID, roles: 'system_user'});
    return {
        entities: {
            channels: {
                channels: {
                    [GM_CHANNEL_ID]: channel,
                },
            },
            general: {
                config: {
                    EnableAutoTranslation: 'true',
                },
            },
            users: {
                currentUserId: CURRENT_USER_ID,
                profiles: {
                    [CURRENT_USER_ID]: currentUser,
                },
            },
        },
        plugins: {
            components: {
                ChannelSettingsTab: [],
            },
        },
    };
}

function getStateWithRestrictedDMAndGM(): DeepPartial<GlobalState> {
    const state = getBaseState();
    state.entities!.general!.config!.RestrictDMAndGMAutotranslation = 'true';
    return state;
}

describe('components/ChannelHeaderMenu/ChannelHeaderGroupMenu', () => {
    const channel = TestHelper.getChannelMock({
        id: GM_CHANNEL_ID,
        type: 'G' as const,
        group_constrained: false,
        delete_at: 0,
    });
    const user = TestHelper.getUserMock({id: CURRENT_USER_ID, roles: 'system_user'});
    const defaultProps = {
        channel,
        user,
        isMuted: false,
        isMobile: false,
        isFavorite: false,
        pluginItems: [],
        isChannelBookmarksEnabled: false,
        isChannelAutotranslated: false,
    };

    it('shows Channel Settings when RestrictDMAndGMAutotranslation is not enabled', () => {
        renderWithContext(
            <WithTestMenuContext>
                <ChannelHeaderGroupMenu {...defaultProps}/>
            </WithTestMenuContext>,
            getBaseState(),
        );

        expect(screen.getByText('Channel Settings')).toBeInTheDocument();
        expect(screen.queryByText('Edit Header')).not.toBeInTheDocument();
    });

    it('shows Settings submenu when RestrictDMAndGMAutotranslation is enabled', () => {
        renderWithContext(
            <WithTestMenuContext>
                <ChannelHeaderGroupMenu {...defaultProps}/>
            </WithTestMenuContext>,
            getStateWithRestrictedDMAndGM(),
        );

        expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('shows Channel Settings for a GM when built-in auto-translation access is blocked but a visible plugin tab exists', () => {
        const state = getStateWithRestrictedDMAndGM();
        state.plugins!.components!.ChannelSettingsTab = [createVisiblePluginTab()];

        renderWithContext(
            <WithTestMenuContext>
                <ChannelHeaderGroupMenu {...defaultProps}/>
            </WithTestMenuContext>,
            state,
        );

        expect(screen.getByText('Channel Settings')).toBeInTheDocument();
        expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    });

    it('shows Auto-translation menu when isChannelAutotranslated is true', () => {
        renderWithContext(
            <WithTestMenuContext>
                <ChannelHeaderGroupMenu
                    {...defaultProps}
                    isChannelAutotranslated={true}
                />
            </WithTestMenuContext>,
            getBaseState(),
        );

        expect(screen.getByText(/Auto-translation/i)).toBeInTheDocument();
    });

    it('does not show Auto-translation menu when isChannelAutotranslated is false', () => {
        renderWithContext(
            <WithTestMenuContext>
                <ChannelHeaderGroupMenu
                    {...defaultProps}
                    isChannelAutotranslated={false}
                />
            </WithTestMenuContext>,
            getBaseState(),
        );

        expect(screen.queryByText(/Auto-translation/i)).not.toBeInTheDocument();
    });

    it('does not show Channel Settings when the channel is archived', () => {
        const archivedChannel = TestHelper.getChannelMock({
            ...channel,
            delete_at: 1234567890,
        });
        const archivedChannelState = getBaseState();
        archivedChannelState.entities!.channels!.channels![GM_CHANNEL_ID]!.delete_at = 1234567890;

        renderWithContext(
            <WithTestMenuContext>
                <ChannelHeaderGroupMenu
                    {...defaultProps}
                    channel={archivedChannel}
                />
            </WithTestMenuContext>,
            archivedChannelState,
        );

        expect(screen.queryByText('Channel Settings')).not.toBeInTheDocument();
    });

    it('does not show Settings submenu when the channel is archived', () => {
        const archivedChannel = TestHelper.getChannelMock({
            ...channel,
            delete_at: 1234567890,
        });
        const archivedChannelState = getStateWithRestrictedDMAndGM();
        archivedChannelState.entities!.channels!.channels![GM_CHANNEL_ID] = {
            ...archivedChannelState.entities!.channels!.channels![GM_CHANNEL_ID],
            delete_at: 1234567890,
        };

        renderWithContext(
            <WithTestMenuContext>
                <ChannelHeaderGroupMenu
                    {...defaultProps}
                    channel={archivedChannel}
                />
            </WithTestMenuContext>,
            archivedChannelState,
        );

        expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    });
});
