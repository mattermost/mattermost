// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {IntlShape} from 'react-intl';

import {SelfHostedSignupProgress} from '@mattermost/types/cloud';
import type {ExperimentalSettings, PluginSettings, SSOSettings, Office365Settings} from '@mattermost/types/config';

import {RESOURCE_KEYS} from 'mattermost-redux/constants/permissions_sysconsole';

import AdminDefinition from 'components/admin_console/admin_definition';
import AdminSidebar from 'components/admin_console/admin_sidebar/admin_sidebar';
import type {Props} from 'components/admin_console/admin_sidebar/admin_sidebar';

import {samplePlugin1} from 'tests/helpers/admin_console_plugin_index_sample_pluings';
import {shallowWithIntl} from 'tests/helpers/intl-test-helper';
import {generateIndex} from 'utils/admin_console_index';

jest.mock('utils/utils', () => {
    const original = jest.requireActual('utils/utils');
    return {
        ...original,
        isMobile: jest.fn(() => true),
    };
});

jest.mock('utils/admin_console_index');

describe('components/AdminSidebar', () => {
    const defaultProps: Props = {
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
        intl: {} as IntlShape,
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
        onFilterChange: jest.fn(),
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
            selfHostedSignup: {
                progress: SelfHostedSignupProgress.START,
            },
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
        const wrapper = shallowWithIntl(<AdminSidebar {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with workspace optimization dashboard enabled', () => {
        const props = {
            ...defaultProps,
            config: {
                ...defaultProps.config,
            },
        };
        const wrapper = shallowWithIntl(<AdminSidebar {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, no access', () => {
        const props = {
            ...defaultProps,
            consoleAccess: {read: {}, write: {}},
        };
        const wrapper = shallowWithIntl(<AdminSidebar {...props}/>);
        expect(wrapper).toMatchSnapshot();
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
            intl: {} as IntlShape,
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
            onFilterChange: jest.fn(),
            actions: {
                getPlugins: jest.fn(),
            },
            consoleAccess: {...defaultProps.consoleAccess},
            cloud: {...defaultProps.cloud},
            showTaskList: false,
        };

        const wrapper = shallowWithIntl(<AdminSidebar {...props}/>);
        expect(wrapper).toMatchSnapshot();
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
            intl: {} as IntlShape,
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
            onFilterChange: jest.fn(),
            actions: {
                getPlugins: jest.fn(),
            },
            consoleAccess: {...defaultProps.consoleAccess},
            cloud: {...defaultProps.cloud},
            showTaskList: false,
        };

        const wrapper = shallowWithIntl(<AdminSidebar {...props}/>);
        expect(wrapper).toMatchSnapshot();
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
            intl: {} as IntlShape,
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
            onFilterChange: jest.fn(),
            actions: {
                getPlugins: jest.fn(),
            },
            consoleAccess: {...defaultProps.consoleAccess},
            cloud: {...defaultProps.cloud},
            showTaskList: false,
        };

        const wrapper = shallowWithIntl(<AdminSidebar {...props}/>);
        expect(wrapper).toMatchSnapshot();
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
            intl: {} as IntlShape,
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
            onFilterChange: jest.fn(),
            actions: {
                getPlugins: jest.fn(),
            },
            consoleAccess: {...defaultProps.consoleAccess},
            cloud: {...defaultProps.cloud},
            showTaskList: false,
        };

        const wrapper = shallowWithIntl(<AdminSidebar {...props}/>);
        expect(wrapper).toMatchSnapshot();
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
            intl: {} as IntlShape,
            adminDefinition: AdminDefinition,
            buildEnterpriseReady: true,
            navigationBlocked: false,
            siteName: 'test snap',
            subscriptionProduct: undefined,
            plugins: {
                'mattermost-autolink': samplePlugin1,
            },
            onFilterChange: jest.fn(),
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

        test('should refresh the index in case idx is already present and there is a change in plugins or adminDefinition prop', () => {
            (generateIndex as jest.Mock).mockReturnValue(['mocked-index']);

            const wrapper = shallowWithIntl(<AdminSidebar {...props}/>);
            (wrapper.instance() as any).idx = ['some value'];

            expect(generateIndex).toHaveBeenCalledTimes(0);

            wrapper.setProps({plugins: {}});
            expect(generateIndex).toHaveBeenCalledTimes(1);

            wrapper.setProps({adminDefinition: {}});
            expect(generateIndex).toHaveBeenCalledTimes(2);
        });

        test('should not call the generate index in case of idx is not already present', () => {
            (generateIndex as jest.Mock).mockReturnValue(['mocked-index']);

            const wrapper = shallowWithIntl(<AdminSidebar {...props}/>);

            expect(generateIndex).toHaveBeenCalledTimes(0);

            wrapper.setProps({plugins: {}});
            expect(generateIndex).toHaveBeenCalledTimes(0);

            wrapper.setProps({adminDefinition: {}});
            expect(generateIndex).toHaveBeenCalledTimes(0);
        });

        test('should not generate index in case of same props', () => {
            (generateIndex as jest.Mock).mockReturnValue(['mocked-index']);

            const wrapper = shallowWithIntl(<AdminSidebar {...props}/>);
            (wrapper.instance() as any).idx = ['some value'];

            expect(generateIndex).toHaveBeenCalledTimes(0);

            wrapper.setProps({plugins: {
                'mattermost-autolink': samplePlugin1,
            }});
            expect(generateIndex).toHaveBeenCalledTimes(0);

            wrapper.setProps({adminDefinition: AdminDefinition});
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
            intl: {} as IntlShape,
            adminDefinition: AdminDefinition,
            buildEnterpriseReady: true,
            navigationBlocked: false,
            siteName: 'test snap',
            subscriptionProduct: undefined,
            plugins: {
                'mattermost-autolink': samplePlugin1,
            },
            onFilterChange: jest.fn(),
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
            const wrapper = shallowWithIntl(<AdminSidebar {...props}/>);

            expect(wrapper).toMatchSnapshot();
        });

        test('should filter plugins', () => {
            const wrapper = shallowWithIntl(<AdminSidebar {...props}/>);

            idx.search.mockReturnValue(['plugin_mattermost-autolink']);
            wrapper.find('#adminSidebarFilter').simulate('change', {target: {value: 'autolink'}});

            expect((wrapper.instance().state as any).sections).toEqual(['plugin_mattermost-autolink']);
            expect(wrapper).toMatchSnapshot();
            expect(wrapper.find('AdminSidebarCategory')).toHaveLength(1);
            expect(wrapper.find('AdminSidebarSection')).toHaveLength(1);
            const autoLinkPluginSection = wrapper.find('AdminSidebarSection').at(0);
            expect(autoLinkPluginSection.prop('name')).toBe('plugins/plugin_mattermost-autolink');
        });
    });
});
