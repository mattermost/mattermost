// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {Permissions} from 'mattermost-redux/constants';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import ProductSwitcherIntegrationsMenuItem from './switch_product_integrations_menuitem';

jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useHistory: () => ({
        push: jest.fn(),
    }),
}));

describe('ProductSwitcherIntegrationsMenuItem', () => {
    const initialState: DeepPartial<GlobalState> = {
        entities: {
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
                    team_id: {
                        roles: 'team_user',
                    },
                },
            },
            channels: {
                currentChannelId: 'channel_id',
            },
            roles: {
                roles: {
                    system_user: {
                        permissions: [],
                    },
                    team_user: {
                        permissions: [],
                    },
                },
            },
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should not show when channels product is not active', () => {
        renderWithContext(
            <ProductSwitcherIntegrationsMenuItem
                isChannelsProductActive={false}
                haveEnabledIncomingWebhooks={true}
                haveEnabledOutgoingWebhooks={true}
                haveEnabledSlashCommands={true}
                haveEnabledOAuthServiceProvider={true}
            />,
        );

        expect(screen.queryByText('Integrations')).not.toBeInTheDocument();
    });

    test('should not show when integrations are enabled but user cannot manage any integrations', () => {
        renderWithContext(
            <ProductSwitcherIntegrationsMenuItem
                isChannelsProductActive={true}
                haveEnabledIncomingWebhooks={true}
                haveEnabledOutgoingWebhooks={true}
                haveEnabledSlashCommands={true}
                haveEnabledOAuthServiceProvider={true}
            />,
            initialState,
        );

        expect(screen.queryByText('Integrations')).not.toBeInTheDocument();
    });

    test('should show when atleast one integration is enabled and user has permission to manage it', () => {
        const state: DeepPartial<GlobalState> = {
            entities: {
                ...initialState.entities,
                roles: {
                    roles: {
                        team_user: {
                            permissions: [Permissions.MANAGE_INCOMING_WEBHOOKS],
                        },
                    },
                },
            },
        };

        renderWithContext(
            <ProductSwitcherIntegrationsMenuItem
                isChannelsProductActive={true}
                haveEnabledIncomingWebhooks={true}
                haveEnabledOutgoingWebhooks={false}
                haveEnabledSlashCommands={false}
                haveEnabledOAuthServiceProvider={false}
            />,
            state,
        );

        expect(screen.getByText('Integrations')).toBeInTheDocument();
    });
});
