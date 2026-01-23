// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import {General} from 'mattermost-redux/constants';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ChannelSettingsModal from './channel_settings_modal';

// Variables to control permission check results in tests
let mockPrivateChannelPermission = true;
let mockPublicChannelPermission = true;
let mockManageChannelAccessRulesPermission = false;

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
}));

// Mock the general selectors
jest.mock('selectors/general', () => ({
    isChannelAccessControlEnabled: jest.fn().mockReturnValue(true),
    getBasePath: jest.fn().mockReturnValue(''),
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
};

// Mock the settings sidebar
jest.mock('components/settings_sidebar', () => {
    return function MockSettingsSidebar({tabs, activeTab, updateTab}: {tabs: TabType[]; activeTab: string; updateTab: (tab: string) => void}): JSX.Element {
        return (
            <div data-testid='settings-sidebar'>
                {tabs.filter((tab) => tab.display !== false).map((tab) => (
                    <button
                        data-testid={`${tab.name}-tab-button`}
                        key={tab.name}
                        role='tab'
                        aria-selected={activeTab === tab.name}
                        aria-label={tab.name}
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

    function makeTestState() {
        return {
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
                },
            },
        };
    }

    beforeEach(() => {
        jest.clearAllMocks();
        mockPrivateChannelPermission = true;
        mockPublicChannelPermission = true;
        mockManageChannelAccessRulesPermission = false; // Default to no access rules permission
    });

    it('should render the modal with correct header text', async () => {
        const testState = makeTestState();

        renderWithContext(<ChannelSettingsModal {...baseProps}/>, testState);

        expect(screen.getByText('Channel Settings')).toBeInTheDocument();
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
        const archiveTab = screen.getByRole('tab', {name: 'archive'});
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
        expect(screen.queryByRole('tab', {name: 'archive'})).not.toBeInTheDocument();
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
        expect(screen.getByRole('tab', {name: 'archive'})).toBeInTheDocument();
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
        expect(screen.queryByRole('tab', {name: 'archive'})).not.toBeInTheDocument();
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
        expect(screen.getByRole('tab', {name: 'archive'})).toBeInTheDocument();
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
        expect(screen.queryByRole('tab', {name: 'archive'})).not.toBeInTheDocument();
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

            // The Access Control tab should be visible
            expect(screen.getByRole('tab', {name: 'access_rules'})).toBeInTheDocument();
            expect(screen.getByText('Access Control')).toBeInTheDocument();
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

            // The Access Control tab should not be visible
            expect(screen.queryByRole('tab', {name: 'access_rules'})).not.toBeInTheDocument();
            expect(screen.queryByText('Access Control')).not.toBeInTheDocument();
        });

        it('should not show Access Control tab for public channel even with permission', async () => {
            mockManageChannelAccessRulesPermission = true;

            const testState = makeTestState();

            renderWithContext(<ChannelSettingsModal {...baseProps}/>, testState);

            // Wait for the sidebar to load
            await waitFor(() => {
                expect(screen.getByTestId('settings-sidebar')).toBeInTheDocument();
            });

            // The Access Control tab should not be visible for public channels
            expect(screen.queryByRole('tab', {name: 'access_rules'})).not.toBeInTheDocument();
            expect(screen.queryByText('Access Control')).not.toBeInTheDocument();
        });

        it('should not show Access Control tab for public channel without permission', async () => {
            mockManageChannelAccessRulesPermission = false;

            const testState = makeTestState();

            renderWithContext(<ChannelSettingsModal {...baseProps}/>, testState);

            // Wait for the sidebar to load
            await waitFor(() => {
                expect(screen.getByTestId('settings-sidebar')).toBeInTheDocument();
            });

            // The Access Control tab should not be visible
            expect(screen.queryByRole('tab', {name: 'access_rules'})).not.toBeInTheDocument();
            expect(screen.queryByText('Access Control')).not.toBeInTheDocument();
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

            // Find and click the Access Control tab
            const accessControlTab = screen.getByRole('tab', {name: 'access_rules'});
            await userEvent.click(accessControlTab);

            // Now the Access Control tab content should be visible
            expect(screen.getByTestId('access-rules-tab')).toBeInTheDocument();
            expect(screen.getByText('Access Rules Tab Content')).toBeInTheDocument();
        });

        it('should show correct tab label as "Access Control"', async () => {
            mockManageChannelAccessRulesPermission = true;

            const testState = makeTestState();
            testState.entities.channels.channels[channelId].type = General.PRIVATE_CHANNEL;

            renderWithContext(<ChannelSettingsModal {...baseProps}/>, testState);

            // Wait for the sidebar to load
            await waitFor(() => {
                expect(screen.getByTestId('settings-sidebar')).toBeInTheDocument();
            });

            // Verify the tab shows the correct label
            const accessControlTab = screen.getByRole('tab', {name: 'access_rules'});
            expect(accessControlTab).toHaveTextContent('Access Control');
        });

        it('should show Access Control tab for default channel if private and user has permission', async () => {
            mockManageChannelAccessRulesPermission = true;

            const testState = makeTestState();
            testState.entities.channels.channels[channelId].name = 'town-square';
            testState.entities.channels.channels[channelId].type = General.PRIVATE_CHANNEL;

            renderWithContext(<ChannelSettingsModal {...baseProps}/>, testState);

            // Wait for the sidebar to load
            await waitFor(() => {
                expect(screen.getByTestId('settings-sidebar')).toBeInTheDocument();
            });

            // Access Control tab visibility is not restricted for default channel - only depends on channel type and permission
            expect(screen.getByRole('tab', {name: 'access_rules'})).toBeInTheDocument();
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

            // The Access Control tab should not be visible for group-constrained channels
            expect(screen.queryByRole('tab', {name: 'access_rules'})).not.toBeInTheDocument();
            expect(screen.queryByText('Access Control')).not.toBeInTheDocument();
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

            // The Access Control tab should not be visible (for multiple reasons)
            expect(screen.queryByRole('tab', {name: 'access_rules'})).not.toBeInTheDocument();
            expect(screen.queryByText('Access Control')).not.toBeInTheDocument();
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

            // The Access Control tab should not be visible (for multiple reasons: public + group-constrained)
            expect(screen.queryByRole('tab', {name: 'access_rules'})).not.toBeInTheDocument();
            expect(screen.queryByText('Access Control')).not.toBeInTheDocument();
        });
    });

    describe('warn-once modal closing behavior', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

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
