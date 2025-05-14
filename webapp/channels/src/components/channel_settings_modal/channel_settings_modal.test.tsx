// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import ChannelSettingsModal from './channel_settings_modal';

// Variables to control permission check results in tests
let mockPrivateChannelPermission = true;
let mockPublicChannelPermission = true;

// Mock the redux selectors
jest.mock('mattermost-redux/selectors/entities/channels', () => ({
    getChannel: jest.fn().mockImplementation((state, channelId) => {
        // Return a mock channel based on the channelId
        return {
            id: channelId,
            team_id: 'team1',
            display_name: 'Test Channel',
            name: channelId === 'default_channel' ? 'town-square' : 'test-channel',
            purpose: 'Testing purpose',
            header: 'Channel header',
            type: mockChannelType, // Use a variable to control the channel type
            create_at: 0,
            update_at: 0,
            delete_at: 0,
            last_post_at: 0,
            total_msg_count: 0,
            extra_update_at: 0,
            creator_id: 'creator1',
            last_root_post_at: 0,
            scheme_id: '',
            group_constrained: false,
        };
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
        return true;
    }),
}));

// Mock the child components to simplify testing
jest.mock('./channel_settings_info_tab', () => {
    return function MockInfoTab(): JSX.Element {
        return <div data-testid='info-tab'>{'Info Tab Content'}</div>;
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

// Define the tab type for the settings sidebar
type TabType = {
    name: string;
    uiName: string;
    display?: boolean;
};

// Variable to control the channel type in tests
let mockChannelType = 'O';

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

const baseProps = {
    channelId: 'channel1',
    isOpen: true,
    onExited: jest.fn(),
    focusOriginElement: 'button1',
};

describe('ChannelSettingsModal', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockChannelType = 'O'; // Default to public channel
        mockPrivateChannelPermission = true;
        mockPublicChannelPermission = true;
    });

    it('should render the modal with correct header text', async () => {
        renderWithContext(<ChannelSettingsModal {...baseProps}/>);
        expect(screen.getByText('Channel Settings')).toBeInTheDocument();
    });

    it('should render Info tab by default', async () => {
        renderWithContext(<ChannelSettingsModal {...baseProps}/>);

        // Wait for the lazy-loaded components
        await waitFor(() => {
            expect(screen.getByTestId('info-tab')).toBeInTheDocument();
        });
    });

    it('should switch tabs when clicked', async () => {
        renderWithContext(<ChannelSettingsModal {...baseProps}/>);

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
        renderWithContext(
            <ChannelSettingsModal
                {...{...baseProps, channelId: 'default_channel'}}
            />,
        );

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
        mockChannelType = 'O';
        mockPublicChannelPermission = true;

        renderWithContext(<ChannelSettingsModal {...baseProps}/>);

        // Wait for the sidebar to load
        await waitFor(() => {
            expect(screen.getByTestId('settings-sidebar')).toBeInTheDocument();
        });

        // The archive tab should be visible
        expect(screen.getByRole('tab', {name: 'archive'})).toBeInTheDocument();
    });

    it('should not show archive tab for public channel when user does not have permission', async () => {
        mockChannelType = 'O';
        mockPublicChannelPermission = false;

        renderWithContext(<ChannelSettingsModal {...baseProps}/>);

        // Wait for the sidebar to load
        await waitFor(() => {
            expect(screen.getByTestId('settings-sidebar')).toBeInTheDocument();
        });

        // The archive tab should not be in the document
        expect(screen.queryByRole('tab', {name: 'archive'})).not.toBeInTheDocument();
    });

    it('should show archive tab for private channel when user has permission', async () => {
        mockChannelType = 'P';
        mockPrivateChannelPermission = true;

        renderWithContext(<ChannelSettingsModal {...baseProps}/>);

        // Wait for the sidebar to load
        await waitFor(() => {
            expect(screen.getByTestId('settings-sidebar')).toBeInTheDocument();
        });

        // The archive tab should be visible
        expect(screen.getByRole('tab', {name: 'archive'})).toBeInTheDocument();
    });

    it('should not show archive tab for private channel when user does not have permission', async () => {
        mockChannelType = 'P';
        mockPrivateChannelPermission = false;

        renderWithContext(<ChannelSettingsModal {...baseProps}/>);

        // Wait for the sidebar to load
        await waitFor(() => {
            expect(screen.getByTestId('settings-sidebar')).toBeInTheDocument();
        });

        // The archive tab should not be in the document
        expect(screen.queryByRole('tab', {name: 'archive'})).not.toBeInTheDocument();
    });

    it('should not show configuration tab with no license', async () => {
        const baseState: DeepPartial<GlobalState> = {
            entities: {
                general: {
                    license: {
                        SkuShortName: '',
                    },
                },
            },
        };
        renderWithContext(<ChannelSettingsModal {...baseProps}/>, baseState as GlobalState);
        expect(screen.queryByTestId('configuration-tab-button')).not.toBeInTheDocument();
    });

    it('should not show configuration tab with professional license', async () => {
        const baseState: DeepPartial<GlobalState> = {
            entities: {
                general: {
                    license: {
                        SkuShortName: 'professional',
                    },
                },
            },
        };
        renderWithContext(<ChannelSettingsModal {...baseProps}/>, baseState as GlobalState);
        expect(screen.queryByTestId('configuration-tab-button')).not.toBeInTheDocument();
    });

    it('should not show configuration tab with enterprise license', async () => {
        const baseState: DeepPartial<GlobalState> = {
            entities: {
                general: {
                    license: {
                        SkuShortName: 'enterprise',
                    },
                },
            },
        };
        renderWithContext(<ChannelSettingsModal {...baseProps}/>, baseState as GlobalState);
        expect(screen.queryByTestId('configuration-tab-button')).not.toBeInTheDocument();
    });

    it('should show configuration tab when enterprise advanced license', async () => {
        const baseState: DeepPartial<GlobalState> = {
            entities: {
                general: {
                    license: {
                        SkuShortName: 'advanced',
                    },
                },
            },
        };
        renderWithContext(<ChannelSettingsModal {...baseProps}/>, baseState as GlobalState);
        expect(screen.getByTestId('configuration-tab-button')).toBeInTheDocument();
    });
});
