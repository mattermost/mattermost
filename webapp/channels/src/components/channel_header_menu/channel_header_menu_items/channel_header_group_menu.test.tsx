// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {WithTestMenuContext} from 'components/menu/menu_context_test';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import ChannelHeaderGroupMenu from './channel_header_group_menu';

const GM_CHANNEL_ID = 'gm_channel_id';
const CURRENT_USER_ID = 'user_id';

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
    };
}

function getStateWithRestrictedDMAndGM(): DeepPartial<GlobalState> {
    const state = getBaseState();
    return {
        ...state,
        entities: {
            ...state.entities,
            general: {
                config: {RestrictDMAndGMAutotranslation: 'true'},
            },
        },
    };
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
