// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ExperimentalSettings, PluginSettings, SSOSettings, Office365Settings} from '@mattermost/types/config';

import {RESOURCE_KEYS} from 'mattermost-redux/constants/permissions_sysconsole';

import AdminDefinition from 'components/admin_console/admin_definition';
import AdminSidebar from 'components/admin_console/admin_sidebar/admin_sidebar';
import type {Props as OriginalProps} from 'components/admin_console/admin_sidebar/admin_sidebar';

import {samplePlugin1} from 'tests/helpers/admin_console_plugin_index_sample_pluings';
import {renderWithContext} from 'tests/vitest_react_testing_utils';

vi.mock('utils/utils', () => {
    const original = vi.importActual('utils/utils');
    return {
        ...original,
        isMobile: vi.fn(() => true),
    };
});

vi.mock('utils/admin_console_index', () => ({
    generateIndex: vi.fn(),
}));

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
        onSearchChange: vi.fn(),
        actions: {
            getPlugins: vi.fn(),
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
            onSearchChange: vi.fn(),
            actions: {
                getPlugins: vi.fn(),
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
            onSearchChange: vi.fn(),
            actions: {
                getPlugins: vi.fn(),
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
            onSearchChange: vi.fn(),
            actions: {
                getPlugins: vi.fn(),
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
            onSearchChange: vi.fn(),
            actions: {
                getPlugins: vi.fn(),
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
            onSearchChange: vi.fn(),
            actions: {
                getPlugins: vi.fn(),
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
            onSearchChange: vi.fn(),
            actions: {
                getPlugins: vi.fn(),
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
            onSearchChange: vi.fn(),
            actions: {
                getPlugins: vi.fn(),
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
            onSearchChange: vi.fn(),
            actions: {
                getPlugins: vi.fn(),
            },
            consoleAccess: {...defaultProps.consoleAccess},
            cloud: {...defaultProps.cloud},
            showTaskList: false,
        };

        test('should render with plugins prop', () => {
            const {container} = renderWithContext(<AdminSidebar {...props}/>);
            expect(container).toBeInTheDocument();
        });

        test('should render with different plugins', () => {
            const {rerender} = renderWithContext(<AdminSidebar {...props}/>);

            // Rerender with empty plugins
            rerender(
                <AdminSidebar
                    {...props}
                    plugins={{}}
                />,
            );

            // Component should still render
            expect(document.querySelector('.admin-sidebar')).toBeInTheDocument();
        });

        test('should render with same plugins prop without regenerating index', () => {
            const {rerender} = renderWithContext(<AdminSidebar {...props}/>);

            // Rerender with same plugins
            rerender(
                <AdminSidebar
                    {...props}
                    plugins={{'mattermost-autolink': samplePlugin1}}
                />,
            );

            // Component should render without error
            expect(document.querySelector('.admin-sidebar')).toBeInTheDocument();
        });
    });

    describe('Plugins', () => {
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
            onSearchChange: vi.fn(),
            actions: {
                getPlugins: vi.fn(),
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

        test('should render search input', () => {
            renderWithContext(<AdminSidebar {...props}/>);

            const searchInput = document.getElementById('adminSidebarFilter');
            expect(searchInput).toBeInTheDocument();
        });
    });
});
