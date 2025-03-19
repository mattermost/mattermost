// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen, waitFor, fireEvent} from '@testing-library/react';
import {IntlProvider} from 'react-intl';
import {Provider} from 'react-redux';
import {MemoryRouter} from 'react-router-dom';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';

import type {Channel} from '@mattermost/types/channels';
import type {Group} from '@mattermost/types/groups';
import type {Scheme} from '@mattermost/types/schemes';

import {TestHelper} from 'utils/test_helper';

import ChannelDetails from './channel_details';
import exp from 'constants';

// Mock the history object
jest.mock('utils/browser_history', () => ({
    getHistory: jest.fn().mockReturnValue({
        push: jest.fn(),
    }),
}));

// Create a mock Redux store with thunk middleware
const middlewares = [thunk];
const mockStore = configureStore(middlewares);
const store = mockStore({
    entities: {
        general: {
            config: {},
            license: {
                IsLicensed: 'true',
                LDAPGroups: 'true',
            },
        },
        users: {
            profiles: {},
            profilesInChannel: {
                '123': {}, // Add empty profiles object for the test channel ID
            },
        },
        teams: {
            teams: {},
        },
        channels: {
            channels: {},
            channelsInTeam: {},
            membersInChannel: {
                '123': {}, // Add empty members object for the test channel ID
            },
            stats: {
                '123': {
                    channel_id: '123',
                    member_count: 0,
                }, // Add empty stats object for the test channel ID
            },
            totalCount: 1,
        },
        groups: {
            groups: {},
            myGroups: {},
        },
    },
    views: {
        admin: {
            navigationBlock: {
                blocked: false,
            },
        },
        search: {
            userGridSearch: {
                term: '',
            },
        },
    },
});

// Helper function to create a standard test channel
const createTestChannel = (isGroupConstrained = false): Channel & {team_name: string} => ({
    id: '123',
    team_name: 'team',
    create_at: 0,
    update_at: 0,
    delete_at: 0,
    team_id: 'id_123',
    type: 'P',
    display_name: 'name',
    name: 'DN',
    header: 'header',
    purpose: 'purpose',
    last_post_at: 0,
    last_root_post_at: 0,
    creator_id: 'id',
    scheme_id: 'id',
    group_constrained: isGroupConstrained,
});

// Helper function to create standard test groups
const createTestGroups = (): Group[] => [{
    id: '123',
    name: 'name',
    display_name: 'DN',
    description: 'descript',
    source: 'A',
    remote_id: 'id',
    create_at: 0,
    update_at: 0,
    delete_at: 0,
    has_syncables: false,
    member_count: 3,
    scheme_admin: false,
    allow_reference: false,
}];

// Helper function to create standard test actions
const createTestActions = () => ({
    getChannel: jest.fn().mockResolvedValue([]),
    getTeam: jest.fn().mockResolvedValue([]),
    linkGroupSyncable: jest.fn().mockResolvedValue({data: true}),
    patchChannel: jest.fn().mockResolvedValue({data: true}),
    setNavigationBlocked: jest.fn(),
    unlinkGroupSyncable: jest.fn().mockResolvedValue({data: true}),
    getGroups: jest.fn().mockResolvedValue([]),
    membersMinusGroupMembers: jest.fn().mockResolvedValue({data: {total_count: 0, users: []}}),
    updateChannelPrivacy: jest.fn().mockResolvedValue({data: true}),
    patchGroupSyncable: jest.fn().mockResolvedValue({data: true}),
    getChannelModerations: jest.fn().mockResolvedValue([]),
    patchChannelModerations: jest.fn().mockResolvedValue({data: true}),
    loadScheme: jest.fn().mockResolvedValue({data: true}),
    addChannelMember: jest.fn().mockResolvedValue({data: true}),
    removeChannelMember: jest.fn().mockResolvedValue({data: true}),
    updateChannelMemberSchemeRoles: jest.fn().mockResolvedValue({data: true}),
    deleteChannel: jest.fn().mockResolvedValue({data: true}),
    unarchiveChannel: jest.fn().mockResolvedValue({data: true}),
    removeNonGroupMembersFromChannel: jest.fn().mockResolvedValue({data: true}),
});

