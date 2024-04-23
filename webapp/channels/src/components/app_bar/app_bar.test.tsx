// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {AppBinding} from '@mattermost/types/apps';

import {Permissions} from 'mattermost-redux/constants';
import {AppBindingLocations} from 'mattermost-redux/constants/apps';

import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {PluginComponent} from 'types/store/plugins';

import AppBar from './app_bar';

describe('components/app_bar/app_bar', () => {
    const channelHeaderComponents: PluginComponent[] = [
        {
            id: 'the_component_id',
            pluginId: 'playbooks',
            icon: 'fallback_component' as any,
            tooltipText: 'Playbooks Tooltip',
            action: jest.fn(),
        },
    ];

    const rhsComponents: PluginComponent[] = [
        {
            id: 'the_rhs_plugin_component_id',
            pluginId: 'playbooks',
            icon: <div/>,
            action: jest.fn(),
        },
    ];

    const channelHeaderAppBindings: AppBinding[] = [
        {
            location: AppBindingLocations.CHANNEL_HEADER_ICON,
            bindings: [
                {
                    app_id: 'com.mattermost.zendesk',
                    label: 'Create Subscription',
                },
            ],
        },
    ] as AppBinding[];

    const initialState = {
        views: {
            rhs: {
                isSidebarOpen: true,
                rhsState: 'plugin',
                pluggableId: 'the_rhs_plugin_component',
            },
        },
        plugins: {
            components: {
                AppBar: channelHeaderComponents,
                RightHandSidebarComponent: rhsComponents,
                Product: [],
            } as {[componentName: string]: PluginComponent[]},
        },
        entities: {
            apps: {
                main: {
                    bindings: channelHeaderAppBindings,
                } as {bindings: AppBinding[]},
                pluginEnabled: true,
            },
            general: {
                config: {
                    DisableAppBar: 'false',
                    FeatureFlagAppsEnabled: 'true',
                },
            },
            channels: {
                currentChannelId: 'currentchannel',
                channels: {
                    currentchannel: TestHelper.getChannelMock({
                        id: 'currentchannel',
                    }),
                },
                myMembers: {
                    currentchannel: TestHelper.getChannelMembershipMock({
                        channel_id: 'currentchannel',
                        user_id: 'user1',
                    }),
                },
            },
            teams: {
                currentTeamId: 'currentteam',
            },
            users: {
                currentUserId: 'user1',
                profiles: {
                    user1: TestHelper.getUserMock({
                        roles: 'system_user',
                    }),
                },
            },
        },
    };

    test('should match snapshot on mount', () => {
        const testState = initialState;
        const {asFragment} = renderWithContext(
            <AppBar/>,
            testState,
        );

        expect(asFragment()).toMatchSnapshot();
    });

    test('should match snapshot on mount when App Bar is disabled', () => {
        const testState = mergeObjects(initialState, {
            entities: {
                general: {
                    config: {
                        DisableAppbar: 'false',
                    },
                },
            },
        });

        const {asFragment} = renderWithContext(
            <AppBar/>,
            testState,
        );

        expect(asFragment()).toMatchSnapshot();
    });

    test('should not show marketplace if disabled or user does not have SYSCONSOLE_WRITE_PLUGINS permission', () => {
        const testState = mergeObjects(initialState, {
            entities: {
                general: {
                    config: {
                        DisableAppBar: 'true',
                        FeatureFlagAppsEnabled: 'true',
                        EnableMarketplace: 'true',
                        PluginsEnabled: 'true',
                    },
                },
            },
        });

        renderWithContext(
            <AppBar/>,
            testState,
        );

        expect(screen.queryByLabelText('App Marketplace')).not.toBeInTheDocument();
    });

    test('should show marketplace if enabled and user has SYSCONSOLE_WRITE_PLUGINS permission', () => {
        const testState = mergeObjects(initialState, {
            entities: {
                general: {
                    config: {
                        DisableAppBar: 'false',
                        FeatureFlagAppsEnabled: 'true',
                        EnableMarketplace: 'true',
                        PluginsEnabled: 'true',
                    },
                },
                roles: {
                    roles: {
                        system_user: {
                            permissions: [
                                Permissions.SYSCONSOLE_WRITE_PLUGINS,
                            ],
                        },
                    },
                },
            },
        });

        renderWithContext(
            <AppBar/>,
            testState,
        );

        expect(screen.queryByLabelText('App Marketplace')).toBeInTheDocument();
    });
});
