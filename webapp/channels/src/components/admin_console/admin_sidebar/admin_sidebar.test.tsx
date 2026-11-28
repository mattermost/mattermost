// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {WebSocketMessage} from '@mattermost/client';
import {WebSocketEvents} from '@mattermost/client';
import type {ExperimentalSettings, PluginSettings} from '@mattermost/types/config';
import type {PluginManifest} from '@mattermost/types/plugins';

import {Client4} from 'mattermost-redux/client';
import {Permissions} from 'mattermost-redux/constants';
import {RESOURCE_KEYS} from 'mattermost-redux/constants/permissions_sysconsole';

import AdminDefinition from 'components/admin_console/admin_definition';
import ConnectedAdminSidebar from 'components/admin_console/admin_sidebar';
import AdminSidebar from 'components/admin_console/admin_sidebar/admin_sidebar';
import type {Props as OriginalProps} from 'components/admin_console/admin_sidebar/admin_sidebar';

import WebSocketClient from 'client/web_websocket_client';
import {samplePlugin1} from 'tests/helpers/admin_console_plugin_index_sample_pluings';
import {act, renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {generateIndex} from 'utils/admin_console_index';
import {TestHelper} from 'utils/test_helper';

jest.mock('utils/utils', () => {
    const original = jest.requireActual('utils/utils');
    return {
        ...original,
        isMobile: jest.fn(() => true),
    };
});

jest.mock('utils/admin_console_index');

type Props = Omit<OriginalProps, 'intl'>;

describe('components/AdminSidebar', () => {
    const defaultProps: Omit<Props, 'intl'> = {
        license: {},
        config: {
            ExperimentalSettings: {
                RestrictSystemAdmin: false,
            } as ExperimentalSettings,
            PluginSettings: {
                Enable: true,
                EnableUploads: true,
            } as PluginSettings,
            FeatureFlags: {},
        },
        adminDefinition: AdminDefinition,
        buildEnterpriseReady: false,
        navigationBlocked: false,
        siteName: 'test snap',
        isCurrentUserSystemAdmin: true,
        plugins: {
            plugin_0: {
                active: false,
                description: 'The plugin 0.',
                id: 'plugin_0',
                name: 'Plugin 0',
                version: '0.1.0',
                settings_schema: {
                    footer: 'This is a footer',
                    header: 'This is a header',
                    settings: [],
                },
                webapp: {bundle_path: 'webapp/dist/main.js'},
            },
        },
        onSearchChange: jest.fn(),
        actions: {
            getPlugins: jest.fn(),
        },
        consoleAccess: {
            read: {
                about: true,
                reporting: true,
                environment: true,
                site_configuration: true,
                authentication: true,
                plugins: true,
                integrations: true,
                compliance: true,
            },
            write: {
                about: true,
                reporting: true,
                environment: true,
                site_configuration: true,
                authentication: true,
                plugins: true,
                integrations: true,
                compliance: true,
            },
        },
        cloud: {
            limits: {
                limitsLoaded: false,
                limits: {},
            },
            errors: {},
        },
        showTaskList: false,
    };

    Object.keys(RESOURCE_KEYS).forEach((key) => {
        Object.values(RESOURCE_KEYS[key as keyof typeof RESOURCE_KEYS]).forEach((value) => {
            defaultProps.consoleAccess = {
                ...defaultProps.consoleAccess,
                read: {
                    ...defaultProps.consoleAccess.read,
                    [value]: true,
                },
                write: {
                    ...defaultProps.consoleAccess.write,
                    [value]: true,
                },
            };
        });
    });

    test('should not show Workspace Optimization when Cloud license feature is enabled', () => {
        const props = {
            ...defaultProps,
            license: {
                IsLicensed: 'true',
                Cloud: 'true',
            },
        };
        renderWithContext(<AdminSidebar {...props}/>);
        expect(screen.queryByText('Workspace Optimization')).not.toBeInTheDocument();
    });

    describe('Site health and Workspace Optimization', () => {
        const renderSidebar = (skuShortName: string, healthDashboard: boolean, overrides: Partial<Props> = {}) => {
            const props = {
                ...defaultProps,
                license: {IsLicensed: 'true', SkuShortName: skuShortName},
                config: {
                    ...defaultProps.config,
                    FeatureFlags: {HealthDashboard: healthDashboard},
                },
                ...overrides,
            };
            renderWithContext(<AdminSidebar {...props}/>);
        };

        const delegatedAdmin = (canReadSiteStatistics: boolean): Partial<Props> => ({
            isCurrentUserSystemAdmin: false,
            consoleAccess: {
                read: {
                    ...defaultProps.consoleAccess.read,
                    [RESOURCE_KEYS.REPORTING.SITE_STATISTICS]: canReadSiteStatistics,
                    [RESOURCE_KEYS.REPORTING.TEAM_STATISTICS]: true,
                },
                write: {},
            },
        });

        test('shows a delegated admin who can read Site Statistics Site health and not Workspace Optimization', () => {
            renderSidebar('enterprise', true, delegatedAdmin(true));
            expect(screen.getByText('Site health')).toBeInTheDocument();
            expect(screen.queryByText('Workspace Optimization')).not.toBeInTheDocument();
        });

        test('shows a delegated admin who can read Site Statistics Workspace Optimization with the flag off', () => {
            renderSidebar('enterprise', false, delegatedAdmin(true));
            expect(screen.getByText('Workspace Optimization')).toBeInTheDocument();
            expect(screen.queryByText('Site health')).not.toBeInTheDocument();
        });

        test('shows a delegated admin who cannot read Site Statistics neither dashboard', () => {
            renderSidebar('enterprise', true, delegatedAdmin(false));
            expect(screen.getByText('Team Statistics')).toBeInTheDocument();
            expect(screen.queryByText('Site health')).not.toBeInTheDocument();
            expect(screen.queryByText('Workspace Optimization')).not.toBeInTheDocument();
        });

        test.each(['professional', 'enterprise'])('shows Site health and not Workspace Optimization with the flag on and a %s license', (sku) => {
            renderSidebar(sku, true);
            expect(screen.getByText('Site health')).toBeInTheDocument();
            expect(screen.queryByText('Workspace Optimization')).not.toBeInTheDocument();
        });

        test('shows Workspace Optimization and not Site health with the flag off', () => {
            renderSidebar('enterprise', false);
            expect(screen.getByText('Workspace Optimization')).toBeInTheDocument();
            expect(screen.queryByText('Site health')).not.toBeInTheDocument();
        });

        test('shows Workspace Optimization and not Site health with the flag on below Professional', () => {
            renderSidebar('starter', true);
            expect(screen.getByText('Workspace Optimization')).toBeInTheDocument();
            expect(screen.queryByText('Site health')).not.toBeInTheDocument();
        });
    });

    test('places Session Attributes immediately after Attribute Management', () => {
        const props = {
            ...defaultProps,
            license: {
                IsLicensed: 'true',
                SkuShortName: 'advanced',
            },
            config: {
                ...defaultProps.config,
                FeatureFlags: {
                    SessionAttributes: true,
                },
            },
            buildEnterpriseReady: true,
        };

        renderWithContext(<AdminSidebar {...props}/>);

        const systemAttributes = screen.getByTestId('system_attributes');
        const titles = Array.from(systemAttributes.querySelectorAll('.sidebar-section-title__text')).map((el) => el.textContent);
        const attributeManagementIndex = titles.indexOf('Attribute Management');
        const sessionAttributesIndex = titles.indexOf('Session Attributes');

        expect(attributeManagementIndex).toBeGreaterThan(-1);
        expect(sessionAttributesIndex).toBe(attributeManagementIndex + 1);
    });

    describe('syncing plugins changed outside this tab', () => {
        const manifest = (id: string, name: string): PluginManifest => ({
            id,
            name,
            version: '1.0.0',
            description: '',
            min_server_version: '',
            settings_schema: {header: '', footer: '', settings: []},
        });
        const pluginA = manifest('com.example.a', 'Plugin A');
        const pluginB = manifest('com.example.b', 'Plugin B');

        let messageListener: (msg: WebSocketMessage) => void;
        let reconnectListener: () => void;

        beforeEach(() => {
            jest.useFakeTimers();
            jest.spyOn(WebSocketClient, 'addMessageListener').mockImplementation((listener) => {
                messageListener = listener;
            });
            jest.spyOn(WebSocketClient, 'addReconnectListener').mockImplementation((listener) => {
                reconnectListener = listener;
            });
        });

        afterEach(() => {
            jest.useRealTimers();
            jest.restoreAllMocks();
        });

        const renderConnectedSidebar = (pluginsEnabled = true) => {
            return renderWithContext(
                <ConnectedAdminSidebar onSearchChange={jest.fn()}/>,
                {
                    entities: {
                        admin: {config: {PluginSettings: {Enable: pluginsEnabled}}},
                        users: {
                            currentUserId: 'admin',
                            profiles: {admin: TestHelper.getUserMock({id: 'admin', roles: 'system_admin'})},
                        },
                        roles: {
                            roles: {
                                system_admin: TestHelper.getRoleMock({name: 'system_admin', permissions: [Permissions.SYSCONSOLE_READ_PLUGINS]}),
                            },
                        },
                    },
                },
            );
        };

        const flushDebounce = async () => {
            await act(async () => {
                jest.advanceTimersByTime(500);
            });
        };

        test('replaces the plugin entries when the server reports that plugins changed', async () => {
            const getPlugins = jest.spyOn(Client4, 'getPlugins').
                mockResolvedValueOnce({active: [pluginA], inactive: []}).
                mockResolvedValueOnce({active: [pluginB], inactive: []});

            renderConnectedSidebar();
            expect(await screen.findByText('Plugin A')).toBeInTheDocument();

            act(() => {
                messageListener({event: WebSocketEvents.PluginStatusesChanged} as WebSocketMessage);
                messageListener({event: WebSocketEvents.PluginStatusesChanged} as WebSocketMessage);
            });
            await flushDebounce();

            expect(getPlugins).toHaveBeenCalledTimes(2);
            expect(screen.getByText('Plugin B')).toBeInTheDocument();
            expect(screen.queryByText('Plugin A')).not.toBeInTheDocument();
        });

        test('refetches the plugins on websocket reconnect', async () => {
            jest.spyOn(Client4, 'getPlugins').
                mockResolvedValueOnce({active: [], inactive: []}).
                mockResolvedValueOnce({active: [], inactive: [pluginB]});

            renderConnectedSidebar();
            await flushDebounce();
            expect(screen.queryByText('Plugin B')).not.toBeInTheDocument();

            act(() => {
                reconnectListener();
            });
            await flushDebounce();

            expect(screen.getByText('Plugin B')).toBeInTheDocument();
        });

        test('ignores other websocket events', async () => {
            const getPlugins = jest.spyOn(Client4, 'getPlugins').mockResolvedValue({active: [], inactive: []});

            renderConnectedSidebar();
            await flushDebounce();

            act(() => {
                messageListener({event: WebSocketEvents.Posted} as WebSocketMessage);
            });
            await flushDebounce();

            expect(getPlugins).toHaveBeenCalledTimes(1);
        });

        test('does not fetch plugins when plugins are disabled', async () => {
            const getPlugins = jest.spyOn(Client4, 'getPlugins').mockResolvedValue({active: [pluginA], inactive: []});

            renderConnectedSidebar(false);

            act(() => {
                messageListener({event: WebSocketEvents.PluginStatusesChanged} as WebSocketMessage);
            });
            await flushDebounce();

            expect(getPlugins).not.toHaveBeenCalled();
        });

        test('stops listening and cancels a pending refetch on unmount', async () => {
            const getPlugins = jest.spyOn(Client4, 'getPlugins').mockResolvedValue({active: [], inactive: []});
            const removeReconnectListener = jest.spyOn(WebSocketClient, 'removeReconnectListener');

            const {unmount} = renderConnectedSidebar();
            await flushDebounce();

            act(() => {
                messageListener({event: WebSocketEvents.PluginStatusesChanged} as WebSocketMessage);
            });
            unmount();
            await flushDebounce();

            expect(removeReconnectListener).toHaveBeenCalledWith(reconnectListener);
            expect(getPlugins).toHaveBeenCalledTimes(1);
        });
    });

    describe('generateIndex', () => {
        const props: Props = {
            license: {},
            config: {
                ...defaultProps.config,
                ExperimentalSettings: {
                    RestrictSystemAdmin: false,
                } as ExperimentalSettings,
                PluginSettings: {
                    Enable: true,
                    EnableUploads: true,
                } as PluginSettings,
            },
            adminDefinition: AdminDefinition,
            buildEnterpriseReady: true,
            navigationBlocked: false,
            siteName: 'test snap',
            isCurrentUserSystemAdmin: true,
            plugins: {
                'mattermost-autolink': samplePlugin1,
            },
            onSearchChange: jest.fn(),
            actions: {
                getPlugins: jest.fn(),
            },
            consoleAccess: {...defaultProps.consoleAccess},
            cloud: {...defaultProps.cloud},
            showTaskList: false,
        };

        beforeEach(() => {
            (generateIndex as jest.Mock).mockReset();
        });

        test('should refresh the index in case idx is already present and there is a change in plugins or adminDefinition prop', async () => {
            const idx = {search: jest.fn().mockReturnValue([])};
            (generateIndex as jest.Mock).mockReturnValue(idx);

            const {container, rerender} = renderWithContext(<AdminSidebar {...props}/>);

            // Trigger a search to initialize idx (lazy initialization)
            const filterInput = container.querySelector('#adminSidebarFilter') as HTMLInputElement;
            await userEvent.type(filterInput, 'a');

            // generateIndex should have been called once for the search
            expect(generateIndex).toHaveBeenCalledTimes(1);

            (generateIndex as jest.Mock).mockClear();

            // Change plugins - should trigger regeneration since idx is now set
            rerender(
                <AdminSidebar
                    {...props}
                    plugins={{}}
                />,
            );
            expect(generateIndex).toHaveBeenCalledTimes(1);

            // Change adminDefinition - should trigger regeneration
            rerender(
                <AdminSidebar
                    {...props}
                    plugins={{}}
                    adminDefinition={{} as any}
                />,
            );
            expect(generateIndex).toHaveBeenCalledTimes(2);
        });

        test('should not call the generate index in case of idx is not already present', () => {
            (generateIndex as jest.Mock).mockReturnValue(['mocked-index']);

            const {rerender} = renderWithContext(<AdminSidebar {...props}/>);

            expect(generateIndex).toHaveBeenCalledTimes(0);

            rerender(
                <AdminSidebar
                    {...props}
                    plugins={{}}
                />,
            );
            expect(generateIndex).toHaveBeenCalledTimes(0);

            rerender(
                <AdminSidebar
                    {...props}
                    plugins={{}}
                    adminDefinition={{} as any}
                />,
            );
            expect(generateIndex).toHaveBeenCalledTimes(0);
        });

        test('should not generate index in case of same props', async () => {
            const idx = {search: jest.fn().mockReturnValue([])};
            (generateIndex as jest.Mock).mockReturnValue(idx);

            const {container, rerender} = renderWithContext(<AdminSidebar {...props}/>);

            // Trigger a search to initialize idx
            const filterInput = container.querySelector('#adminSidebarFilter') as HTMLInputElement;
            await userEvent.type(filterInput, 'a');

            expect(generateIndex).toHaveBeenCalledTimes(1);

            (generateIndex as jest.Mock).mockClear();

            // Same plugins - should NOT trigger regeneration
            rerender(
                <AdminSidebar
                    {...props}
                    plugins={{
                        'mattermost-autolink': samplePlugin1,
                    }}
                />,
            );
            expect(generateIndex).toHaveBeenCalledTimes(0);

            // Same adminDefinition - should NOT trigger regeneration
            rerender(
                <AdminSidebar
                    {...props}
                    plugins={{
                        'mattermost-autolink': samplePlugin1,
                    }}
                    adminDefinition={AdminDefinition}
                />,
            );
            expect(generateIndex).toHaveBeenCalledTimes(0);
        });
    });
});
