// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {General} from 'mattermost-redux/constants';

import {act, renderWithContext, screen, waitFor, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {ChannelSettingsTabBodyProps} from 'types/plugins/channel_settings';
import type {GlobalState} from 'types/store';
import type {ChannelSettingsSchemaTabComponent, ChannelSettingsTabComponent} from 'types/store/plugins';

import ChannelSettingsModal from './channel_settings_modal';

// Variables to control permission check results in tests
let mockPrivateChannelPermission = true;
let mockPublicChannelPermission = true;
let mockManageChannelAccessRulesPermission = false;
let mockManageSharedChannelsPermission = false;
const mockGetBasePath = jest.fn(() => '');
const mockSettingsSidebar = jest.fn();
const mockChannelSettingsPluginTab = jest.fn();
const pluginSaveMocks = new Map<string, jest.Mock<Promise<void>, []>>();
const pluginResetMocks = new Map<string, jest.Mock<void, []>>();

// Mock the channel banner selector
jest.mock('mattermost-redux/selectors/entities/channel_banner', () => ({
    selectChannelBannerEnabled: jest.fn().mockImplementation((state) => {
        // Return true only for advanced license, false for all others
        return state?.entities?.general?.license?.SkuShortName === 'advanced';
    }),
}));

// Mock the roles selector which is used for permission checks
jest.mock('mattermost-redux/selectors/entities/roles', () => ({
    haveIChannelPermission: jest.fn().mockImplementation((state, teamId, channelId, permission) => {
        // Return different values based on the permission being checked
        if (permission === 'delete_private_channel') {
            return mockPrivateChannelPermission;
        }
        if (permission === 'delete_public_channel') {
            return mockPublicChannelPermission;
        }
        if (permission === 'manage_channel_access_rules') {
            return mockManageChannelAccessRulesPermission;
        }
        return true;
    }),
    haveISystemPermission: jest.fn().mockImplementation((state, {permission}) => {
        if (permission === 'manage_shared_channels') {
            return mockManageSharedChannelsPermission;
        }
        return false;
    }),
}));

// Mock the general selectors
jest.mock('selectors/general', () => ({
    isChannelAccessControlEnabled: jest.fn().mockReturnValue(true),
    getBasePath: () => mockGetBasePath(),
}));

jest.mock('utils/url', () => ({
    isValidUrl: jest.fn((url = '') => (/^https?:\/\//i).test(url)),
}));

// Mock child components to provide controlled testing interfaces
jest.mock('./channel_settings_info_tab', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const React = require('react');

    return function MockChannelSettingsInfoTab({
        setAreThereUnsavedChanges,
        showTabSwitchError,
    }: {
        setAreThereUnsavedChanges?: (value: boolean) => void;
        showTabSwitchError?: boolean;
    }) {
        return React.createElement('div', {'data-testid': 'info-tab'}, [
            'Info Tab Content',

            // Provide test controls for state management
            setAreThereUnsavedChanges && React.createElement('button', {
                key: 'set-unsaved',
                'data-testid': 'set-unsaved-changes',
                onClick: () => setAreThereUnsavedChanges(true),
            }, 'Make Unsaved Changes'),

            setAreThereUnsavedChanges && React.createElement('button', {
                key: 'save',
                'data-testid': 'save-changes',
                onClick: () => setAreThereUnsavedChanges(false),
            }, 'Save Changes'),

            // Display warning message during error states
            showTabSwitchError && React.createElement('div', {
                key: 'warning',
                'data-testid': 'warning-panel',
            }, 'You have unsaved changes'),
        ]);
    };
});

jest.mock('./channel_settings_configuration_tab', () => {
    return function MockConfigTab(): JSX.Element {
        return <div data-testid='config-tab'>{'Configuration Tab Content'}</div>;
    };
});

jest.mock('./channel_settings_archive_tab', () => {
    return function MockArchiveTab(): JSX.Element {
        return <div data-testid='archive-tab'>{'Archive Tab Content'}</div>;
    };
});

jest.mock('./channel_settings_access_rules_tab', () => {
    return function MockAccessRulesTab(): JSX.Element {
        return <div data-testid='access-rules-tab'>{'Access Rules Tab Content'}</div>;
    };
});

// Define the tab type for the settings sidebar
type TabType = {
    name: string;
    uiName: string;
    display?: boolean;
    newGroup?: boolean;
};

// Mock the settings sidebar
jest.mock('components/settings_sidebar', () => {
    return function MockSettingsSidebar({
        tabs,
        pluginTabs = [],
        activeTab,
        updateTab,
    }: {
        tabs: TabType[];
        pluginTabs?: TabType[];
        activeTab: string;
        updateTab: (tab: string) => void;
    }): JSX.Element {
        mockSettingsSidebar({
            tabs,
            pluginTabs,
            activeTab,
            updateTab,
        });

        const visibleTabs = [
            ...tabs.filter((tab) => tab.display !== false),
            ...pluginTabs.filter((tab) => tab.display !== false),
        ];

        return (
            <div data-testid='settings-sidebar'>
                {visibleTabs.map((tab) => (
                    <button
                        data-testid={`${tab.name}-tab-button`}
                        key={tab.name}
                        role='tab'
                        aria-selected={activeTab === tab.name}
                        aria-label={tab.uiName.toLowerCase()}
                        onClick={() => updateTab(tab.name)}
                    >
                        {tab.uiName}
                    </button>
                ))}
            </div>
        );
    };
});

describe('ChannelSettingsModal', () => {
    const channelId = 'channel1';

    const baseProps = {
        channelId,
        isOpen: true,
        onExited: jest.fn(),
        focusOriginElement: 'button1',
    };

    function getPluginSaveMock(registrationId: string) {
        let save = pluginSaveMocks.get(registrationId);
        if (!save) {
            save = jest.fn(async () => {});
            pluginSaveMocks.set(registrationId, save);
        }
        return save;
    }

    function getPluginResetMock(registrationId: string) {
        let reset = pluginResetMocks.get(registrationId);
        if (!reset) {
            reset = jest.fn();
            pluginResetMocks.set(registrationId, reset);
        }
        return reset;
    }

    function createPluginComponent(registrationId: string, registerHandlersFlag = true) {
        return function TestChannelSettingsPluginTab({
            channel,
            setUnsaved,
            registerHandlers,
        }: ChannelSettingsTabBodyProps) {
            React.useEffect(() => {
                if (!registerHandlersFlag || !registerHandlers) {
                    return undefined;
                }

                registerHandlers({
                    save: getPluginSaveMock(registrationId),
                    reset: getPluginResetMock(registrationId),
                });
                return () => registerHandlers(null);
            }, [registerHandlers]);

            mockChannelSettingsPluginTab({
                registrationId,
                channel,
                setUnsaved,
                registerHandlers,
            });

            return (
                <div
                    data-testid='channel-settings-pluggable'
                    data-plugin-registration-id={registrationId}
                    data-channel-id={channel.id}
                    data-has-set-unsaved={String(Boolean(setUnsaved))}
                    data-has-register-handlers={String(Boolean(registerHandlers))}
                >
                    {'Plugin Tab Content'}
                    {setUnsaved && (
                        <button
                            data-testid='pluggable-set-unsaved-changes'
                            onClick={() => setUnsaved(true)}
                        >
                            {'Set Plugin Unsaved Changes'}
                        </button>
                    )}
                </div>
            );
        };
    }

    function makeTestState(pluginRegistrations: ChannelSettingsTabComponent[] = []): GlobalState {
        const state: DeepPartial<GlobalState> = {
            entities: {
                channels: {
                    channels: {
                        [channelId]: TestHelper.getChannelMock({
                            id: channelId,
                            type: General.OPEN_CHANNEL,
                            purpose: 'Testing purpose',
                            header: 'Channel header',
                            group_constrained: false,
                        }),
                    },
                },
                general: {
                    license: {
                        SkuShortName: '',
                    },
                    config: {},
                },
            },
            plugins: {
                channelSettingsTabs: pluginRegistrations,
            },
        };
        return state as GlobalState;
    }

    function makePluginTabRegistration(overrides: Partial<ChannelSettingsTabComponent> = {}, registerHandlersFlag = true): ChannelSettingsTabComponent {
        const registrationId = overrides.id ?? 'plugin-tab-1';

        return {
            id: registrationId,
            pluginId: 'plugin-id',
            kind: 'custom',
            uiName: 'Plugin Tab',
            icon: 'icon-plugin-tab',
            shouldRender: jest.fn(() => true),
            component: createPluginComponent(registrationId, registerHandlersFlag),
            ...overrides,
        } as ChannelSettingsTabComponent;
    }

    function makeSchemaTabRegistration(onSave: jest.Mock, overrides: Partial<ChannelSettingsSchemaTabComponent> = {}): ChannelSettingsSchemaTabComponent {
        const registrationId = overrides.id ?? 'schema-tab-1';

        return {
            id: registrationId,
            pluginId: 'plugin-id',
            kind: 'schema',
            uiName: 'Schema Tab',
            icon: 'icon-schema-tab',
            shouldRender: jest.fn(() => true),
            schema: {
                uiName: 'Schema Tab',
                sections: [
                    {
                        title: 'Appearance',
                        settings: [
                            {
                                name: 'color',
                                title: 'Color',
                                type: 'radio',
                                default: 'red',
                                options: [
                                    {value: 'red', text: 'Red'},
                                    {value: 'blue', text: 'Blue'},
                                ],
                            },
                        ],
                    },
                ],
                onSave,
            },
            ...overrides,
        };
    }

    function getLatestSettingsSidebarProps() {
        return mockSettingsSidebar.mock.calls[mockSettingsSidebar.mock.calls.length - 1]?.[0];
    }

    beforeEach(() => {
        mockPrivateChannelPermission = true;
        mockPublicChannelPermission = true;
        mockManageChannelAccessRulesPermission = false; // Default to no access rules permission
        mockManageSharedChannelsPermission = false;
        mockGetBasePath.mockReturnValue('');
        mockChannelSettingsPluginTab.mockClear();
        mockSettingsSidebar.mockClear();
        pluginSaveMocks.clear();
        pluginResetMocks.clear();
        baseProps.onExited.mockClear();
    });

    it('should render the modal with correct header text', async () => {
        const testState = makeTestState();

        renderWithContext(<ChannelSettingsModal {...baseProps}/>, testState);

        // Use wait for to ensure the component is completely loaded and avoid
        // act related errors during test.
        await waitFor(() => {
            expect(screen.getByText('Channel Settings')).toBeInTheDocument();
        });
    });

    it('should render Info tab by default', async () => {
        const testState = makeTestState();

        renderWithContext(<ChannelSettingsModal {...baseProps}/>, testState);

        // Wait for the lazy-loaded components
        await waitFor(() => {
            expect(screen.getByTestId('info-tab')).toBeInTheDocument();
        });
    });

    it('should switch tabs when clicked', async () => {
        const testState = makeTestState();

        renderWithContext(<ChannelSettingsModal {...baseProps}/>, testState);

        // Wait for the sidebar to load
        await waitFor(() => {
            expect(screen.getByTestId('settings-sidebar')).toBeInTheDocument();
        });

        // Initially the info tab should be active
        expect(screen.getByTestId('info-tab')).toBeInTheDocument();

        // Find and click the archive tab
        const archiveTab = screen.getByRole('tab', {name: /archive channel/i});
        await userEvent.click(archiveTab);

        // Now the archive tab should be visible
        expect(screen.getByTestId('archive-tab')).toBeInTheDocument();
    });

    it('should not show archive tab for default channel', async () => {
        const testState = makeTestState();

        testState.entities.channels.channels[channelId].name = 'town-square';

        renderWithContext(<ChannelSettingsModal {...baseProps}/>, testState);

        // Wait for the sidebar to load
        await waitFor(() => {
            expect(screen.getByTestId('settings-sidebar')).toBeInTheDocument();
        });

        // The info tab should be visible
        expect(screen.getByTestId('info-tab')).toBeInTheDocument();

        // The archive tab should not be in the document
        expect(screen.queryByRole('tab', {name: /archive channel/i})).not.toBeInTheDocument();
    });

    it('should show archive tab for public channel when user has permission', async () => {
        mockPublicChannelPermission = true;

        const testState = makeTestState();

        renderWithContext(<ChannelSettingsModal {...baseProps}/>, testState);

        // Wait for the sidebar to load
        await waitFor(() => {
            expect(screen.getByTestId('settings-sidebar')).toBeInTheDocument();
        });

        // The archive tab should be visible
        expect(screen.getByRole('tab', {name: /archive channel/i})).toBeInTheDocument();
    });

    it('should not show archive tab for public channel when user does not have permission', async () => {
        mockPublicChannelPermission = false;

        const testState = makeTestState();

        renderWithContext(<ChannelSettingsModal {...baseProps}/>, testState);

        // Wait for the sidebar to load
        await waitFor(() => {
            expect(screen.getByTestId('settings-sidebar')).toBeInTheDocument();
        });

        // The archive tab should not be in the document
        expect(screen.queryByRole('tab', {name: /archive channel/i})).not.toBeInTheDocument();
    });

    it('should show archive tab for private channel when user has permission', async () => {
        mockPrivateChannelPermission = true;

        const testState = makeTestState();
        testState.entities.channels.channels[channelId].type = General.PRIVATE_CHANNEL;

        renderWithContext(<ChannelSettingsModal {...baseProps}/>, testState);

        // Wait for the sidebar to load
        await waitFor(() => {
            expect(screen.getByTestId('settings-sidebar')).toBeInTheDocument();
        });

        // The archive tab should be visible
        expect(screen.getByRole('tab', {name: /archive channel/i})).toBeInTheDocument();
    });

    it('should not show archive tab for private channel when user does not have permission', async () => {
        mockPrivateChannelPermission = false;

        const testState = makeTestState();
        testState.entities.channels.channels[channelId].type = General.PRIVATE_CHANNEL;

        renderWithContext(<ChannelSettingsModal {...baseProps}/>, testState);

        // Wait for the sidebar to load
        await waitFor(() => {
            expect(screen.getByTestId('settings-sidebar')).toBeInTheDocument();
        });

        // The archive tab should not be in the document
        expect(screen.queryByRole('tab', {name: /archive channel/i})).not.toBeInTheDocument();
    });

    it('should not show configuration tab with no license', async () => {
        const testState = makeTestState();

        renderWithContext(<ChannelSettingsModal {...baseProps}/>, testState);
        expect(screen.queryByTestId('configuration-tab-button')).not.toBeInTheDocument();
    });

    it('should not show configuration tab with professional license', async () => {
        const testState = makeTestState();
        testState.entities.general.license.SkuShortName = 'professional';

        renderWithContext(<ChannelSettingsModal {...baseProps}/>, testState);
        expect(screen.queryByTestId('configuration-tab-button')).not.toBeInTheDocument();
    });

    it('should not show configuration tab with enterprise license', async () => {
        const testState = makeTestState();
        testState.entities.general.license.SkuShortName = 'enterprise';

        renderWithContext(<ChannelSettingsModal {...baseProps}/>, testState);
        expect(screen.queryByTestId('configuration-tab-button')).not.toBeInTheDocument();
    });

    it('should show configuration tab when enterprise advanced license', async () => {
        const testState = makeTestState();
        testState.entities.general.license.SkuShortName = 'advanced';

        renderWithContext(<ChannelSettingsModal {...baseProps}/>, testState);
        expect(screen.getByTestId('configuration-tab-button')).toBeInTheDocument();
    });

    it('should show configuration tab when Connected Workspaces enabled and user has manage_shared_channels', async () => {
        mockManageSharedChannelsPermission = true;

        const testState = makeTestState();
        testState.entities.general.config.ExperimentalSharedChannels = 'true';

        renderWithContext(<ChannelSettingsModal {...baseProps}/>, testState);
        expect(screen.getByTestId('configuration-tab-button')).toBeInTheDocument();
    });

    describe('Access Control tab visibility', () => {
        it('should show Access Control tab for private channel when user has permission', async () => {
            mockManageChannelAccessRulesPermission = true;

            const testState = makeTestState();
            testState.entities.channels.channels[channelId].type = General.PRIVATE_CHANNEL;

            renderWithContext(<ChannelSettingsModal {...baseProps}/>, testState);

            // Wait for the sidebar to load
            await waitFor(() => {
                expect(screen.getByTestId('settings-sidebar')).toBeInTheDocument();
            });

            // The Membership Policy tab should be visible
            expect(screen.getByRole('tab', {name: /membership policy/i})).toBeInTheDocument();
            expect(screen.getByText('Membership Policy')).toBeInTheDocument();
        });

        it('should not show Access Control tab for private channel when user lacks permission', async () => {
            mockManageChannelAccessRulesPermission = false;

            const testState = makeTestState();
            testState.entities.channels.channels[channelId].type = General.PRIVATE_CHANNEL;

            renderWithContext(<ChannelSettingsModal {...baseProps}/>, testState);

            // Wait for the sidebar to load
            await waitFor(() => {
                expect(screen.getByTestId('settings-sidebar')).toBeInTheDocument();
            });

            // The Membership Policy tab should not be visible
            expect(screen.queryByRole('tab', {name: /membership policy/i})).not.toBeInTheDocument();
            expect(screen.queryByText('Membership Policy')).not.toBeInTheDocument();
        });

        it('should show Access Control tab for public channel when user has permission', async () => {
            mockManageChannelAccessRulesPermission = true;

            const testState = makeTestState();

            renderWithContext(<ChannelSettingsModal {...baseProps}/>, testState);

            // Wait for the sidebar to load
            await waitFor(() => {
                expect(screen.getByTestId('settings-sidebar')).toBeInTheDocument();
            });

            // Public channels are eligible for ABAC policies (advisory / auto-add),
            // so the Access Rules tab should be available when the user can manage them.
            expect(screen.getByRole('tab', {name: /membership policy/i})).toBeInTheDocument();
        });

        it('should not show Access Control tab for public channel without permission', async () => {
            mockManageChannelAccessRulesPermission = false;

            const testState = makeTestState();

            renderWithContext(<ChannelSettingsModal {...baseProps}/>, testState);

            // Wait for the sidebar to load
            await waitFor(() => {
                expect(screen.getByTestId('settings-sidebar')).toBeInTheDocument();
            });

            // The Membership Policy tab should not be visible
            expect(screen.queryByRole('tab', {name: /membership policy/i})).not.toBeInTheDocument();
            expect(screen.queryByText('Membership Policy')).not.toBeInTheDocument();
        });

        it.each([
            ['town-square', 'town-square'],
            ['off-topic', 'off-topic'],
        ])('should not show Access Control tab on %s default channel even with permission', async (_label, channelName) => {
            // The server rejects ABAC policies on default channels via
            // ValidateChannelEligibilityForAccessControl, so the tab would only
            // let the user assemble rules they can never save.
            mockManageChannelAccessRulesPermission = true;

            const testState = makeTestState();
            testState.entities.channels.channels[channelId].name = channelName;

            renderWithContext(<ChannelSettingsModal {...baseProps}/>, testState);

            await waitFor(() => {
                expect(screen.getByTestId('settings-sidebar')).toBeInTheDocument();
            });

            expect(screen.queryByRole('tab', {name: /membership policy/i})).not.toBeInTheDocument();
            expect(screen.queryByText('Membership Policy')).not.toBeInTheDocument();
        });

        it('should be able to navigate to Access Control tab when visible', async () => {
            mockManageChannelAccessRulesPermission = true;

            const testState = makeTestState();
            testState.entities.channels.channels[channelId].type = General.PRIVATE_CHANNEL;

            renderWithContext(<ChannelSettingsModal {...baseProps}/>, testState);

            // Wait for the sidebar to load
            await waitFor(() => {
                expect(screen.getByTestId('settings-sidebar')).toBeInTheDocument();
            });

            // Initially the info tab should be active
            expect(screen.getByTestId('info-tab')).toBeInTheDocument();

            // Find and click the Membership Policy tab
            const accessControlTab = screen.getByRole('tab', {name: /membership policy/i});
            await userEvent.click(accessControlTab);

            // Now the Access Control tab content should be visible
            expect(screen.getByTestId('access-rules-tab')).toBeInTheDocument();
            expect(screen.getByText('Access Rules Tab Content')).toBeInTheDocument();
        });

        it('should show correct tab label as "Membership Policy"', async () => {
            mockManageChannelAccessRulesPermission = true;

            const testState = makeTestState();
            testState.entities.channels.channels[channelId].type = General.PRIVATE_CHANNEL;

            renderWithContext(<ChannelSettingsModal {...baseProps}/>, testState);

            // Wait for the sidebar to load
            await waitFor(() => {
                expect(screen.getByTestId('settings-sidebar')).toBeInTheDocument();
            });

            // Verify the tab shows the correct label
            const accessControlTab = screen.getByRole('tab', {name: /membership policy/i});
            expect(accessControlTab).toHaveTextContent('Membership Policy');
        });

        it('should not show Membership Policy tab for shared channels', async () => {
            mockManageChannelAccessRulesPermission = true;

            const testState = makeTestState();
            testState.entities.channels.channels[channelId].type = General.PRIVATE_CHANNEL;
            testState.entities.channels.channels[channelId].shared = true;

            renderWithContext(<ChannelSettingsModal {...baseProps}/>, testState);

            await waitFor(() => {
                expect(screen.getByTestId('settings-sidebar')).toBeInTheDocument();
            });

            expect(screen.queryByRole('tab', {name: /membership policy/i})).not.toBeInTheDocument();
            expect(screen.queryByText('Membership Policy')).not.toBeInTheDocument();
        });

        it('should not show Access Control tab for group-constrained private channel even with permission', async () => {
            mockManageChannelAccessRulesPermission = true;

            const testState = makeTestState();
            testState.entities.channels.channels[channelId].type = General.PRIVATE_CHANNEL;
            testState.entities.channels.channels[channelId].group_constrained = true;

            renderWithContext(<ChannelSettingsModal {...baseProps}/>, testState);

            // Wait for the sidebar to load
            await waitFor(() => {
                expect(screen.getByTestId('settings-sidebar')).toBeInTheDocument();
            });

            // The Membership Policy tab should not be visible for group-constrained channels
            expect(screen.queryByRole('tab', {name: /membership policy/i})).not.toBeInTheDocument();
            expect(screen.queryByText('Membership Policy')).not.toBeInTheDocument();
        });

        it('should not show Access Control tab for group-constrained private channel without permission', async () => {
            mockManageChannelAccessRulesPermission = false;

            const testState = makeTestState();
            testState.entities.channels.channels[channelId].type = General.PRIVATE_CHANNEL;
            testState.entities.channels.channels[channelId].group_constrained = true;

            renderWithContext(<ChannelSettingsModal {...baseProps}/>, testState);

            // Wait for the sidebar to load
            await waitFor(() => {
                expect(screen.getByTestId('settings-sidebar')).toBeInTheDocument();
            });

            // The Membership Policy tab should not be visible (for multiple reasons)
            expect(screen.queryByRole('tab', {name: /membership policy/i})).not.toBeInTheDocument();
            expect(screen.queryByText('Membership Policy')).not.toBeInTheDocument();
        });

        it('should not show Access Control tab for group-constrained public channel', async () => {
            mockManageChannelAccessRulesPermission = true;

            const testState = makeTestState();
            testState.entities.channels.channels[channelId].group_constrained = true;

            renderWithContext(<ChannelSettingsModal {...baseProps}/>, testState);

            // Wait for the sidebar to load
            await waitFor(() => {
                expect(screen.getByTestId('settings-sidebar')).toBeInTheDocument();
            });

            // The Membership Policy tab should not be visible (for multiple reasons: public + group-constrained)
            expect(screen.queryByRole('tab', {name: /membership policy/i})).not.toBeInTheDocument();
            expect(screen.queryByText('Membership Policy')).not.toBeInTheDocument();
        });
    });

    describe('plugin tab wiring', () => {
        it('renders registered plugin tabs', async () => {
            const registration = makePluginTabRegistration();

            renderWithContext(<ChannelSettingsModal {...baseProps}/>, makeTestState([registration]));

            await waitFor(() => {
                expect(screen.getByTestId('settings-sidebar')).toBeInTheDocument();
            });

            expect(screen.getByRole('tab', {name: /plugin tab/i})).toBeInTheDocument();
        });

        it('does not render plugin tabs whose shouldRender returns false', async () => {
            const registration = makePluginTabRegistration({shouldRender: jest.fn(() => false)});

            renderWithContext(<ChannelSettingsModal {...baseProps}/>, makeTestState([registration]));

            await waitFor(() => {
                expect(screen.getByTestId('settings-sidebar')).toBeInTheDocument();
            });

            expect(screen.queryByRole('tab', {name: /plugin tab/i})).not.toBeInTheDocument();
        });

        it('prefixes root-relative plugin icon paths with the base path', async () => {
            mockGetBasePath.mockReturnValue('/subpath');
            const registration = makePluginTabRegistration({icon: '/plugins/test/public/icon.svg'});

            renderWithContext(<ChannelSettingsModal {...baseProps}/>, makeTestState([registration]));

            await waitFor(() => {
                expect(screen.getByRole('tab', {name: /plugin tab/i})).toBeInTheDocument();
            });

            const sidebarProps = getLatestSettingsSidebarProps();
            expect(sidebarProps.pluginTabs[0].icon).toEqual({url: '/subpath/plugins/test/public/icon.svg'});
        });

        it('does not mark Archive Channel as a new group break', async () => {
            renderWithContext(<ChannelSettingsModal {...baseProps}/>, makeTestState());

            await waitFor(() => {
                expect(screen.getByTestId('settings-sidebar')).toBeInTheDocument();
            });

            const sidebarProps = getLatestSettingsSidebarProps();
            const archiveTab = sidebarProps.tabs.find((tab: TabType) => tab.name === 'archive');

            expect(archiveTab).toBeDefined();
            expect(archiveTab?.newGroup).toBeUndefined();
        });

        it('renders plugin content through Pluggable when a plugin tab is clicked', async () => {
            const registration = makePluginTabRegistration();

            renderWithContext(<ChannelSettingsModal {...baseProps}/>, makeTestState([registration]));

            await waitFor(() => {
                expect(screen.getByRole('tab', {name: /plugin tab/i})).toBeInTheDocument();
            });

            await userEvent.click(screen.getByRole('tab', {name: /plugin tab/i}));

            await waitFor(() => {
                expect(screen.getByTestId('channel-settings-pluggable')).toBeInTheDocument();
            });

            expect(screen.getByTestId('channel-settings-pluggable')).toHaveAttribute('data-plugin-registration-id', registration.id);
            expect(screen.getByTestId('channel-settings-pluggable')).toHaveAttribute('data-channel-id', channelId);
        });

        it('passes unsaved-change props through to the selected plugin tab', async () => {
            const registration = makePluginTabRegistration();

            renderWithContext(<ChannelSettingsModal {...baseProps}/>, makeTestState([registration]));

            await waitFor(() => {
                expect(screen.getByRole('tab', {name: /plugin tab/i})).toBeInTheDocument();
            });

            await userEvent.click(screen.getByRole('tab', {name: /plugin tab/i}));

            await waitFor(() => {
                expect(screen.getByTestId('channel-settings-pluggable')).toBeInTheDocument();
            });

            expect(screen.getByTestId('channel-settings-pluggable')).toHaveAttribute('data-has-set-unsaved', 'true');
            expect(screen.getByTestId('channel-settings-pluggable')).toHaveAttribute('data-has-register-handlers', 'true');

            await userEvent.click(screen.getByTestId('pluggable-set-unsaved-changes'));

            await waitFor(() => {
                expect(screen.getByTestId('SaveChangesPanel__save-btn')).toBeInTheDocument();
            });

            await userEvent.click(screen.getByRole('tab', {name: /info/i}));

            await waitFor(() => {
                expect(screen.getByTestId('SaveChangesPanel__save-btn')).toBeDisabled();
            });
        });

        it('clears plugin save handlers before switching between plugin tabs', async () => {
            const firstRegistration = makePluginTabRegistration({id: 'plugin-tab-1', uiName: 'Plugin Tab 1'});
            const secondRegistration = makePluginTabRegistration({id: 'plugin-tab-2', uiName: 'Plugin Tab 2'}, false);

            renderWithContext(<ChannelSettingsModal {...baseProps}/>, makeTestState([firstRegistration, secondRegistration]));

            await waitFor(() => {
                expect(screen.getByRole('tab', {name: /plugin tab 1/i})).toBeInTheDocument();
            });

            await userEvent.click(screen.getByRole('tab', {name: /plugin tab 1/i}));
            await waitFor(() => {
                expect(screen.getByTestId('channel-settings-pluggable')).toHaveAttribute('data-plugin-registration-id', 'plugin-tab-1');
            });

            await userEvent.click(screen.getByRole('tab', {name: /plugin tab 2/i}));
            await waitFor(() => {
                expect(screen.getByTestId('channel-settings-pluggable')).toHaveAttribute('data-plugin-registration-id', 'plugin-tab-2');
            });

            await userEvent.click(screen.getByTestId('pluggable-set-unsaved-changes'));
            await waitFor(() => {
                expect(screen.getByTestId('SaveChangesPanel__save-btn')).toBeInTheDocument();
            });

            await userEvent.click(screen.getByTestId('SaveChangesPanel__save-btn'));

            expect(getPluginSaveMock('plugin-tab-1')).not.toHaveBeenCalled();
        });

        it('resets the close warning latch when plugin changes are reset', async () => {
            const registration = makePluginTabRegistration();

            renderWithContext(<ChannelSettingsModal {...baseProps}/>, makeTestState([registration]));

            await waitFor(() => {
                expect(screen.getByRole('tab', {name: /plugin tab/i})).toBeInTheDocument();
            });

            await userEvent.click(screen.getByRole('tab', {name: /plugin tab/i}));
            await userEvent.click(screen.getByTestId('pluggable-set-unsaved-changes'));

            const closeButton = screen.getByLabelText(/close/i);
            await userEvent.click(closeButton);
            await waitFor(() => {
                expect(screen.getByTestId('SaveChangesPanel__save-btn')).toBeDisabled();
            });

            await userEvent.click(screen.getByTestId('SaveChangesPanel__cancel-btn'));
            expect(getPluginResetMock(registration.id)).toHaveBeenCalled();

            await userEvent.click(screen.getByTestId('pluggable-set-unsaved-changes'));
            await userEvent.click(closeButton);

            await waitFor(() => {
                expect(screen.getByTestId('SaveChangesPanel__save-btn')).toBeDisabled();
            });
            expect(baseProps.onExited).not.toHaveBeenCalled();
        });

        it('clears dirty state and resets the close warning latch after successful plugin save', async () => {
            jest.useFakeTimers();
            const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
            const registration = makePluginTabRegistration();

            try {
                renderWithContext(<ChannelSettingsModal {...baseProps}/>, makeTestState([registration]));

                await waitFor(() => {
                    expect(screen.getByRole('tab', {name: /plugin tab/i})).toBeInTheDocument();
                });

                await user.click(screen.getByRole('tab', {name: /plugin tab/i}));
                await user.click(screen.getByTestId('pluggable-set-unsaved-changes'));

                const closeButton = screen.getByLabelText(/close/i);
                await user.click(closeButton);
                await waitFor(() => {
                    expect(screen.getByTestId('SaveChangesPanel__save-btn')).toBeDisabled();
                });

                act(() => {
                    jest.advanceTimersByTime(3000);
                });

                await user.click(screen.getByTestId('SaveChangesPanel__save-btn'));

                await waitFor(() => {
                    expect(screen.queryByTestId('SaveChangesPanel__save-btn')).not.toBeInTheDocument();
                });
                expect(getPluginSaveMock(registration.id)).toHaveBeenCalled();

                await user.click(screen.getByTestId('pluggable-set-unsaved-changes'));
                await user.click(closeButton);

                await waitFor(() => {
                    expect(screen.getByTestId('SaveChangesPanel__save-btn')).toBeDisabled();
                });
                expect(baseProps.onExited).not.toHaveBeenCalled();
            } finally {
                jest.useRealTimers();
            }
        });

        it('leaves dirty state and close warning latch unchanged when plugin save fails', async () => {
            jest.useFakeTimers();
            const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
            const registration = makePluginTabRegistration();
            getPluginSaveMock(registration.id).mockRejectedValueOnce(new Error('save failed'));

            try {
                renderWithContext(<ChannelSettingsModal {...baseProps}/>, makeTestState([registration]));

                await waitFor(() => {
                    expect(screen.getByRole('tab', {name: /plugin tab/i})).toBeInTheDocument();
                });

                await user.click(screen.getByRole('tab', {name: /plugin tab/i}));
                await user.click(screen.getByTestId('pluggable-set-unsaved-changes'));

                const closeButton = screen.getByLabelText(/close/i);
                await user.click(closeButton);
                await waitFor(() => {
                    expect(screen.getByTestId('SaveChangesPanel__save-btn')).toBeDisabled();
                });

                act(() => {
                    jest.advanceTimersByTime(3000);
                });

                await user.click(screen.getByTestId('SaveChangesPanel__save-btn'));

                await waitFor(() => {
                    expect(getPluginSaveMock(registration.id)).toHaveBeenCalled();
                });
                expect(screen.getByTestId('SaveChangesPanel__save-btn')).toBeInTheDocument();

                await user.click(closeButton);
                act(() => {
                    jest.runOnlyPendingTimers();
                });

                await waitFor(() => {
                    expect(baseProps.onExited).toHaveBeenCalled();
                });
            } finally {
                jest.useRealTimers();
            }
        });

        it('does not switch to a plugin tab while unsaved changes are present', async () => {
            const registration = makePluginTabRegistration();

            renderWithContext(<ChannelSettingsModal {...baseProps}/>, makeTestState([registration]));

            await waitFor(() => {
                expect(screen.getByTestId('info-tab')).toBeInTheDocument();
            });

            await userEvent.click(screen.getByTestId('set-unsaved-changes'));
            await userEvent.click(screen.getByRole('tab', {name: /plugin tab/i}));

            await waitFor(() => {
                expect(screen.getByTestId('warning-panel')).toBeInTheDocument();
            });

            expect(screen.queryByTestId('channel-settings-pluggable')).not.toBeInTheDocument();
            expect(screen.getByTestId('info-tab')).toBeInTheDocument();
        });
    });

    describe('schema tab wiring', () => {
        it('renders declarative schema controls without a save bar until changed', async () => {
            const onSave = jest.fn(async () => {});
            const registration = makeSchemaTabRegistration(onSave);

            renderWithContext(<ChannelSettingsModal {...baseProps}/>, makeTestState([registration]));

            await waitFor(() => {
                expect(screen.getByRole('tab', {name: /schema tab/i})).toBeInTheDocument();
            });

            await userEvent.click(screen.getByRole('tab', {name: /schema tab/i}));

            await waitFor(() => {
                expect(screen.getByText('Appearance')).toBeInTheDocument();
            });

            expect(screen.getByRole('radio', {name: 'Red'})).toBeChecked();
            expect(screen.getByRole('radio', {name: 'Blue'})).not.toBeChecked();
            expect(screen.queryByTestId('SaveChangesPanel__save-btn')).not.toBeInTheDocument();
        });

        it('collects values and calls onSave, then clears the save bar', async () => {
            const onSave = jest.fn(async () => {});
            const registration = makeSchemaTabRegistration(onSave);

            renderWithContext(<ChannelSettingsModal {...baseProps}/>, makeTestState([registration]));

            await waitFor(() => {
                expect(screen.getByRole('tab', {name: /schema tab/i})).toBeInTheDocument();
            });

            await userEvent.click(screen.getByRole('tab', {name: /schema tab/i}));
            await userEvent.click(screen.getByRole('radio', {name: 'Blue'}));

            await waitFor(() => {
                expect(screen.getByTestId('SaveChangesPanel__save-btn')).toBeInTheDocument();
            });

            await userEvent.click(screen.getByTestId('SaveChangesPanel__save-btn'));

            await waitFor(() => {
                expect(onSave).toHaveBeenCalledWith({color: 'blue'}, expect.objectContaining({id: channelId}));
            });

            await waitFor(() => {
                expect(screen.queryByTestId('SaveChangesPanel__save-btn')).not.toBeInTheDocument();
            });
        });

        it('restores the original selection on reset', async () => {
            const onSave = jest.fn(async () => {});
            const registration = makeSchemaTabRegistration(onSave);

            renderWithContext(<ChannelSettingsModal {...baseProps}/>, makeTestState([registration]));

            await waitFor(() => {
                expect(screen.getByRole('tab', {name: /schema tab/i})).toBeInTheDocument();
            });

            await userEvent.click(screen.getByRole('tab', {name: /schema tab/i}));
            await userEvent.click(screen.getByRole('radio', {name: 'Blue'}));

            await waitFor(() => {
                expect(screen.getByTestId('SaveChangesPanel__cancel-btn')).toBeInTheDocument();
            });

            await userEvent.click(screen.getByTestId('SaveChangesPanel__cancel-btn'));

            await waitFor(() => {
                expect(screen.getByRole('radio', {name: 'Red'})).toBeChecked();
            });

            expect(onSave).not.toHaveBeenCalled();
            expect(screen.queryByTestId('SaveChangesPanel__save-btn')).not.toBeInTheDocument();
        });

        it('keeps the tab dirty when onSave rejects', async () => {
            const onSave = jest.fn().mockRejectedValue(new Error('save failed'));
            const registration = makeSchemaTabRegistration(onSave);

            renderWithContext(<ChannelSettingsModal {...baseProps}/>, makeTestState([registration]));

            await waitFor(() => {
                expect(screen.getByRole('tab', {name: /schema tab/i})).toBeInTheDocument();
            });

            await userEvent.click(screen.getByRole('tab', {name: /schema tab/i}));
            await userEvent.click(screen.getByRole('radio', {name: 'Blue'}));

            await waitFor(() => {
                expect(screen.getByTestId('SaveChangesPanel__save-btn')).toBeInTheDocument();
            });

            await userEvent.click(screen.getByTestId('SaveChangesPanel__save-btn'));

            await waitFor(() => {
                expect(onSave).toHaveBeenCalled();
            });

            expect(screen.getByTestId('SaveChangesPanel__save-btn')).toBeInTheDocument();
        });
    });

    describe('warn-once modal closing behavior', () => {
        it('should close immediately when no unsaved changes exist', async () => {
            renderWithContext(<ChannelSettingsModal {...baseProps}/>, makeTestState());

            await waitFor(() => {
                expect(screen.getByRole('dialog')).toBeInTheDocument();
            });

            const closeButton = screen.getByLabelText(/close/i);
            await userEvent.click(closeButton);

            await waitFor(() => {
                expect(baseProps.onExited).toHaveBeenCalled();
            });
        });

        it('should prevent close on first attempt with unsaved changes', async () => {
            renderWithContext(<ChannelSettingsModal {...baseProps}/>, makeTestState());

            await waitFor(() => {
                expect(screen.getByRole('dialog')).toBeInTheDocument();
            });

            // Set component to unsaved state
            const setUnsavedButton = screen.getByTestId('set-unsaved-changes');
            await userEvent.click(setUnsavedButton);

            // Attempt to close modal with unsaved changes
            const closeButton = screen.getByLabelText(/close/i);
            await userEvent.click(closeButton);

            // Verify warning is displayed
            await waitFor(() => {
                expect(screen.getByTestId('warning-panel')).toBeInTheDocument();
            });

            // Verify modal remains open
            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(baseProps.onExited).not.toHaveBeenCalled();
        });

        it('should allow close on second attempt (warn-once behavior)', async () => {
            renderWithContext(<ChannelSettingsModal {...baseProps}/>, makeTestState());

            await waitFor(() => {
                expect(screen.getByRole('dialog')).toBeInTheDocument();
            });

            // Set component to unsaved state
            await userEvent.click(screen.getByTestId('set-unsaved-changes'));

            const closeButton = screen.getByLabelText(/close/i);

            // First close attempt triggers warning
            await userEvent.click(closeButton);

            await waitFor(() => {
                expect(screen.getByTestId('warning-panel')).toBeInTheDocument();
            });

            // Second close attempt closes modal
            await userEvent.click(closeButton);

            await waitFor(() => {
                expect(baseProps.onExited).toHaveBeenCalled();
            });
        });

        it('should reset warning state when changes are saved', async () => {
            renderWithContext(<ChannelSettingsModal {...baseProps}/>, makeTestState());

            await waitFor(() => {
                expect(screen.getByRole('dialog')).toBeInTheDocument();
            });

            // Set component to unsaved state
            await userEvent.click(screen.getByTestId('set-unsaved-changes'));

            const closeButton = screen.getByLabelText(/close/i);

            // Trigger warning by attempting to close
            await userEvent.click(closeButton);

            await waitFor(() => {
                expect(screen.getByTestId('warning-panel')).toBeInTheDocument();
            });

            // Save changes to reset state
            await userEvent.click(screen.getByTestId('save-changes'));

            // Close modal with no unsaved changes
            await userEvent.click(closeButton);

            await waitFor(() => {
                expect(baseProps.onExited).toHaveBeenCalled();
            });
        });
    });
});
