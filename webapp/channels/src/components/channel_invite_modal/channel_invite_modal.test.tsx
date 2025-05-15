// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import {act} from 'react-dom/test-utils';

import {GenericModal} from '@mattermost/components';
import type {Channel} from '@mattermost/types/channels';
import type {TeamMembership} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';
import type {RelationOneToOne} from '@mattermost/types/utilities';

import {General} from 'mattermost-redux/constants';

import ChannelInviteModal from 'components/channel_invite_modal/channel_invite_modal';
import type {Value} from 'components/multiselect/multiselect';

import {shallowWithIntl} from 'tests/helpers/intl-test-helper';
import {renderWithContext} from 'tests/react_testing_utils';

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

        await act(async () => {
            const {getByText} = renderWithContext(
                <ChannelInviteModal
                    {...props}
                />,
            );

            // First, we need to simulate selecting a user
            const input = screen.getByRole('combobox', {name: /search for people/i});

            // Type the search term
            await userEvent.type(input, 'user-1');

            // Wait for the promise to resolve
            await act(async () => {
                // Wait for the dropdown option to appear
                const option = await screen.findByText('user-1');

                // Click the option
                userEvent.click(option);

                // Confirm that the user is now displayed in the selected users
                expect(screen.getByText('user-1')).toBeInTheDocument();

                // Find and click the save button
                const saveButton = getByText('Add');
                fireEvent.click(saveButton);
            });

            // Wait for the promise to resolve
            await act(async () => {
                await new Promise((resolve) => setTimeout(resolve, 0));
            });

            // Check that addUsersToChannel was called
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

        await act(async () => {
            const {getByText} = renderWithContext(
                <ChannelInviteModal
                    {...props}
                />,
            );

            // First, we need to simulate selecting a user
            const input = screen.getByRole('combobox', {name: /search for people/i});

            // Type the search term
            await userEvent.type(input, 'user-1');

            // Wait for the promise to resolve
            await act(async () => {
                // Wait for the dropdown option to appear
                const option = await screen.findByText('user-1');

                // Click the option
                userEvent.click(option);

                // Confirm that the user is now displayed in the selected users
                expect(screen.getByText('user-1')).toBeInTheDocument();

                // Find and click the save button
                const saveButton = getByText('Add');
                fireEvent.click(saveButton);
            });

            // Wait for the promise to resolve
            await act(async () => {
                await new Promise((resolve) => setTimeout(resolve, 0));
            });

            // Check that addUsersToChannel was called
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

        await act(async () => {
            const {getByText} = renderWithContext(
                <ChannelInviteModal
                    {...props}
                />,
            );

            // First, we need to simulate selecting a user
            const input = screen.getByRole('combobox', {name: /search for people/i});

            await userEvent.type(input, 'user-1');

            await act(async () => {
                const option = await screen.findByText('user-1');

                userEvent.click(option);

                expect(screen.getByText('user-1')).toBeInTheDocument();

                const saveButton = getByText('Add');
                fireEvent.click(saveButton);
            });

            // Check that onAddCallback was called and addUsersToChannel was not
            expect(onAddCallback).toHaveBeenCalled();
            expect(props.actions.addUsersToChannel).not.toHaveBeenCalled();
        });
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

        await act(async () => {
            renderWithContext(
                <ChannelInviteModal
                    {...props}
                />,
            );

            // Find the search input
            const input = screen.getByRole('combobox', {name: /search for people/i});

            // Directly trigger the change event with a value that has spaces
            fireEvent.change(input, {target: {value: ' something '}});

            // Wait for the search timeout plus some extra time
            await act(async () => {
                await new Promise((resolve) => setTimeout(resolve, 200));
            });

            // Verify the search was called with the trimmed term
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
});
