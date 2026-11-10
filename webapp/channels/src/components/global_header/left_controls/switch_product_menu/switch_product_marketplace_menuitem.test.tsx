// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {Permissions} from 'mattermost-redux/constants';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import ProductSwitcherMarketplaceMenuItem from './switch_product_marketplace_menuitem';

interface Options {
    marketplaceEnabled?: boolean;
    teamPermissions?: string[];
}

function getState({marketplaceEnabled = true, teamPermissions = [Permissions.SYSCONSOLE_WRITE_PLUGINS]}: Options = {}): DeepPartial<GlobalState> {
    return {
        entities: {
            general: {
                config: {
                    PluginsEnabled: 'true',
                    EnableMarketplace: marketplaceEnabled ? 'true' : 'false',
                },
            },
            users: {
                currentUserId: 'user_id',
                profiles: {
                    user_id: TestHelper.getUserMock({id: 'user_id'}),
                },
            },
            teams: {
                currentTeamId: 'team_id',
                teams: {
                    team_id: TestHelper.getTeamMock({id: 'team_id'}),
                },
                myMembers: {
                    team_id: {roles: 'team_user'},
                },
            },
            roles: {
                roles: {
                    team_user: {permissions: teamPermissions},
                },
            },
        },
    };
}

describe('ProductSwitcherMarketplaceMenuItem', () => {
    test('should show when channels is active, the marketplace is enabled, and the user can write plugins', () => {
        renderWithContext(
            <ProductSwitcherMarketplaceMenuItem
                isChannelsProductActive={true}
                currentTeamId='team_id'
            />,
            getState(),
        );

        expect(screen.getByText('App Marketplace')).toBeInTheDocument();
    });

    test('should not show when channels product is not active', () => {
        renderWithContext(
            <ProductSwitcherMarketplaceMenuItem
                isChannelsProductActive={false}
                currentTeamId='team_id'
            />,
            getState(),
        );

        expect(screen.queryByText('App Marketplace')).not.toBeInTheDocument();
    });

    test('should not show when the marketplace is disabled', () => {
        renderWithContext(
            <ProductSwitcherMarketplaceMenuItem
                isChannelsProductActive={true}
                currentTeamId='team_id'
            />,
            getState({marketplaceEnabled: false}),
        );

        expect(screen.queryByText('App Marketplace')).not.toBeInTheDocument();
    });

    test('should not show when the user cannot write plugins for the team', () => {
        renderWithContext(
            <ProductSwitcherMarketplaceMenuItem
                isChannelsProductActive={true}
                currentTeamId='team_id'
            />,
            getState({teamPermissions: []}),
        );

        expect(screen.queryByText('App Marketplace')).not.toBeInTheDocument();
    });
});
