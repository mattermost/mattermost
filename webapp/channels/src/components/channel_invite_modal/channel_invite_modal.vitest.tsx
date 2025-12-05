// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {TeamMembership} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';
import type {RelationOneToOne} from '@mattermost/types/utilities';

import {General} from 'mattermost-redux/constants';

import ChannelInviteModal from 'components/channel_invite_modal/channel_invite_modal';
import type {Value} from 'components/multiselect/multiselect';

import {act, renderWithContext, userEvent, waitFor, fireEvent, screen} from 'tests/vitest_react_testing_utils';

type UserProfileValue = Value & UserProfile;

// Mock the useAccessControlAttributes hook - use vi.hoisted for configurable mock
const {mockUseAccessControlAttributes} = vi.hoisted(() => ({
    mockUseAccessControlAttributes: vi.fn(() => ({
        structuredAttributes: [
            {
                name: 'attribute1',
                values: ['tag1', 'tag2'],
            },
        ],
        loading: false,
        error: null,
        fetchAttributes: vi.fn(),
    })),
}));

vi.mock('components/common/hooks/useAccessControlAttributes', () => {
    // Define the EntityType enum in the mock
    const EntityType = {
        Channel: 'channel',
    };

    // Export both the default export (the hook) and the named export (EntityType)
    return {
        default: mockUseAccessControlAttributes,
        EntityType,
    };
});

vi.mock('utils/utils', async () => {
    const original = await vi.importActual('utils/utils');
    return {
        ...original,
        sortUsersAndGroups: vi.fn(),
    };
});

// Mock Client4 for ABAC tests - use vi.hoisted to ensure mocks are defined before hoisting
const {
    mockGetProfilesNotInChannel,
    mockGetProfilePictureUrl,
    mockGetUsersRoute,
    mockGetTeamsRoute,
    mockGetChannelsRoute,
    mockGetUrl,
    mockGetBaseRoute,
} = vi.hoisted(() => ({
    mockGetProfilesNotInChannel: vi.fn(),
    mockGetProfilePictureUrl: vi.fn(() => 'mock-url'),
    mockGetUsersRoute: vi.fn(() => '/api/v4/users'),
    mockGetTeamsRoute: vi.fn(() => '/api/v4/teams'),
    mockGetChannelsRoute: vi.fn(() => '/api/v4/channels'),
    mockGetUrl: vi.fn(() => 'http://localhost:8065'),
    mockGetBaseRoute: vi.fn(() => '/api/v4'),
}));

vi.mock('mattermost-redux/client', () => ({
    Client4: {
        getProfilesNotInChannel: mockGetProfilesNotInChannel,
        getProfilePictureUrl: mockGetProfilePictureUrl,
        getUsersRoute: mockGetUsersRoute,
        getTeamsRoute: mockGetTeamsRoute,
        getChannelsRoute: mockGetChannelsRoute,
        getUrl: mockGetUrl,
        getBaseRoute: mockGetBaseRoute,
    },
}));