// Helper function to create standard test scheme
const createTestScheme = (): Scheme => ({
    id: 'asdf',
    name: 'asdf',
    description: 'asdf',
    display_name: 'asdf',
    create_at: 0,
    update_at: 0,
    delete_at: 0,
    scope: 'team',
    default_team_admin_role: 'asdf',
    default_team_user_role: 'asdf',
    default_team_guest_role: 'asdf',
    default_channel_admin_role: 'asdf',
    default_channel_user_role: 'asdf',
    default_channel_guest_role: 'asdf',
    default_playbook_admin_role: 'asdf',
    default_playbook_member_role: 'asdf',
    default_run_member_role: 'asdf',
});

// Helper function to render the component with standard props
const renderChannelDetails = (props: any) => {
    return render(
        <Provider store={store}>
            <IntlProvider locale="en">
                <MemoryRouter>
                    <ChannelDetails {...props} />
                </MemoryRouter>
            </IntlProvider>
        </Provider>
    );
};

describe('admin_console/team_channel_settings/channel/ChannelDetails', () => {
    test('should render with team', () => {
        const groups = createTestGroups();
        const allGroups = {
            '123': groups[0],
        };
        const testChannel = createTestChannel();
        const team = TestHelper.getTeamMock({
            display_name: 'test',
        });
        const teamScheme = createTestScheme();
        const actions = createTestActions();

        const additionalProps = {
            channelPermissions: [],
            guestAccountsEnabled: true,
            channelModerationEnabled: true,
            channelGroupsEnabled: true,
            isDisabled: false,
        };

        renderChannelDetails({
            teamScheme,
            groups,
            team,
            totalGroups: groups.length,
            actions,
            channel: testChannel,
            channelID: testChannel.id,
            allGroups,
            ...additionalProps,
        });

        // Verify component renders
        expect(screen.getByText('Channel Configuration')).toBeInTheDocument();
    });

    test('should render without team', () => {
        const groups = createTestGroups();
        const allGroups = {
            '123': groups[0],
        };
        const testChannel = createTestChannel();
        const teamScheme = createTestScheme();
        const actions = createTestActions();

        const additionalProps = {
            channelPermissions: [],
            guestAccountsEnabled: true,
            channelModerationEnabled: true,
            channelGroupsEnabled: true,
            isDisabled: false,
        };

        renderChannelDetails({
            teamScheme,
            groups,
            team: undefined,
            totalGroups: groups.length,
            actions,
            channel: testChannel,
            channelID: testChannel.id,
            allGroups,
            ...additionalProps,
        });

        // Verify component renders
        expect(screen.getByText('Channel Configuration')).toBeInTheDocument();
    });

    test('should render for Professional', () => {
        const groups = createTestGroups();
        const allGroups = {
            '123': groups[0],
        };
        const testChannel = createTestChannel();
        const team = TestHelper.getTeamMock({
            display_name: 'test',
        });
        const teamScheme = createTestScheme();
        const actions = createTestActions();

        const additionalProps = {
            channelPermissions: [],
            guestAccountsEnabled: true,
            channelModerationEnabled: true,
            channelGroupsEnabled: false, // Professional version
            isDisabled: false,
        };

        renderChannelDetails({
            teamScheme,
            groups,
            team,
            totalGroups: groups.length,
            actions,
            channel: testChannel,
            channelID: testChannel.id,
            allGroups,
            ...additionalProps,
        });

        // Verify component renders
        expect(screen.getByText('Channel Configuration')).toBeInTheDocument();
    });

    test('should render for Enterprise', () => {
        const groups = createTestGroups();
        const allGroups = {
            '123': groups[0],
        };
        const testChannel = createTestChannel();
        const team = TestHelper.getTeamMock({
            display_name: 'test',
        });
        const teamScheme = createTestScheme();
        const actions = createTestActions();

        const additionalProps = {
            channelPermissions: [],
            guestAccountsEnabled: true,
            channelModerationEnabled: true,
            channelGroupsEnabled: false, // Enterprise version
            isDisabled: false,
        };

        renderChannelDetails({
            teamScheme,
            groups,
            team,
            totalGroups: groups.length,
            actions,
            channel: testChannel,
            channelID: testChannel.id,
            allGroups,
            ...additionalProps,
        });

        // Verify component renders
        expect(screen.getByText('Channel Configuration')).toBeInTheDocument();
    });

    test('should call removeNonGroupMembersFromChannel when converting to synced channel', async () => {
        // Create a channel that is not synced initially
        const testChannel = createTestChannel(false);
        const channelID = testChannel.id;
        
        // Create groups and actions
        const groups = createTestGroups();
        const allGroups = {
            '123': groups[0],
        };
        const actions = createTestActions();
        
        // Mock the necessary functions
        actions.getGroups.mockResolvedValue({data: groups});
        actions.patchChannel.mockResolvedValue({data: true});
        actions.membersMinusGroupMembers.mockResolvedValue({data: {total_count: 0, users: []}});
        
        const additionalProps = {
            channelPermissions: [],
            guestAccountsEnabled: true,
            channelModerationEnabled: true,
            channelGroupsEnabled: true,
            isDisabled: false,
        };
        
        // Render the component
        renderChannelDetails({
            groups,
            team: undefined,
            totalGroups: groups.length,
            actions,
            channel: testChannel,
            channelID,
            allGroups,
            ...additionalProps,
        });
        
        // Find and click the sync toggle to enable group syncing
        const syncToggle = screen.getByTestId('syncGroupSwitch-button');
        await waitFor(() => {
            expect(syncToggle).toBeInTheDocument();
        });
        fireEvent.click(syncToggle);
        
        // Wait for state to update
        await waitFor(() => {
            expect(syncToggle).toBeInTheDocument();
        });
        
        // Find the Save button and click it to trigger handleSubmit
        const saveButton = screen.getByText('Save');
        fireEvent.click(saveButton);
        
        // Use a longer timeout for the async operations
        await waitFor(() => {
            expect(actions.patchChannel).toHaveBeenCalled();
        }, { timeout: 3000 });
        
        // Verify patchChannel was called with the correct parameters
        expect(actions.patchChannel).toHaveBeenCalledWith(testChannel.id, expect.objectContaining({
            group_constrained: true,
        }));
        
        // Verify removeNonGroupMembersFromChannel was called with the correct channel ID
        expect(actions.removeNonGroupMembersFromChannel).toHaveBeenCalledWith(channelID);
    });

    test('should NOT call removeNonGroupMembersFromChannel when channel was already synced', async () => {
        const groups = createTestGroups();
        const allGroups = {
            '123': groups[0],
        };
        const testChannel = createTestChannel(true); // Already synced
        const actions = createTestActions();
        const channelID = testChannel.id;

        const additionalProps = {
            channelPermissions: [],
            guestAccountsEnabled: true,
            channelModerationEnabled: true,
            channelGroupsEnabled: true,
            isDisabled: false,
        };

        // We don't need to spy on handleSubmit since we'll trigger it through the UI
        
        // Render the component
        renderChannelDetails({
            groups,
            team: undefined,
            totalGroups: groups.length,
            actions,
            channel: testChannel,
            channelID,
            allGroups,
            ...additionalProps,
        });
        
        // Find the Save button and click it to trigger handleSubmit
        const saveButton = screen.getByText('Save');
        fireEvent.click(saveButton);
        
        // Verify removeNonGroupMembersFromChannel was NOT called
        expect(actions.removeNonGroupMembersFromChannel).not.toHaveBeenCalled();
    });
});
