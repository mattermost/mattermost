// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ExperimentalSettings, PluginSettings, SSOSettings, Office365Settings} from '@mattermost/types/config';

import {RESOURCE_KEYS} from 'mattermost-redux/constants/permissions_sysconsole';

import AdminDefinition from 'components/admin_console/admin_definition';
import AdminSidebar from 'components/admin_console/admin_sidebar/admin_sidebar';
import type {Props as OriginalProps} from 'components/admin_console/admin_sidebar/admin_sidebar';

import {samplePlugin1} from 'tests/helpers/admin_console_plugin_index_sample_pluings';
import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {generateIndex} from 'utils/admin_console_index';

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
        subscriptionProduct: undefined,
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

    test('should match snapshot', () => {
        const props = {...defaultProps};
        const {container} = renderWithContext(<AdminSidebar {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with workspace optimization dashboard enabled', () => {
        const props = {
            ...defaultProps,
            config: {
                ...defaultProps.config,
            },
        };
        const {container} = renderWithContext(<AdminSidebar {...props}/>);
        expect(container).toMatchSnapshot();
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

    test('should match snapshot, no access', () => {
        const props = {
            ...defaultProps,
            consoleAccess: {read: {}, write: {}},
        };
        const {container} = renderWithContext(<AdminSidebar {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, render plugins without any settings as well', () => {
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
            buildEnterpriseReady: false,
            siteName: 'test snap',
            subscriptionProduct: undefined,
            navigationBlocked: false,
            plugins: {
                plugin_0: {
                    active: false,
                    description: 'The plugin 0.',
                    id: 'plugin_0',
                    name: 'Plugin 0',
                    version: '0.1.0',
                    settings_schema: {
                        footer: '',
                        header: '',
                        settings: [],
                    },
                    webapp: {bundle_path: 'webapp/dist/main.js'},
                },
            },
            onSearchChange: jest.fn(),
            actions: {
                getPlugins: jest.fn(),
            },
            consoleAccess: {...defaultProps.consoleAccess},
            cloud: {...defaultProps.cloud},
            showTaskList: false,
        };

        const {container} = renderWithContext(<AdminSidebar {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, not prevent the console from loading when empty settings_schema provided', () => {
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
            buildEnterpriseReady: false,
            siteName: 'test snap',
            subscriptionProduct: undefined,
            navigationBlocked: false,
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
            consoleAccess: {...defaultProps.consoleAccess},
            cloud: {...defaultProps.cloud},
            showTaskList: false,
        };

        const {container} = renderWithContext(<AdminSidebar {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, with license (without any explicit feature)', () => {
        const props: Props = {
            license: {
                IsLicensed: 'true',
            },
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
            subscriptionProduct: undefined,
            plugins: {
                plugin_0: {
                    active: false,
                    description: 'The plugin 0.',
                    id: 'plugin_0',
                    name: 'Plugin 0',
                    version: '0.1.0',
                    settings_schema: {
                        footer: '',
                        header: '',
                        settings: [],
                    },
                    webapp: {bundle_path: 'webapp/dist/main.js'},
                },
            },
            onSearchChange: jest.fn(),
            actions: {
                getPlugins: jest.fn(),
            },
            consoleAccess: {...defaultProps.consoleAccess},
            cloud: {...defaultProps.cloud},
            showTaskList: false,
        };

        const {container} = renderWithContext(<AdminSidebar {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, with license (with all feature)', () => {
        const props: Props = {
            license: {
                IsLicensed: 'true',
                DataRetention: 'true',
                LDAPGroups: 'true',
                LDAP: 'true',
                Cluster: 'true',
                SAML: 'true',
                Compliance: 'true',
                CustomTermsOfService: 'true',
                MessageExport: 'true',
                Elasticsearch: 'true',
                CustomPermissionsSchemes: 'true',
                OpenId: 'true',
                GuestAccounts: 'true',
                Announcement: 'true',
            },
            config: {
                ...defaultProps.config,
                ExperimentalSettings: {
                    RestrictSystemAdmin: false,
                } as ExperimentalSettings,
                PluginSettings: {
                    Enable: true,
                    EnableUploads: true,
                } as PluginSettings,
                GoogleSettings: {
                    Id: 'googleID',
                    Secret: 'googleSecret',
                    Scope: 'scope',
                } as SSOSettings,
                GitLabSettings: {
                    Id: 'gitlabID',
                    Secret: 'gitlabSecret',
                    Scope: 'scope',
                } as SSOSettings,
                Office365Settings: {
                    Id: 'office365ID',
                    Secret: 'office365Secret',
                    Scope: 'scope',
                } as Office365Settings,
            },
            adminDefinition: AdminDefinition,
            buildEnterpriseReady: true,
            navigationBlocked: false,
            siteName: 'test snap',
            subscriptionProduct: undefined,
            plugins: {
                plugin_0: {
                    active: false,
                    description: 'The plugin 0.',
                    id: 'plugin_0',
                    name: 'Plugin 0',
                    version: '0.1.0',
                    settings_schema: {
                        footer: '',
                        header: '',
                        settings: [],
                    },
                    webapp: {bundle_path: 'webapp/dist/main.js'},
                },
            },
            onSearchChange: jest.fn(),
            actions: {
                getPlugins: jest.fn(),
            },
            consoleAccess: {...defaultProps.consoleAccess},
            cloud: {...defaultProps.cloud},
            showTaskList: false,
        };

        const {container} = renderWithContext(<AdminSidebar {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with license with enterprise SKU', () => {
        const props: Props = {
            license: {
                IsLicensed: 'true',
                SkuShortName: 'enterprise',
                Cloud: 'true',
            },
            config: {
                ...defaultProps.config,
                ExperimentalSettings: {
                    RestrictSystemAdmin: false,
                } as ExperimentalSettings,
                PluginSettings: {
                    Enable: true,
                    EnableUploads: true,
                } as PluginSettings,
                GoogleSettings: {
                    Id: 'googleID',
                    Secret: 'googleSecret',
                    Scope: 'scope',
                } as SSOSettings,
                GitLabSettings: {
                    Id: 'gitlabID',
                    Secret: 'gitlabSecret',
                    Scope: 'scope',
                } as SSOSettings,
                Office365Settings: {
                    Id: 'office365ID',
                    Secret: 'office365Secret',
                    Scope: 'scope',
                } as Office365Settings,
                FeatureFlags: {
                    AttributeBasedAccessControl: true,
                    CustomProfileAttributes: true,
                    CloudDedicatedExportUI: true,
                    CloudIPFiltering: true,
                    ExperimentalAuditSettingsSystemConsoleUI: true,
                },
            },
            adminDefinition: AdminDefinition,
            buildEnterpriseReady: true,
            navigationBlocked: false,
            siteName: 'test snap',
            subscriptionProduct: undefined,
            plugins: {
                plugin_0: {
                    active: false,
                    description: 'The plugin 0.',
                    id: 'plugin_0',
                    name: 'Plugin 0',
                    version: '0.1.0',
                    settings_schema: {
                        footer: '',
                        header: '',
                        settings: [],
                    },
                    webapp: {bundle_path: 'webapp/dist/main.js'},
                },
            },
            onSearchChange: jest.fn(),
            actions: {
                getPlugins: jest.fn(),
            },
            consoleAccess: {...defaultProps.consoleAccess},
            cloud: {...defaultProps.cloud},
            showTaskList: false,
        };

        const {container} = renderWithContext(<AdminSidebar {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with license with professional SKU', () => {
        const props: Props = {
            license: {
                IsLicensed: 'true',
                SkuShortName: 'professional',
            },
            config: {
                ...defaultProps.config,
                ExperimentalSettings: {
                    RestrictSystemAdmin: false,
                } as ExperimentalSettings,
                PluginSettings: {
                    Enable: true,
                    EnableUploads: true,
                } as PluginSettings,
                GoogleSettings: {
                    Id: 'googleID',
                    Secret: 'googleSecret',
                    Scope: 'scope',
                } as SSOSettings,
                GitLabSettings: {
                    Id: 'gitlabID',
                    Secret: 'gitlabSecret',
                    Scope: 'scope',
                } as SSOSettings,
                Office365Settings: {
                    Id: 'office365ID',
                    Secret: 'office365Secret',
                    Scope: 'scope',
                } as Office365Settings,
            },
            adminDefinition: AdminDefinition,
            buildEnterpriseReady: true,
            navigationBlocked: false,
            siteName: 'test snap',
            subscriptionProduct: undefined,
            plugins: {
                plugin_0: {
                    active: false,
                    description: 'The plugin 0.',
                    id: 'plugin_0',
                    name: 'Plugin 0',
                    version: '0.1.0',
                    settings_schema: {
                        footer: '',
                        header: '',
                        settings: [],
                    },
                    webapp: {bundle_path: 'webapp/dist/main.js'},
                },
            },
            onSearchChange: jest.fn(),
            actions: {
                getPlugins: jest.fn(),
            },
            consoleAccess: {...defaultProps.consoleAccess},
            cloud: {...defaultProps.cloud},
            showTaskList: false,
        };

        const {container} = renderWithContext(<AdminSidebar {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with license with enterprise advanced SKU', () => {
        const props: Props = {
            license: {
                IsLicensed: 'true',
                SkuShortName: 'advanced',
                Cloud: 'true',
            },
            config: {
                ...defaultProps.config,
                ExperimentalSettings: {
                    RestrictSystemAdmin: false,
                } as ExperimentalSettings,
                PluginSettings: {
                    Enable: true,
                    EnableUploads: true,
                } as PluginSettings,
                GoogleSettings: {
                    Id: 'googleID',
                    Secret: 'googleSecret',
                    Scope: 'scope',
                } as SSOSettings,
                GitLabSettings: {
                    Id: 'gitlabID',
                    Secret: 'gitlabSecret',
                    Scope: 'scope',
                } as SSOSettings,
                Office365Settings: {
                    Id: 'office365ID',
                    Secret: 'office365Secret',
                    Scope: 'scope',
                } as Office365Settings,
                FeatureFlags: {
                    AttributeBasedAccessControl: true,
                    CustomProfileAttributes: true,
                    CloudDedicatedExportUI: true,
                    CloudIPFiltering: true,
                    ExperimentalAuditSettingsSystemConsoleUI: true,
                },
            },
            adminDefinition: AdminDefinition,
            buildEnterpriseReady: true,
            navigationBlocked: false,
            siteName: 'test snap',
            subscriptionProduct: undefined,
            plugins: {
                plugin_0: {
                    active: false,
                    description: 'The plugin 0.',
                    id: 'plugin_0',
                    name: 'Plugin 0',
                    version: '0.1.0',
                    settings_schema: {
                        footer: '',
                        header: '',
                        settings: [],
                    },
                    webapp: {bundle_path: 'webapp/dist/main.js'},
                },
            },
            onSearchChange: jest.fn(),
            actions: {
                getPlugins: jest.fn(),
            },
            consoleAccess: {...defaultProps.consoleAccess},
            cloud: {...defaultProps.cloud},
            showTaskList: false,
        };

        const {container} = renderWithContext(<AdminSidebar {...props}/>);
        expect(container).toMatchSnapshot();
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
            subscriptionProduct: undefined,
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

    describe('Plugins', () => {
        const idx = {search: jest.fn()};

        beforeEach(() => {
            idx.search.mockReset();
            (generateIndex as jest.Mock).mockReturnValue(idx);
        });

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
            subscriptionProduct: undefined,
            plugins: {
                'mattermost-autolink': samplePlugin1,
            },
            onSearchChange: jest.fn(),
            actions: {
                getPlugins: jest.fn(),
            },
            consoleAccess: {
                read: {
                    plugins: true,
                },
                write: {},
            },
            cloud: {...defaultProps.cloud},
            showTaskList: false,
        };

        test('should match snapshot', () => {
            const {container} = renderWithContext(<AdminSidebar {...props}/>);

            expect(container).toMatchSnapshot();
        });

        test('should filter plugins', async () => {
            idx.search.mockReturnValue(['plugin_mattermost-autolink']);

            const {container} = renderWithContext(<AdminSidebar {...props}/>);

            const filterInput = container.querySelector('#adminSidebarFilter') as HTMLInputElement;
            await userEvent.clear(filterInput);
            await userEvent.type(filterInput, 'autolink');

            expect(container).toMatchSnapshot();
        });
    });
});