describe('components/channel_invite_modal', () => {
    const users = [{
        id: 'user-1',
        label: 'user-1',
        value: 'user-1',
        username: 'user-1',
        delete_at: 0,
    } as UserProfileValue, {
        id: 'user-2',
        label: 'user-2',
        value: 'user-2',
        username: 'user-2',
        delete_at: 0,
    } as UserProfileValue];

    const userStatuses = {
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
        userStatuses: {},
        teammateNameDisplaySetting: General.TEAMMATE_NAME_DISPLAY.SHOW_USERNAME,
        isGroupsEnabled: true,
        actions: {
            addUsersToChannel: vi.fn().mockImplementation(() => {
                const error = {
                    message: 'Failed',
                };

                return Promise.resolve({error});
            }),
            getProfilesNotInChannel: vi.fn().mockImplementation(() => Promise.resolve()),
            getProfilesInChannel: vi.fn().mockImplementation(() => Promise.resolve()),
            searchAssociatedGroupsForReference: vi.fn().mockImplementation(() => Promise.resolve()),
            getTeamStats: vi.fn(),
            getUserStatuses: vi.fn().mockImplementation(() => Promise.resolve()),
            loadStatusesForProfilesList: vi.fn(),
            searchProfiles: vi.fn(),
            closeModal: vi.fn(),
            getTeamMembersByIds: vi.fn(),
        },
        onExited: vi.fn(),
    };

    beforeAll(() => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        window.requestAnimationFrame = (_cb: FrameRequestCallback): number => {
            // do not call cb at all
            return 0;
        };
    });

    beforeEach(() => {
        // Reset useAccessControlAttributes mock
        mockUseAccessControlAttributes.mockClear();
        mockUseAccessControlAttributes.mockReturnValue({
            structuredAttributes: [
                {
                    name: 'attribute1',
                    values: ['tag1', 'tag2'],
                },
            ],
            loading: false,
            error: null,
            fetchAttributes: vi.fn(),
        });

        // Reset Client4 mocks before each test
        mockGetProfilesNotInChannel.mockClear();
        mockGetProfilePictureUrl.mockClear();
        mockGetUsersRoute.mockClear();
        mockGetTeamsRoute.mockClear();
        mockGetChannelsRoute.mockClear();
        mockGetUrl.mockClear();
        mockGetBaseRoute.mockClear();

        // Set default return values
        mockGetProfilesNotInChannel.mockResolvedValue([]);
        mockGetProfilePictureUrl.mockReturnValue('mock-url');
        mockGetUsersRoute.mockReturnValue('/api/v4/users');
        mockGetTeamsRoute.mockReturnValue('/api/v4/teams');
        mockGetChannelsRoute.mockReturnValue('/api/v4/channels');
        mockGetUrl.mockReturnValue('http://localhost:8065');
        mockGetBaseRoute.mockReturnValue('/api/v4');
    });

    test('should match snapshot for channel_invite_modal with profiles', async () => {
        let baseElement: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
                <ChannelInviteModal
                    {...baseProps}
                    profilesNotInCurrentChannel={users}
                    profilesInCurrentChannel={[]}
                    profilesNotInCurrentTeam={[]}
                    profilesFromRecentDMs={[]}
                />,
            );
            baseElement = result.baseElement;
        });
        expect(baseElement!).toMatchSnapshot();
    });

    test('should match snapshot for channel_invite_modal with profiles from DMs', async () => {
        let baseElement: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
                <ChannelInviteModal
                    {...baseProps}
                    profilesNotInCurrentChannel={[]}
                    profilesInCurrentChannel={[]}
                    profilesNotInCurrentTeam={[]}
                    profilesFromRecentDMs={users}
                />,
            );
            baseElement = result.baseElement;
        });
        expect(baseElement!).toMatchSnapshot();
    });

    test('should match snapshot with exclude and include users', async () => {
        let baseElement: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
                <ChannelInviteModal
                    {...baseProps}
                    profilesNotInCurrentChannel={users}
                    profilesInCurrentChannel={[]}
                    profilesNotInCurrentTeam={[]}
                    profilesFromRecentDMs={[]}
                    includeUsers={
                        {
                            'user-3': {
                                id: 'user-3',
                                label: 'user-3',
                                value: 'user-3',
                                delete_at: 0,
                            } as UserProfileValue,
                        }
                    }
                    excludeUsers={
                        {
                            'user-1': {
                                id: 'user-1',
                                label: 'user-1',
                                value: 'user-1',
                                delete_at: 0,
                            } as UserProfileValue,
                        }
                    }
                />,
            );
            baseElement = result.baseElement;
        });
        expect(baseElement!).toMatchSnapshot();
    });

    test('should match snapshot for channel_invite_modal with userStatuses', async () => {
        let baseElement: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
                <ChannelInviteModal
                    {...baseProps}
                    profilesNotInCurrentChannel={users}
                    profilesInCurrentChannel={[]}
                    userStatuses={userStatuses}
                    profilesFromRecentDMs={[]}
                />,
            );
            baseElement = result.baseElement;
        });

        // Since renderOption is now an internal function in the component,
        // we can't test it directly. Instead, we'll test the rendered component.
        expect(baseElement!).toMatchSnapshot();
    });

    test('should hide modal when onHide is called', async () => {
        renderWithContext(
            <ChannelInviteModal {...baseProps}/>,
        );

        // Modal should be visible
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        // Find and click the close button
        const closeButton = screen.getByLabelText('Close');
        await userEvent.click(closeButton);

        // Modal should be hidden
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    test('should have called props.onExited when GenericModal.onExited is called', async () => {
        const onExited = vi.fn();
        const props = {...baseProps, onExited};

        renderWithContext(
            <ChannelInviteModal {...props}/>,
        );

        // Close the modal to trigger onExited
        const closeButton = screen.getByLabelText('Close');
        await userEvent.click(closeButton);

        // Wait for the modal to fully exit
        await waitFor(() => {
            expect(onExited).toHaveBeenCalled();
        });
    });

    test('should fail to add users on handleSubmit', async () => {
        // Mock the addUsersToChannel function to return an error
        const addUsersToChannelMock = vi.fn().mockImplementation(() => {
            return Promise.resolve({error: {message: 'Failed'}});
        });

        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                addUsersToChannel: addUsersToChannelMock,
            },
            profilesNotInCurrentChannel: [users[0]],
            includeUsers: {'user-1': users[0]},
            membersInTeam: {'user-1': {user_id: 'user-1', team_id: channel.team_id, roles: '', delete_at: 0, scheme_admin: false, scheme_guest: false, scheme_user: true, mention_count: 0, mention_count_root: 0, msg_count: 0, msg_count_root: 0} as TeamMembership},
        };

        renderWithContext(
            <ChannelInviteModal
                {...props}
            />,
        );

        // First, we need to simulate selecting a user
        const input = screen.getByRole('combobox', {name: /search for people/i});

        // Type the search term
        await userEvent.type(input, 'user-1');

        // Wait for the dropdown option to appear
        const option = await screen.findByText('user-1', {selector: '.more-modal__name > span'});

        // Click the option
        await userEvent.click(option);

        // Confirm that the user is now displayed in the selected users
        expect(screen.getByText('user-1')).toBeInTheDocument();

        // Find and click the save button
        const saveButton = screen.getByText('Add');
        await userEvent.click(saveButton);

        // Check that addUsersToChannel was called
        await waitFor(() => {
            expect(addUsersToChannelMock).toHaveBeenCalled();
        });
    });

    test('should add users on handleSubmit', async () => {
        // Mock the addUsersToChannel function to return success
        const addUsersToChannelMock = vi.fn().mockImplementation(() => {
            return Promise.resolve({data: true});
        });

        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                addUsersToChannel: addUsersToChannelMock,
            },
            profilesNotInCurrentChannel: [users[0]],
            includeUsers: {'user-1': users[0]},
            membersInTeam: {'user-1': {user_id: 'user-1', team_id: channel.team_id, roles: '', delete_at: 0, scheme_admin: false, scheme_guest: false, scheme_user: true, mention_count: 0, mention_count_root: 0, msg_count: 0, msg_count_root: 0} as TeamMembership},
        };

        renderWithContext(
            <ChannelInviteModal
                {...props}
            />,
        );

        // First, we need to simulate selecting a user
        const input = screen.getByRole('combobox', {name: /search for people/i});

        // Type the search term
        await userEvent.type(input, 'user-1');

        // Wait for the dropdown option to appear
        const option = await screen.findByText('user-1', {selector: '.more-modal__name > span'});

        // Click the option
        await userEvent.click(option);

        // Confirm that the user is now displayed in the selected users
        expect(screen.getByText('user-1')).toBeInTheDocument();

        // Find and click the save button
        const saveButton = screen.getByText('Add');
        await userEvent.click(saveButton);

        // Check that addUsersToChannel was called
        await waitFor(() => {
            expect(addUsersToChannelMock).toHaveBeenCalled();
        });
    });

    test('should call onAddCallback on handleSubmit with skipCommit', async () => {
        const onAddCallback = vi.fn();

        const props = {
            ...baseProps,
            skipCommit: true,
            onAddCallback,
            profilesNotInCurrentChannel: [users[0]],
            includeUsers: {'user-1': users[0]},
            membersInTeam: {'user-1': {user_id: 'user-1', team_id: channel.team_id, roles: '', delete_at: 0, scheme_admin: false, scheme_guest: false, scheme_user: true, mention_count: 0, mention_count_root: 0, msg_count: 0, msg_count_root: 0} as TeamMembership},

        };

        renderWithContext(
            <ChannelInviteModal
                {...props}
            />,
        );

        // First, we need to simulate selecting a user
        const input = screen.getByRole('combobox', {name: /search for people/i});

        await userEvent.type(input, 'user-1');

        const option = await screen.findByText('user-1', {selector: '.more-modal__name > span'});

        await userEvent.click(option);

        expect(screen.getByText('user-1')).toBeInTheDocument();

        const saveButton = screen.getByText('Add');
        await userEvent.click(saveButton);

        // Check that onAddCallback was called and addUsersToChannel was not
        expect(onAddCallback).toHaveBeenCalled();
        expect(props.actions.addUsersToChannel).not.toHaveBeenCalled();
    });

    test('should trim the search term', async () => {
        const searchProfilesMock = vi.fn().mockImplementation(() => {
            return Promise.resolve({});
        });

        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                searchProfiles: searchProfilesMock,
            },
        };

        renderWithContext(
            <ChannelInviteModal
                {...props}
            />,
        );

        // Find the search input
        const input = screen.getByRole('combobox', {name: /search for people/i});

        // Directly trigger the change event with a value that has spaces
        act(() => {
            fireEvent.change(input, {target: {value: ' something '}});
        });

        // Verify the search was called with the trimmed term
        await waitFor(() => {
            expect(searchProfilesMock).toHaveBeenCalledWith(
                expect.stringContaining('something'),
                expect.any(Object),
            );
        });
    });

    test('should send the invite as guest param through the link', async () => {
        const props = {
            ...baseProps,
            canInviteGuests: true,
            emailInvitationsEnabled: true,
        };
        await act(async () => {
            renderWithContext(
                <ChannelInviteModal {...props}/>,
            );
        });

        // Check for guest invite link text
        expect(screen.getByText(/invite as a guest/i)).toBeInTheDocument();
    });

    test('should hide the invite as guest param when can not invite guests', async () => {
        const props = {
            ...baseProps,
            canInviteGuests: false,
            emailInvitationsEnabled: false,
        };
        await act(async () => {
            renderWithContext(
                <ChannelInviteModal {...props}/>,
            );
        });

        // Check that invite as guest link is not shown
        expect(screen.queryByText(/invite as a guest/i)).not.toBeInTheDocument();
    });

    test('should show AlertBanner when policy_enforced is true', async () => {
        const channelWithPolicy = {
            ...channel,
            policy_enforced: true,
        };

        const props = {
            ...baseProps,
            channel: channelWithPolicy,
        };

        await act(async () => {
            renderWithContext(
                <ChannelInviteModal {...props}/>,
            );
        });

        // Check that the AlertBanner message is shown
        expect(screen.getByText(/channel access is restricted by user attributes/i)).toBeInTheDocument();
    });

    test('should show attribute tags in AlertBanner', async () => {
        const channelWithPolicy = {
            ...channel,
            policy_enforced: true,
        };

        const props = {
            ...baseProps,
            channel: channelWithPolicy,
        };

        await act(async () => {
            renderWithContext(
                <ChannelInviteModal {...props}/>,
            );
        });

        // Check that the AlertBanner message is shown
        expect(screen.getByText(/channel access is restricted by user attributes/i)).toBeInTheDocument();

        // Check that attribute tags are shown
        expect(screen.getByText('tag1')).toBeInTheDocument();
        expect(screen.getByText('tag2')).toBeInTheDocument();
    });

    test('should not show AlertBanner when policy_enforced is false', async () => {
        const channelWithoutPolicy = {
            ...channel,
            policy_enforced: false,
        };

        const props = {
            ...baseProps,
            channel: channelWithoutPolicy,
        };

        await act(async () => {
            renderWithContext(
                <ChannelInviteModal {...props}/>,
            );
        });

        // Check that the AlertBanner is not shown
        expect(screen.queryByText(/channel access is restricted by user attributes/i)).not.toBeInTheDocument();
    });

    test('should show loading state for access attributes', async () => {
        // Mock the useAccessControlAttributes hook to return loading state
        mockUseAccessControlAttributes.mockReturnValue({
            structuredAttributes: [],
            loading: true,
            error: null,
            fetchAttributes: vi.fn(),
        });

        const channelWithPolicy = {
            ...channel,
            policy_enforced: true,
        };

        const props = {
            ...baseProps,
            channel: channelWithPolicy,
        };

        await act(async () => {
            renderWithContext(
                <ChannelInviteModal {...props}/>,
            );
        });

        // Check that the AlertBanner message is shown
        expect(screen.getByText(/channel access is restricted by user attributes/i)).toBeInTheDocument();

        // Check that no tags are shown (because loading)
        expect(screen.queryByText('tag1')).not.toBeInTheDocument();
    });

    test('should handle error state for access attributes', async () => {
        // Mock the useAccessControlAttributes hook to return error state
        mockUseAccessControlAttributes.mockReturnValue({
            structuredAttributes: [],
            loading: false,
            error: null,
            fetchAttributes: vi.fn(),
        });

        const channelWithPolicy = {
            ...channel,
            policy_enforced: true,
        };

        const props = {
            ...baseProps,
            channel: channelWithPolicy,
        };

        await act(async () => {
            renderWithContext(
                <ChannelInviteModal {...props}/>,
            );
        });

        // Check that the AlertBanner message is shown
        expect(screen.getByText(/channel access is restricted by user attributes/i)).toBeInTheDocument();

        // Check that no tags are shown (because error)
        expect(screen.queryByText('tag1')).not.toBeInTheDocument();
    });

    // the multiselect returns several elements with the same text, usiing a custom function to get the correct one specifing the tagName
    const getUserSpan = (user: string) =>
        screen.getByText((text, element) =>
            element?.tagName === 'SPAN' && text.trim() === user,
        ) as HTMLElement;

    test('should not include DM users when ABAC is enabled', async () => {
        // Mock Client4 to return user-1 for ABAC channels
        mockGetProfilesNotInChannel.mockResolvedValue([users[0]]);

        const channelWithPolicy = {...channel, policy_enforced: true};
        const props = {
            ...baseProps,
            channel: channelWithPolicy,
            profilesNotInCurrentChannel: [users[0]],
            profilesFromRecentDMs: [users[1]],
        };

        await act(async () => {
            renderWithContext(<ChannelInviteModal {...props}/>);
        });

        // Wait for the API call to complete and state to update
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });

        const input = screen.getByRole('combobox', {name: /search for people/i});
        await userEvent.type(input, 'user');

        // Wait for the search to complete
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });

        // now only one visible <span> should match "user-1"
        expect(getUserSpan('user-1')).toBeInTheDocument();

        // and no <span> with "user-2"
        expect(screen.queryByText('user-2')).toBeNull();
    });

    test('should include DM users when ABAC is disabled', async () => {
        const channelWithoutPolicy = {...channel, policy_enforced: false};
        const props = {
            ...baseProps,
            channel: channelWithoutPolicy,
            profilesNotInCurrentChannel: [users[0]],
            profilesFromRecentDMs: [users[1]],
        };

        await act(async () => {
            renderWithContext(<ChannelInviteModal {...props}/>);
        });

        const input = screen.getByRole('combobox', {name: /search for people/i});
        await userEvent.type(input, 'user');

        // we should see both user-1 and user-2 in visible spans
        expect(getUserSpan('user-1')).toBeInTheDocument();
        expect(getUserSpan('user-2')).toBeInTheDocument();
    });

    test('should not reload data when search term is empty and ABAC is disabled', async () => {
        const getProfilesNotInChannelMock = vi.fn().mockImplementation(() => Promise.resolve());

        const channelWithoutPolicy = {
            ...channel,
            policy_enforced: false,
        };

        const props = {
            ...baseProps,
            channel: channelWithoutPolicy,
            actions: {
                ...baseProps.actions,
                getProfilesNotInChannel: getProfilesNotInChannelMock,
            },
        };

        // Render the component
        await act(async () => {
            renderWithContext(
                <ChannelInviteModal {...props}/>,
            );
        });

        // Reset the mock after component mount to ignore initial data loading
        getProfilesNotInChannelMock.mockClear();

        // Find the search input
        const input = screen.getByRole('combobox', {name: /search for people/i});

        // Type something and then clear it
        await userEvent.type(input, 'a');
        await userEvent.clear(input);

        // Wait for the search timeout
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 200));
        });

        // Should not call getProfilesNotInChannel after clearing the search
        expect(getProfilesNotInChannelMock).not.toHaveBeenCalled();
    });

    test('should hide the invite as guest link when channel has policy_enforced', async () => {
        const channelWithPolicy = {
            ...channel,
            policy_enforced: true,
        };

        const props = {
            ...baseProps,
            channel: channelWithPolicy,
            canInviteGuests: true,
            emailInvitationsEnabled: true,
        };

        let container: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
                <ChannelInviteModal {...props}/>,
            );
            container = result.container;
        });

        // Check that the invite as guest link is not shown for policy_enforced channels
        const inviteLinks = container!.querySelectorAll('[class*="InviteModalLink"]');

        // Filter for links with inviteAsGuest
        const guestInviteLinks = Array.from(inviteLinks).filter(
            (link) => link.getAttribute('data-invite-as-guest') === 'true',
        );
        expect(guestInviteLinks).toHaveLength(0);
    });

    test('should NOT filter out groups when  NOT ABAC is enforced', async () => {
        const mockGroups = [
            {
                id: 'group1',
                name: 'developers',
                display_name: 'Developers',
                description: 'Development team',
                source: 'ldap',
                remote_id: 'dev-group',
                create_at: 1234567890,
                update_at: 1234567890,
                delete_at: 0,
                has_syncables: false,
                member_count: 5,
                scheme_admin: false,
                allow_reference: true,
            },
        ];

        const channelWithPolicy = {
            ...channel,
            policy_enforced: false,
        };

        const props = {
            ...baseProps,
            channel: channelWithPolicy,
            groups: mockGroups,
            profilesNotInCurrentChannel: [users[0]],
        };

        await act(async () => {
            renderWithContext(<ChannelInviteModal {...props}/>);
        });

        const input = screen.getByRole('combobox', {name: /search for people/i});
        await userEvent.type(input, '@');

        // Should only show users, not groups when ABAC is enforced
        expect(getUserSpan('user-1')).toBeInTheDocument();

        // Groups should appear in the dropdown
        expect(getUserSpan('Developers')).toBeInTheDocument();
    });

    test('should filter out groups when ABAC is enforced', async () => {
        // Mock Client4 to return user-1 for ABAC channels
        mockGetProfilesNotInChannel.mockResolvedValue([users[0]]);

        const mockGroups = [
            {
                id: 'group1',
                name: 'developers',
                display_name: 'Developers',
                description: 'Development team',
                source: 'ldap',
                remote_id: 'dev-group',
                create_at: 1234567890,
                update_at: 1234567890,
                delete_at: 0,
                has_syncables: false,
                member_count: 5,
                scheme_admin: false,
                allow_reference: true,
            },
        ];

        const channelWithPolicy = {
            ...channel,
            policy_enforced: true,
        };

        const props = {
            ...baseProps,
            channel: channelWithPolicy,
            groups: mockGroups,
            profilesNotInCurrentChannel: [users[0]],
        };

        await act(async () => {
            renderWithContext(<ChannelInviteModal {...props}/>);
        });

        // Wait for the API call to complete and state to update
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });

        const input = screen.getByRole('combobox', {name: /search for people/i});
        await userEvent.type(input, 'user');

        // Wait for the search to complete
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });

        // Should only show users, not groups when ABAC is enforced
        expect(getUserSpan('user-1')).toBeInTheDocument();

        // Groups should not appear in the dropdown
        expect(screen.queryByText('Developers')).toBeNull();
    });

    test('should force fresh API call when ABAC is enforced', async () => {
        // For ABAC channels, we use Client4 directly, not the Redux action
        mockGetProfilesNotInChannel.mockResolvedValue([]);

        const props = {
            ...baseProps,
            channel: {...channel, policy_enforced: true},
        };

        await act(async () => {
            renderWithContext(<ChannelInviteModal {...props}/>);
        });

        // Wait for the API call to complete
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });

        // For ABAC channels, we should call Client4 directly, not the Redux action
        expect(mockGetProfilesNotInChannel).toHaveBeenCalledWith(
            props.channel.team_id,
            props.channel.id,
            props.channel.group_constrained,
            0,
            50,
            '',
        );
    });

    test('should ignore contaminated Redux data when ABAC is enforced', async () => {
        // Mock Client4 to return only user-1 for ABAC channels (ignoring contaminated Redux data)
        mockGetProfilesNotInChannel.mockResolvedValue([users[0]]);

        const props = {
            ...baseProps,
            channel: {...channel, policy_enforced: true},
            profilesNotInCurrentChannel: [users[0]], // Clean ABAC data
            profilesFromRecentDMs: [users[1]], // Contaminated data
            includeUsers: {[users[1].id]: users[1]}, // Contaminated data
        };

        await act(async () => {
            renderWithContext(<ChannelInviteModal {...props}/>);
        });

        // Wait for the API call to complete and state to update
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });

        const input = screen.getByRole('combobox', {name: /search for people/i});
        await userEvent.type(input, 'user');

        // Wait for the search to complete
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });

        // Should only show clean ABAC data
        expect(getUserSpan('user-1')).toBeInTheDocument();
        expect(screen.queryByText('user-2')).toBeNull();
    });
});
