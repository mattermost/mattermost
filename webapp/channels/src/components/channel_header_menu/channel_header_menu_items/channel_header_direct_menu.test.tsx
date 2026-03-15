// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {WithTestMenuContext} from 'components/menu/menu_context_test';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';
import type {ChannelSettingsTabComponent} from 'types/store/plugins';

import ChannelHeaderDirectMenu from './channel_header_direct_menu';

jest.mock('components/menu', () => ({
    Separator: () => null,
}));

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

jest.mock('../menu_items/edit_conversation_header', () => {
    return function MockEditConversationHeader() {
        return <div>{'Edit Header'}</div>;
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

const DM_CHANNEL_ID = 'dm_channel_id';
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

function getBaseState(overrides?: DeepPartial<GlobalState>): DeepPartial<GlobalState> {
    const channel = TestHelper.getChannelMock({id: DM_CHANNEL_ID, type: 'D'});
    const currentUser = TestHelper.getUserMock({id: CURRENT_USER_ID});
    return {
        entities: {
            channels: {
                channels: {
                    [DM_CHANNEL_ID]: channel,
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
        ...overrides,
    };
}

function getStateWithRestrictedDMAndGM(): DeepPartial<GlobalState> {
    const state = getBaseState();
    state!.entities!.general!.config!.RestrictDMAndGMAutotranslation = 'true';
    return state;
}

describe('components/ChannelHeaderMenu/ChannelHeaderDirectMenu', () => {
    const channel = TestHelper.getChannelMock({id: DM_CHANNEL_ID, type: 'D'});
    const user = TestHelper.getUserMock({id: CURRENT_USER_ID});
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
                <ChannelHeaderDirectMenu {...defaultProps}/>
            </WithTestMenuContext>,
            getBaseState(),
        );

        expect(screen.getByText('Channel Settings')).toBeInTheDocument();
        expect(screen.queryByText('Edit Header')).not.toBeInTheDocument();
    });

    it('shows Edit Header when RestrictDMAndGMAutotranslation is enabled', () => {
        renderWithContext(
            <WithTestMenuContext>
                <ChannelHeaderDirectMenu {...defaultProps}/>
            </WithTestMenuContext>,
            getStateWithRestrictedDMAndGM(),
        );

        expect(screen.getByText('Edit Header')).toBeInTheDocument();
        expect(screen.queryByText('Channel Settings')).not.toBeInTheDocument();
    });

    it('shows Channel Settings for a DM when built-in auto-translation access is blocked but a visible plugin tab exists', () => {
        const state = getStateWithRestrictedDMAndGM();
        state.plugins!.components!.ChannelSettingsTab = [createVisiblePluginTab()];

        renderWithContext(
            <WithTestMenuContext>
                <ChannelHeaderDirectMenu {...defaultProps}/>
            </WithTestMenuContext>,
            state,
        );

        expect(screen.getByText('Channel Settings')).toBeInTheDocument();
        expect(screen.queryByText('Edit Header')).not.toBeInTheDocument();
    });

    it('shows Auto-translation menu when isChannelAutotranslated is true', () => {
        renderWithContext(
            <WithTestMenuContext>
                <ChannelHeaderDirectMenu
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
                <ChannelHeaderDirectMenu
                    {...defaultProps}
                    isChannelAutotranslated={false}
                />
            </WithTestMenuContext>,
            getBaseState(),
        );

        expect(screen.queryByText(/Auto-translation/i)).not.toBeInTheDocument();
    });
});
