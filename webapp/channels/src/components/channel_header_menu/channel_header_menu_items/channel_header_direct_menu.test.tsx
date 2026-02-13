// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {WithTestMenuContext} from 'components/menu/menu_context_test';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import ChannelHeaderDirectMenu from './channel_header_direct_menu';

const DM_CHANNEL_ID = 'dm_channel_id';
const CURRENT_USER_ID = 'user_id';

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
