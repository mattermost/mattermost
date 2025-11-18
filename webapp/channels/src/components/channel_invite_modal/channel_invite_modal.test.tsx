// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import {GenericModal} from '@mattermost/components';
import type {Channel} from '@mattermost/types/channels';
import type {TeamMembership} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';
import type {RelationOneToOne} from '@mattermost/types/utilities';

import {General} from 'mattermost-redux/constants';

import ChannelInviteModal from 'components/channel_invite_modal/channel_invite_modal';
import type {Value} from 'components/multiselect/multiselect';

import {shallowWithIntl} from 'tests/helpers/intl-test-helper';
import {act, renderWithContext} from 'tests/react_testing_utils';

type UserProfileValue = Value & UserProfile;

// Mock the useAccessControlAttributes hook
jest.mock('components/common/hooks/useAccessControlAttributes', () => {
    // Define the EntityType enum in the mock
    const EntityType = {
        Channel: 'channel',
    };

    const mockHook = jest.fn(() => ({
        structuredAttributes: [
            {
                name: 'attribute1',
                values: ['tag1', 'tag2'],
            },
        ],
        loading: false,
        error: null,
        fetchAttributes: jest.fn(),
    }));

    // Export both the default export (the hook) and the named export (EntityType)
    return {
        __esModule: true,
        default: mockHook,
        EntityType,
    };
});

jest.mock('utils/utils', () => {
    const original = jest.requireActual('utils/utils');
    return {
        ...original,
        sortUsersAndGroups: jest.fn(),
    };
});

