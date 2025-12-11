// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {screen, cleanup} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type {ExperimentalSettings, PluginSettings, SSOSettings, Office365Settings} from '@mattermost/types/config';

import {RESOURCE_KEYS} from 'mattermost-redux/constants/permissions_sysconsole';

import AdminDefinition from 'components/admin_console/admin_definition';
import AdminSidebar from 'components/admin_console/admin_sidebar/admin_sidebar';
import type {Props as OriginalProps} from 'components/admin_console/admin_sidebar/admin_sidebar';

import {samplePlugin1} from 'tests/helpers/admin_console_plugin_index_sample_pluings';
import {renderWithContext} from 'tests/react_testing_utils';
import {generateIndex} from 'utils/admin_console_index';

jest.mock('utils/utils', () => {
    const original = jest.requireActual('utils/utils');
    return {
        ...original,
        isMobile: jest.fn(() => true),
    };
});

jest.mock('utils/admin_console_index');

// Note: AdminDefinition needs to be the real one as the component relies on its structure
// Mocking it causes errors. Performance improvement comes from other optimizations.

type Props = Omit<OriginalProps, 'intl'>;

// Build console access permissions - returns new object each time to prevent test pollution
const getFullConsoleAccess = () => {
    const access: {read: Record<string, boolean>; write: Record<string, boolean>} = {
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
    };

    // Build all resource key permissions
    Object.keys(RESOURCE_KEYS).forEach((key) => {
        Object.values(RESOURCE_KEYS[key as keyof typeof RESOURCE_KEYS]).forEach((value) => {
            access.read[value as string] = true;
            access.write[value as string] = true;
        });
    });

    return access;
};

// Shared mock plugin to reduce memory usage
const mockPlugin = {
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
};

