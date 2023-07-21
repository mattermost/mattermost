// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {AppBinding} from '@mattermost/types/apps';
import {mount, shallow} from 'enzyme';
import React from 'react';

import {Permissions} from 'mattermost-redux/constants';
import {AppBindingLocations} from 'mattermost-redux/constants/apps';

import {GlobalState} from 'types/store';
import {PluginComponent} from 'types/store/plugins';

import AppBar from './app_bar';

import 'jest-styled-components';

const mockDispatch = jest.fn();
let mockState: GlobalState;

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux') as typeof import('react-redux'),
    useSelector: (selector: (state: typeof mockState) => unknown) => selector(mockState),
    useDispatch: () => mockDispatch,
}));

jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom') as typeof import('react-router-dom'),
    useLocation: () => {
        return {
            pathname: '',
        };
    },
}));

describe('components/app_bar/app_bar', () => {
    beforeEach(() => {
        mockState = {
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
                    } as any,
                },
                channels: {
                    currentChannelId: 'currentchannel',
                    channels: {
                        currentchannel: {
                            id: 'currentchannel',
                        },
                    } as any,
                    myMembers: {
                        currentchannel: {
                            id: 'memberid',
                        },
                    } as any,
                },
                teams: {
                    currentTeamId: 'currentteam',
                },
                preferences: {
                    myPreferences: {
                    },
                } as any,
                users: {
                    currentUserId: 'user1',
                    profiles: {
                        user1: {
                            roles: 'system_user',
                        },
                    },
                } as any,
                roles: {
                    roles: {
                        system_user: {
                            permissions: [],
                        },
                    },
                } as any,
            },
        } as GlobalState;
    });

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

    test('should match snapshot on mount', async () => {
        const wrapper = mount(
            <AppBar/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot on mount when App Bar is disabled', async () => {
        mockState.entities.general.config.DisableAppBar = 'false';

        const wrapper = mount(
            <AppBar/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should not show marketplace if disabled or user does not have SYSCONSOLE_WRITE_PLUGINS permission', async () => {
        mockState.entities.general = {
            config: {
                DisableAppBar: 'true',
                FeatureFlagAppsEnabled: 'true',
                EnableMarketplace: 'true',
                PluginsEnabled: 'true',
            },
        } as any;

        const wrapper = shallow(
            <AppBar/>,
        );

        expect(wrapper.find('AppBarMarketplace').exists()).toEqual(false);
    });

    test('should show marketplace if enabled and user has SYSCONSOLE_WRITE_PLUGINS permission', async () => {
        mockState.entities.general = {
            config: {
                DisableAppBar: 'false',
                FeatureFlagAppsEnabled: 'true',
                EnableMarketplace: 'true',
                PluginsEnabled: 'true',
            },
        } as any;

        mockState.entities.roles = {
            roles: {
                system_user: {
                    permissions: [
                        Permissions.SYSCONSOLE_WRITE_PLUGINS,
                    ],
                },
            },
        } as any;

        const wrapper = shallow(
            <AppBar/>,
        );

        expect(wrapper.find('AppBarMarketplace').exists()).toEqual(true);
    });
});