// Mock Client4 for ABAC tests
jest.mock('mattermost-redux/client', () => ({
    Client4: {
        getProfilesNotInChannel: jest.fn(),
        getProfilePictureUrl: jest.fn(() => 'mock-url'),
        getUsersRoute: jest.fn(() => '/api/v4/users'),
        getTeamsRoute: jest.fn(() => '/api/v4/teams'),
        getChannelsRoute: jest.fn(() => '/api/v4/channels'),
        getUrl: jest.fn(() => 'http://localhost:8065'),
        getBaseRoute: jest.fn(() => '/api/v4'),
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

    beforeAll(() => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        window.requestAnimationFrame = (_cb: FrameRequestCallback): number => {
            // do not call cb at all
            return 0;
        };
    });

    beforeEach(() => {
        // Reset Client4 mocks before each test
        const {Client4} = require('mattermost-redux/client');
        Client4.getProfilesNotInChannel.mockClear();
        Client4.getProfilePictureUrl.mockClear();
        Client4.getUsersRoute.mockClear();
        Client4.getTeamsRoute.mockClear();
        Client4.getChannelsRoute.mockClear();
        Client4.getUrl.mockClear();
        Client4.getBaseRoute.mockClear();

        // Set default return values
        Client4.getProfilesNotInChannel.mockResolvedValue([]);
        Client4.getProfilePictureUrl.mockReturnValue('mock-url');
        Client4.getUsersRoute.mockReturnValue('/api/v4/users');
        Client4.getTeamsRoute.mockReturnValue('/api/v4/teams');
        Client4.getChannelsRoute.mockReturnValue('/api/v4/channels');
        Client4.getUrl.mockReturnValue('http://localhost:8065');
        Client4.getBaseRoute.mockReturnValue('/api/v4');
    });

    test('should match snapshot for channel_invite_modal with profiles', () => {
        const wrapper = shallowWithIntl(
            <ChannelInviteModal
                {...baseProps}
                profilesNotInCurrentChannel={users}
                profilesInCurrentChannel={[]}
                profilesNotInCurrentTeam={[]}
                profilesFromRecentDMs={[]}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot for channel_invite_modal with profiles from DMs', () => {
        const wrapper = shallowWithIntl(
            <ChannelInviteModal
                {...baseProps}
                profilesNotInCurrentChannel={[]}
                profilesInCurrentChannel={[]}
                profilesNotInCurrentTeam={[]}
                profilesFromRecentDMs={users}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with exclude and include users', () => {
        const wrapper = shallowWithIntl(
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
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot for channel_invite_modal with userStatuses', () => {
        const wrapper = shallowWithIntl(
            <ChannelInviteModal
                {...baseProps}
                profilesNotInCurrentChannel={users}
                profilesInCurrentChannel={[]}
                userStatuses={userStatuses}
                profilesFromRecentDMs={[]}
            />,
        );

        // Since renderOption is now an internal function in the component,
        // we can't test it directly. Instead, we'll test the rendered component.
        expect(wrapper).toMatchSnapshot();
    });

    test('should hide modal when onHide is called', () => {
        const wrapper = shallowWithIntl(
            <ChannelInviteModal {...baseProps}/>,
        );

        // Find the GenericModal and trigger its onHide prop
        const modal = wrapper.find(GenericModal);
        const onHide = modal.props().onHide;
        if (onHide) {
            onHide();
        }

        // Re-render to reflect state changes
        wrapper.update();

        // The modal should now be hidden (show prop should be false)
        expect(wrapper.find(GenericModal).props().show).toEqual(false);
    });

    test('should have called props.onExited when GenericModal.onExited is called', () => {
        const props = {...baseProps};
        const wrapper = shallowWithIntl(
            <ChannelInviteModal {...props}/>,
        );

        const modal = wrapper.find(GenericModal);
        const onExited = modal.props().onExited;
        if (onExited) {
            onExited();
        }
        expect(props.onExited).toHaveBeenCalledTimes(1);
    });

    test('should fail to add users on handleSubmit', async () => {
        // Mock the addUsersToChannel function to return an error
        const addUsersToChannelMock = jest.fn().mockImplementation(() => {
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

        const {getByText} = renderWithContext(
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
        const saveButton = getByText('Add');
        await userEvent.click(saveButton);

        // Check that addUsersToChannel was called
        await waitFor(() => {
            expect(addUsersToChannelMock).toHaveBeenCalled();
        });
    });

    test('should add users on handleSubmit', async () => {
        // Mock the addUsersToChannel function to return success
        const addUsersToChannelMock = jest.fn().mockImplementation(() => {
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

        const {getByText} = renderWithContext(
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
        const saveButton = getByText('Add');
        await userEvent.click(saveButton);

        // Check that addUsersToChannel was called
        await waitFor(() => {
            expect(addUsersToChannelMock).toHaveBeenCalled();
        });
    });

    test('should call onAddCallback on handleSubmit with skipCommit', async () => {
        const onAddCallback = jest.fn();

        const props = {
            ...baseProps,
            skipCommit: true,
            onAddCallback,
            profilesNotInCurrentChannel: [users[0]],
            includeUsers: {'user-1': users[0]},
            membersInTeam: {'user-1': {user_id: 'user-1', team_id: channel.team_id, roles: '', delete_at: 0, scheme_admin: false, scheme_guest: false, scheme_user: true, mention_count: 0, mention_count_root: 0, msg_count: 0, msg_count_root: 0} as TeamMembership},

        };

        const {getByText} = renderWithContext(
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

        const saveButton = getByText('Add');
        await userEvent.click(saveButton);

        // Check that onAddCallback was called and addUsersToChannel was not
        expect(onAddCallback).toHaveBeenCalled();
        expect(props.actions.addUsersToChannel).not.toHaveBeenCalled();
    });

    test('should trim the search term', async () => {
        const searchProfilesMock = jest.fn().mockImplementation(() => {
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

    test('should send the invite as guest param through the link', () => {
        const props = {
            ...baseProps,
            canInviteGuests: true,
            emailInvitationsEnabled: true,
        };
        const wrapper = shallowWithIntl(
            <ChannelInviteModal {...props}/>,
        );

        const invitationLink = wrapper.find('InviteModalLink');

        expect(invitationLink).toHaveLength(1);

        expect(invitationLink.prop('inviteAsGuest')).toBeTruthy();
    });

    test('should hide the invite as guest param when can not invite guests', () => {
        const props = {
            ...baseProps,
            canInviteGuests: false,
            emailInvitationsEnabled: false,
        };
        const wrapper = shallowWithIntl(
            <ChannelInviteModal {...props}/>,
        );

        const invitationLink = wrapper.find('InviteModalLink');

        expect(invitationLink).toHaveLength(0);
    });

    test('should show AlertBanner when policy_enforced is true', () => {
        const channelWithPolicy = {
            ...channel,
            policy_enforced: true,
        };

        const props = {
            ...baseProps,
            channel: channelWithPolicy,
        };

        const wrapper = shallowWithIntl(
            <ChannelInviteModal {...props}/>,
        );

        // Check that the AlertBanner is shown
        expect(wrapper.find('AlertBanner').exists()).toBe(true);
    });

    test('should show attribute tags in AlertBanner', () => {
        const channelWithPolicy = {
            ...channel,
            policy_enforced: true,
        };

        const props = {
            ...baseProps,
            channel: channelWithPolicy,
        };

        const wrapper = shallowWithIntl(
            <ChannelInviteModal {...props}/>,
        );

        // Check that the AlertBanner is shown
        expect(wrapper.find('AlertBanner').exists()).toBe(true);

        // Check that the TagGroup exists
        expect(wrapper.find('TagGroup').exists()).toBe(true);

        // Check that the attribute tags are shown
        const tagGroup = wrapper.find('TagGroup');
        const alertTags = tagGroup.find('AlertTag');
        expect(alertTags).toHaveLength(2);

        // Verify the tag text
        expect(alertTags.at(0).prop('text')).toBe('tag1');
        expect(alertTags.at(1).prop('text')).toBe('tag2');
    });

    test('should not show AlertBanner when policy_enforced is false', () => {
        const channelWithoutPolicy = {
            ...channel,
            policy_enforced: false,
        };

        const props = {
            ...baseProps,
            channel: channelWithoutPolicy,
        };

        const wrapper = shallowWithIntl(
            <ChannelInviteModal {...props}/>,
        );

        // Check that the AlertBanner is not shown
        expect(wrapper.find('AlertBanner').exists()).toBe(false);
    });

    test('should show loading state for access attributes', () => {
        // Mock the useAccessControlAttributes hook to return loading state
        const useAccessControlAttributesModule = require('components/common/hooks/useAccessControlAttributes');
        const useAccessControlAttributesMock = useAccessControlAttributesModule.default;
        useAccessControlAttributesMock.mockReturnValueOnce({
            structuredAttributes: [],
            loading: true,
            error: null,
            fetchAttributes: jest.fn(),
        });

        const channelWithPolicy = {
            ...channel,
            policy_enforced: true,
        };

        const props = {
            ...baseProps,
            channel: channelWithPolicy,
        };

        const wrapper = shallowWithIntl(
            <ChannelInviteModal {...props}/>,
        );

        // Check that the AlertBanner is shown
        expect(wrapper.find('AlertBanner').exists()).toBe(true);

        // Check that no tags are shown
        expect(wrapper.find('AlertTag').exists()).toBe(false);
    });

    test('should handle error state for access attributes', () => {
        // Mock the useAccessControlAttributes hook to return error state
        const useAccessControlAttributesModule = require('components/common/hooks/useAccessControlAttributes');
        const useAccessControlAttributesMock = useAccessControlAttributesModule.default;
        useAccessControlAttributesMock.mockReturnValueOnce({
            structuredAttributes: [],
            loading: false,
            error: 'Failed to load attributes',
            fetchAttributes: jest.fn(),
        });

        const channelWithPolicy = {
            ...channel,
            policy_enforced: true,
        };

        const props = {
            ...baseProps,
            channel: channelWithPolicy,
        };

        const wrapper = shallowWithIntl(
            <ChannelInviteModal {...props}/>,
        );

        // Check that the AlertBanner is shown
        expect(wrapper.find('AlertBanner').exists()).toBe(true);

        // Check that no tags are shown
        expect(wrapper.find('AlertTag').exists()).toBe(false);
    });

    // the multiselect returns several elements with the same text, usiing a custom function to get the correct one specifing the tagName
    const getUserSpan = (user: string) =>
        screen.getByText((text, element) =>
            element?.tagName === 'SPAN' && text.trim() === user,
        ) as HTMLElement;

    test('should not include DM users when ABAC is enabled', async () => {
        // Mock Client4 to return user-1 for ABAC channels
        const {Client4} = require('mattermost-redux/client');
        Client4.getProfilesNotInChannel.mockResolvedValue([users[0]]);

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
        const getProfilesNotInChannelMock = jest.fn().mockImplementation(() => Promise.resolve());

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

    test('should hide the invite as guest link when channel has policy_enforced', () => {
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

        const wrapper = shallowWithIntl(
            <ChannelInviteModal {...props}/>,
        );

        // Check that the invite as guest link is not shown
        const invitationLinks = wrapper.find('InviteModalLink');

        // There should be no InviteModalLink with inviteAsGuest=true
        const guestInviteLinks = invitationLinks.findWhere(
            (node) => node.prop('inviteAsGuest') === true,
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
        const {Client4} = require('mattermost-redux/client');
        Client4.getProfilesNotInChannel.mockResolvedValue([users[0]]);

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
        const {Client4} = require('mattermost-redux/client');
        Client4.getProfilesNotInChannel.mockResolvedValue([]);

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
        expect(Client4.getProfilesNotInChannel).toHaveBeenCalledWith(
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
        const {Client4} = require('mattermost-redux/client');
        Client4.getProfilesNotInChannel.mockResolvedValue([users[0]]);

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