describe('components/AdminSidebar', () => {
    // Set timeout for all tests in this suite
    jest.setTimeout(10000);

    // Cleanup after each test to prevent memory leaks
    afterEach(() => {
        cleanup();
        jest.clearAllMocks();
    });

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
            plugin_0: mockPlugin,
        },
        onSearchChange: jest.fn(),
        actions: {
            getPlugins: jest.fn(),
        },
        consoleAccess: getFullConsoleAccess(),
        cloud: {
            limits: {
                limitsLoaded: false,
                limits: {},
            },
            errors: {},
        },
        showTaskList: false,
    };

    test('should match snapshot', () => {
        const props = {...defaultProps};
        const {container} = renderWithContext(<AdminSidebar {...props}/>);
        expect(container.firstChild).toMatchSnapshot();
    });

    test('should match snapshot with workspace optimization dashboard enabled', () => {
        const props = {
            ...defaultProps,
            config: {
                ...defaultProps.config,
            },
        };
        const {container} = renderWithContext(<AdminSidebar {...props}/>);
        expect(container.firstChild).toMatchSnapshot();
    });

    test('should match snapshot, no access', () => {
        const props = {
            ...defaultProps,
            consoleAccess: {read: {}, write: {}},
        };
        const {container} = renderWithContext(<AdminSidebar {...props}/>);
        expect(container.firstChild).toMatchSnapshot();
    });

    test('should match snapshot, render plugins without any settings as well', () => {
        const props: Props = {
            ...defaultProps,
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
        };

        const {container} = renderWithContext(<AdminSidebar {...props}/>);
        expect(container.firstChild).toMatchSnapshot();
    });

    test('should match snapshot, not prevent the console from loading when empty settings_schema provided', () => {
        const props: Props = {
            ...defaultProps,
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
        };

        const {container} = renderWithContext(<AdminSidebar {...props}/>);
        expect(container.firstChild).toMatchSnapshot();
    });

    test('should match snapshot, with license (without any explicit feature)', () => {
        const props: Props = {
            ...defaultProps,
            license: {
                IsLicensed: 'true',
            },
            buildEnterpriseReady: true,
        };

        const {container} = renderWithContext(<AdminSidebar {...props}/>);
        expect(container.firstChild).toMatchSnapshot();
    });

    test('should match snapshot, with license (with all feature)', () => {
        const props: Props = {
            ...defaultProps,
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
            buildEnterpriseReady: true,
        };

        const {container} = renderWithContext(<AdminSidebar {...props}/>);
        expect(container.firstChild).toMatchSnapshot();
    });

    test('should match snapshot with license with enterprise SKU', () => {
        const props: Props = {
            ...defaultProps,
            license: {
                IsLicensed: 'true',
                SkuShortName: 'enterprise',
                Cloud: 'true',
            },
            config: {
                ...defaultProps.config,
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
            buildEnterpriseReady: true,
        };

        const {container} = renderWithContext(<AdminSidebar {...props}/>);
        expect(container.firstChild).toMatchSnapshot();
    });

    test('should match snapshot with license with professional SKU', () => {
        const props: Props = {
            ...defaultProps,
            license: {
                IsLicensed: 'true',
                SkuShortName: 'professional',
            },
            config: {
                ...defaultProps.config,
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
            buildEnterpriseReady: true,
        };

        const {container} = renderWithContext(<AdminSidebar {...props}/>);
        expect(container.firstChild).toMatchSnapshot();
    });

    test('should match snapshot with license with enterprise advanced SKU', () => {
        const props: Props = {
            ...defaultProps,
            license: {
                IsLicensed: 'true',
                SkuShortName: 'advanced',
                Cloud: 'true',
            },
            config: {
                ...defaultProps.config,
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
            buildEnterpriseReady: true,
        };

        const {container} = renderWithContext(<AdminSidebar {...props}/>);
        expect(container.firstChild).toMatchSnapshot();
    });


    describe('generateIndex', () => {
        beforeEach(() => {
            jest.clearAllMocks();
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
            consoleAccess: {...defaultProps.consoleAccess},
            cloud: {...defaultProps.cloud},
            showTaskList: false,
        };

        test('should render successfully with generateIndex', () => {
            (generateIndex as jest.Mock).mockReturnValue(['mocked-index']);

            const {container} = renderWithContext(<AdminSidebar {...props}/>);

            // Verify component renders without errors when generateIndex is available
            expect(container.querySelector('.admin-sidebar')).toBeInTheDocument();
        });

        test('should handle plugins prop changes', () => {
            (generateIndex as jest.Mock).mockReturnValue(['mocked-index']);

            const {container, rerender} = renderWithContext(<AdminSidebar {...props}/>);

            // Verify initial render
            expect(container.querySelector('.admin-sidebar')).toBeInTheDocument();

            // Change plugins prop and verify no errors
            rerender(<AdminSidebar {...{...props, plugins: {}}}/>);
            expect(container.querySelector('.admin-sidebar')).toBeInTheDocument();
        });

        test('should handle adminDefinition prop changes', () => {
            (generateIndex as jest.Mock).mockReturnValue(['mocked-index']);

            const {container, rerender} = renderWithContext(<AdminSidebar {...props}/>);

            // Verify initial render
            expect(container.querySelector('.admin-sidebar')).toBeInTheDocument();

            // Change adminDefinition prop and verify no errors
            rerender(<AdminSidebar {...{...props, adminDefinition: {}}}/>);
            expect(container.querySelector('.admin-sidebar')).toBeInTheDocument();
        });
    });

    describe('Plugins', () => {
        const idx = {search: jest.fn()};

        beforeEach(() => {
            jest.clearAllMocks();
            idx.search.mockReset();
            (generateIndex as jest.Mock).mockReturnValue(idx);
        });

        afterEach(() => {
            jest.clearAllMocks();
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
            const {container} = renderWithContext(<AdminSidebar {...props}/>);

            idx.search.mockReturnValue(['plugin_mattermost-autolink']);

            // Find the filter input
            const filterInput = screen.getByPlaceholderText(/find settings/i) || screen.getByRole('searchbox');

            // Type in the filter
            await userEvent.type(filterInput, 'autolink');

            // Verify the search function was called (it's called with each keystroke)
            expect(idx.search).toHaveBeenCalled();

            // Verify the last call contains the full search term
            const lastCall = idx.search.mock.calls[idx.search.mock.calls.length - 1][0];
            expect(lastCall).toContain('autolink');

            // Verify the sidebar continues to render correctly during filtering
            const sidebar = container.querySelector('.admin-sidebar');
            expect(sidebar).toBeInTheDocument();

            // Verify filter input still has the typed value
            expect(filterInput).toHaveValue('autolink');
        });
    });
});
