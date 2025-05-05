// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, screen, waitFor} from '@testing-library/react';
import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';
import type {RelationOneToOne} from '@mattermost/types/utilities';

import {General} from 'mattermost-redux/constants';

import ChannelInviteModal from 'components/channel_invite_modal/channel_invite_modal';
import type {Value} from 'components/multiselect/multiselect';

import {renderWithContext} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';

type UserProfileValue = Value & UserProfile;

jest.mock('utils/utils', () => {
    const original = jest.requireActual('utils/utils');
    return {
        ...original,
        sortUsersAndGroups: jest.fn(),
    };
});

describe('components/channel_invite_modal', () => {
    const users = [{
        id: 'user-1',
        label: 'user-1',
        value: 'user-1',
        delete_at: 0,
    } as UserProfileValue, {
        id: 'user-2',
        label: 'user-2',
        value: 'user-2',
        delete_at: 0,
    } as UserProfileValue];

    // Define user statuses for testing
    const userStatusesData = {
        'user-1': 'online',
        'user-2': 'offline',
    } as RelationOneToOne<UserProfile, string>;

    const channel = {
        create_at: 1508265709607,
        creator_id: 'zaktnt8bpbgu8mb6ez9k64r7sa',
        delete_at: 0,
        display_name: 'testing',
        header: 'test',
        id: 'owsyt8n43jfxjpzh9np93mx1wa',
        last_post_at: 1508265709635,
        name: 'testing',
        purpose: 'test',
        team_id: 'eatxocwc3bg9ffo9xyybnj4omr',
        type: 'O',
        update_at: 1508265709607,
    } as Channel;

    const baseProps = {
        channel,
        profilesNotInCurrentChannel: [],
        profilesInCurrentChannel: [],
        profilesNotInCurrentTeam: [],
        profilesFromRecentDMs: [],
        membersInTeam: {},
        groups: [],
        userStatuses: userStatusesData,
        teammateNameDisplaySetting: General.TEAMMATE_NAME_DISPLAY.SHOW_USERNAME,
        isGroupsEnabled: true,
        actions: {
            addUsersToChannel: jest.fn().mockImplementation(() => {
                const error = {
                    message: 'Failed',
                };

                return Promise.resolve({error});
            }),
            getProfilesNotInChannel: jest.fn().mockImplementation(() => Promise.resolve()),
            getProfilesInChannel: jest.fn().mockImplementation(() => Promise.resolve()),
            searchAssociatedGroupsForReference: jest.fn().mockImplementation(() => Promise.resolve()),
            getTeamStats: jest.fn(),
            getUserStatuses: jest.fn().mockImplementation(() => Promise.resolve()),
            loadStatusesForProfilesList: jest.fn(),
            searchProfiles: jest.fn(),
            closeModal: jest.fn(),
            getTeamMembersByIds: jest.fn(),
        },
        onExited: jest.fn(),
    };

    const initialState = {
        entities: {
            general: {
                config: {},
            },
            users: {
                currentUserId: 'currentUserId',
            },
            teams: {
                teams: {
                    eatxocwc3bg9ffo9xyybnj4omr: {
                        id: 'eatxocwc3bg9ffo9xyybnj4omr',
                        name: 'test-team',
                        display_name: 'Test Team',
                    },
                },
                myMembers: {},
            },
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    beforeAll(() => {
        // Make rAF synchronous so it never tries to queue work
        window.requestAnimationFrame = (cb: FrameRequestCallback) => {
            cb(0);
            return 0;
        };

        // No-op focus so that ref.current!.focus() never throws
        // (This covers HTMLInputElement, HTMLDivElement, etc.)
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        HTMLElement.prototype.focus = function() {};
    });

    test('should render the modal with profiles not in channel', () => {
        renderWithContext(
            <ChannelInviteModal
                {...baseProps}
                profilesNotInCurrentChannel={users}
                profilesInCurrentChannel={[]}
                profilesNotInCurrentTeam={[]}
                profilesFromRecentDMs={[]}
            />,
            initialState,
        );

        // Verify modal is rendered with expected title
        expect(screen.getByText(`Add people to ${channel.display_name}`)).toBeInTheDocument();
    });

    test('should render the modal with profiles from DMs', () => {
        renderWithContext(
            <ChannelInviteModal
                {...baseProps}
                profilesNotInCurrentChannel={[]}
                profilesInCurrentChannel={[]}
                profilesNotInCurrentTeam={[]}
                profilesFromRecentDMs={users}
            />,
            initialState,
        );

        // Verify modal is rendered
        expect(screen.getByText(`Add people to ${channel.display_name}`)).toBeInTheDocument();
    });

    test('should render with exclude and include users', () => {
        renderWithContext(
            <ChannelInviteModal
                {...baseProps}
                profilesNotInCurrentChannel={users}
                profilesInCurrentChannel={[]}
                profilesNotInCurrentTeam={[]}
                profilesFromRecentDMs={[]}
                includeUsers={{
                    'user-3': {
                        id: 'user-3',
                        label: 'user-3',
                        value: 'user-3',
                        delete_at: 0,
                    } as UserProfileValue,
                }}
                excludeUsers={{
                    'user-1': {
                        id: 'user-1',
                        label: 'user-1',
                        value: 'user-1',
                        delete_at: 0,
                    } as UserProfileValue,
                }}
            />,
            initialState,
        );

        // Verify modal is rendered
        expect(screen.getByText(`Add people to ${channel.display_name}`)).toBeInTheDocument();
    });

    test('should close the modal when cancel button is clicked', () => {
        const closeModal = jest.fn();

        renderWithContext(
            <ChannelInviteModal
                {...baseProps}
                actions={{
                    ...baseProps.actions,
                    closeModal,
                }}
            />,
            initialState,
        );

        // Click the Cancel button
        fireEvent.click(screen.getByText('Cancel'));

        // Verify closeModal was called with the correct modal identifier
        expect(closeModal).toHaveBeenCalledWith(ModalIdentifiers.CHANNEL_INVITE);
    });

    test('should show invitation link when email invitations are enabled', () => {
        renderWithContext(
            <ChannelInviteModal
                {...baseProps}
                canInviteGuests={true}
                emailInvitationsEnabled={true}
            />,
            initialState,
        );

        // Verify the "Invite as a Guest" link is present
        expect(screen.getByText('Invite as a Guest')).toBeInTheDocument();
    });

    test('should not show invitation link when email invitations are disabled', () => {
        renderWithContext(
            <ChannelInviteModal
                {...baseProps}
                canInviteGuests={false}
                emailInvitationsEnabled={false}
            />,
            initialState,
        );

        // Verify the "Invite as a Guest" link is not present
        expect(screen.queryByText('Invite as a Guest')).not.toBeInTheDocument();
    });

    test('should show policy banner when channel has policy_enforced flag', () => {
        renderWithContext(
            <ChannelInviteModal
                {...baseProps}
                channel={{
                    ...channel,
                    policy_enforced: true,
                }}
            />,
            initialState,
        );

        // Verify the policy banner is present
        expect(screen.getByText('Channel access is restricted by user attributes')).toBeInTheDocument();
        expect(screen.getByText('Only people who match the specified access rules can be selected and added to this channel.')).toBeInTheDocument();
    });

    test('should not show policy banner when channel does not have policy_enforced flag', () => {
        renderWithContext(
            <ChannelInviteModal
                {...baseProps}
                channel={{
                    ...channel,
                    policy_enforced: false,
                }}
            />,
            initialState,
        );

        // Verify the policy banner is not present
        expect(screen.queryByText('Channel access is restricted by user attributes')).not.toBeInTheDocument();
    });

    test('should search for users when typing in the search box', async () => {
        const searchProfiles = jest.fn().mockImplementation(() => Promise.resolve());

        renderWithContext(
            <ChannelInviteModal
                {...baseProps}
                actions={{
                    ...baseProps.actions,
                    searchProfiles,
                }}
            />,
            initialState,
        );

        // Find the search input by aria-label
        const searchInput = screen.getByRole('combobox', {name: 'Search for people or groups'});

        // Type in the search box
        fireEvent.change(searchInput, {target: {value: 'test'}});

        // Wait for the debounced search to be called
        await waitFor(() => {
            expect(searchProfiles).toHaveBeenCalled();
        }, {timeout: 1000});
    });

    test('should successfully add users on submit', async () => {
        const addUsersToChannel = jest.fn().mockResolvedValue({data: true});

        renderWithContext(
            <ChannelInviteModal
                {...baseProps}
                profilesNotInCurrentChannel={users}
                actions={{
                    ...baseProps.actions,
                    addUsersToChannel,
                }}
            />,
            initialState,
        );

        // Simulate selecting a user
        // Since we can't directly manipulate the component's state in the test,
        // we'll mock the behavior by simulating user interaction

        // First, find the user option and click it
        const userOption = screen.getByText('user-1');
        fireEvent.click(userOption);

        // Then click the Add button
        const addButton = screen.getByText('Add');
        fireEvent.click(addButton);

        // Verify addUsersToChannel was called with the correct parameters
        await waitFor(() => {
            expect(addUsersToChannel).toHaveBeenCalledWith(channel.id, ['user-1']);
        });
    });

    test('should fail to add users on submit', async () => {
        const addUsersToChannel = jest.fn().mockResolvedValue({
            error: {message: 'Failed'},
        });

        renderWithContext(
            <ChannelInviteModal
                {...baseProps}
                profilesNotInCurrentChannel={users}
                actions={{
                    ...baseProps.actions,
                    addUsersToChannel,
                }}
            />,
            initialState,
        );

        // Find the user option and click it
        const userOption = screen.getByText('user-1');
        fireEvent.click(userOption);

        // Then click the Add button
        const addButton = screen.getByText('Add');
        fireEvent.click(addButton);

        // Verify addUsersToChannel was called with the correct parameters
        await waitFor(() => {
            expect(addUsersToChannel).toHaveBeenCalledWith(channel.id, ['user-1']);
        });
    });

    test('should call onAddCallback when skipCommit is true', async () => {
        const onAddCallback = jest.fn();
        const addUsersToChannel = jest.fn();
        const localOnExited = jest.fn();

        renderWithContext(
            <ChannelInviteModal
                {...baseProps}
                onExited={localOnExited}
                skipCommit={true}
                onAddCallback={onAddCallback}
                profilesNotInCurrentChannel={users}
                actions={{...baseProps.actions, addUsersToChannel}}
            />,
            initialState,
        );

        // Find the user option and click it
        const userOption = screen.getByText('user-1');
        fireEvent.click(userOption);

        // Then click the Add button
        const addButton = screen.getByText('Add');
        fireEvent.click(addButton);

        // Verify onAddCallback was called with the selected users
        await waitFor(() => {
            expect(onAddCallback).toHaveBeenCalled();
        });

        // Verify addUsersToChannel was not called
        expect(addUsersToChannel).not.toHaveBeenCalled();

        // Verify onExited was called
        await waitFor(() => {
            expect(localOnExited).toHaveBeenCalled();
        });
    });

    /* ------------------------------------------------------------------------- */

    /* ------------------------------------------------------------------------- */

    test('should close modal when closeModal action is called', () => {
        const closeModal = jest.fn();

        renderWithContext(
            <ChannelInviteModal
                {...baseProps}
                actions={{
                    ...baseProps.actions,
                    closeModal,
                }}
            />,
            initialState,
        );

        // Click the Cancel button
        fireEvent.click(screen.getByText('Cancel'));

        // Verify closeModal was called with the correct modal identifier
        expect(closeModal).toHaveBeenCalledWith(ModalIdentifiers.CHANNEL_INVITE);
    });
});
