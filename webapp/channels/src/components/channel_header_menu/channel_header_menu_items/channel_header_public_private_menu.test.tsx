// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {Permissions} from 'mattermost-redux/constants';

import {WithTestMenuContext} from 'components/menu/menu_context_test';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import ChannelHeaderPublicMenu from './channel_header_public_private_menu';

const CHANNEL_ID = 'channel_id';
const TEAM_ID = 'team_id';
const CURRENT_USER_ID = 'user_id';

describe('components/ChannelHeaderMenu/ChannelHeaderPublicMenu', () => {
    const channel = TestHelper.getChannelMock({
        id: CHANNEL_ID,
        team_id: TEAM_ID,
        type: 'O' as const,
        group_constrained: true,
        delete_at: 0,
    });
    const user = TestHelper.getUserMock({id: CURRENT_USER_ID, roles: 'custom_role'});
    const defaultProps = {
        channel,
        user,
        isMuted: false,
        isDefault: false,
        isMobile: false,
        isFavorite: false,
        isLicensedForLDAPGroups: true,
        pluginItems: [],
        isChannelBookmarksEnabled: false,
        isChannelAutotranslated: false,
    };

    function getState(permissions: string[]): DeepPartial<GlobalState> {
        return {
            entities: {
                channels: {
                    channels: {
                        [CHANNEL_ID]: channel,
                    },
                },
                teams: {
                    currentTeamId: TEAM_ID,
                    teams: {
                        [TEAM_ID]: TestHelper.getTeamMock({id: TEAM_ID}),
                    },
                },
                users: {
                    currentUserId: CURRENT_USER_ID,
                    profiles: {
                        [CURRENT_USER_ID]: user,
                    },
                },
                roles: {
                    roles: {
                        custom_role: TestHelper.getRoleMock({name: 'custom_role', permissions}),
                    },
                },
            },
        };
    }

    it('shows group menu items on a group constrained channel with manage channel roles permission', () => {
        renderWithContext(
            <WithTestMenuContext>
                <ChannelHeaderPublicMenu {...defaultProps}/>
            </WithTestMenuContext>,
            getState([Permissions.MANAGE_PUBLIC_CHANNEL_MEMBERS, Permissions.MANAGE_CHANNEL_ROLES]),
        );

        expect(screen.getByText('Add Groups')).toBeInTheDocument();
        expect(screen.getByText('Manage Groups')).toBeInTheDocument();
    });

    it('hides group menu items on a group constrained channel without manage channel roles permission', () => {
        renderWithContext(
            <WithTestMenuContext>
                <ChannelHeaderPublicMenu {...defaultProps}/>
            </WithTestMenuContext>,
            getState([Permissions.MANAGE_PUBLIC_CHANNEL_MEMBERS]),
        );

        expect(screen.queryByText('Add Groups')).not.toBeInTheDocument();
        expect(screen.queryByText('Manage Groups')).not.toBeInTheDocument();
        expect(screen.getByText('Members')).toBeInTheDocument();
    });
});
