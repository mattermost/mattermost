// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel, ChannelMembership} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';

import ChannelMembersDropdown from 'components/channel_members_dropdown/channel_members_dropdown';

import {mockDispatch} from 'packages/mattermost-redux/test/test_store';
import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux') as typeof import('react-redux'),
    useDispatch: () => mockDispatch,
}));

describe('components/channel_members_dropdown', () => {
    const user = {
        id: 'user-1',
    } as UserProfile;

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

    const channelMember = {
        roles: 'channel_admin',
        scheme_admin: true,
    } as ChannelMembership;

    const baseProps = {
        channel,
        user,
        channelMember,
        currentUserId: 'current-user-id',
        canChangeMemberRoles: false,
        canRemoveMember: true,
        index: 0,
        totalUsers: 10,
        actions: {
            removeChannelMember: jest.fn().mockImplementation(() => {
                const error = {
                    message: 'Failed',
                };

                return Promise.resolve({error});
            }),
            getChannelStats: jest.fn(),
            updateChannelMemberSchemeRoles: jest.fn(),
            getChannelMember: jest.fn(),
            openModal: jest.fn(),
        },
    };

    test('should match snapshot for dropdown with guest user', () => {
        const props = {
            ...baseProps,
            user: {
                ...baseProps.user,
                roles: 'system_guest',
            },
            channelMember: {
                ...baseProps.channelMember,
                roles: 'channel_guest',
            },
            canChangeMemberRoles: true,
        };
        const {container} = renderWithContext(
            <ChannelMembersDropdown {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot for dropdown with shared user', () => {
        const props = {
            ...baseProps,
            user: {
                ...baseProps.user,
                roles: 'system_user',
                remote_id: 'fakeid',
            },
        };
        const {container} = renderWithContext(
            <ChannelMembersDropdown {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot for not dropdown with guest user', () => {
        const props = {
            ...baseProps,
            user: {
                ...baseProps.user,
                roles: 'system_guest',
            },
            channelMember: {
                ...baseProps.channelMember,
                roles: 'channel_guest',
            },
            canChangeMemberRoles: false,
        };
        const {container} = renderWithContext(
            <ChannelMembersDropdown {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot for channel_members_dropdown', () => {
        const {container} = renderWithContext(
            <ChannelMembersDropdown {...baseProps}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot opening dropdown upwards', () => {
        const {container} = renderWithContext(
            <ChannelMembersDropdown
                {...baseProps}
                index={4}
                totalUsers={5}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('If a removal is in progress do not execute another removal', async () => {
        const removeMock = jest.fn().mockImplementation(() => {
            const myPromise = new Promise<ActionResult>((resolve) => {
                setTimeout(() => {
                    resolve({data: {}});
                }, 3000);
            });
            return myPromise;
        });

        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                removeChannelMember: removeMock,
            },
        };

        const {container} = renderWithContext(
            <ChannelMembersDropdown {...props}/>,
        );

        // Open the dropdown menu and click remove
        const dropdownToggle = container.querySelector('button.dropdown-toggle') as HTMLElement;
        await userEvent.click(dropdownToggle);
        await userEvent.click(screen.getByText('Remove from Channel'));

        // Try to remove again
        await userEvent.click(dropdownToggle);
        await userEvent.click(screen.getByText('Remove from Channel'));
        expect(removeMock).toHaveBeenCalledTimes(1);
    });

    test('should fail to remove channel member', async () => {
        const removeMock = jest.fn().mockImplementation(() => {
            return Promise.resolve({error: {message: 'Failed'}});
        });

        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                removeChannelMember: removeMock,
            },
        };

        const {container} = renderWithContext(
            <ChannelMembersDropdown {...props}/>,
        );

        const dropdownToggle = container.querySelector('button.dropdown-toggle') as HTMLElement;
        await userEvent.click(dropdownToggle);
        await userEvent.click(screen.getByText('Remove from Channel'));

        await waitFor(() => {
            expect(removeMock).toHaveBeenCalledTimes(1);
            expect(screen.getByText('Failed')).toBeInTheDocument();
        });
    });

    test('should remove the channel member', async () => {
        const removeMock = jest.fn().mockImplementation(() => {
            return Promise.resolve({data: true});
        });

        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                removeChannelMember: removeMock,
            },
        };

        const {container} = renderWithContext(
            <ChannelMembersDropdown {...props}/>,
        );

        const dropdownToggle = container.querySelector('button.dropdown-toggle') as HTMLElement;
        await userEvent.click(dropdownToggle);
        await userEvent.click(screen.getByText('Remove from Channel'));

        await waitFor(() => {
            expect(removeMock).toHaveBeenCalledTimes(1);
        });
    });

    test('should match snapshot for group_constrained channel', () => {
        const props = {
            ...baseProps,
            channel: {
                ...baseProps.channel,
                group_constrained: true,
            },
        };
        const {container} = renderWithContext(
            <ChannelMembersDropdown {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with role change possible', () => {
        const {container} = renderWithContext(
            <ChannelMembersDropdown
                {...baseProps}
                canChangeMemberRoles={true}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when user is current user', () => {
        const props = {
            ...baseProps,
            currentUserId: 'user-1',
        };
        const {container} = renderWithContext(
            <ChannelMembersDropdown {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should open a confirmation modal when current user tries to remove themselves from a channel', async () => {
        const removeMock = jest.fn().mockImplementation(() => {
            const myPromise = new Promise<ActionResult>((resolve) => {
                setTimeout(() => {
                    resolve({data: {}});
                }, 3000);
            });
            return myPromise;
        });

        const props = {
            ...baseProps,
            currentUserId: 'user-1',
            channel: {
                ...baseProps.channel,
                group_constrained: false,
            },
            actions: {
                ...baseProps.actions,
                removeChannelMember: removeMock,
            },
        };
        const {container} = renderWithContext(
            <ChannelMembersDropdown {...props}/>,
        );

        const dropdownToggle = container.querySelector('button.dropdown-toggle') as HTMLElement;
        await userEvent.click(dropdownToggle);
        expect(screen.getByText('Leave Channel')).toBeInTheDocument();
        await userEvent.click(screen.getByText('Leave Channel'));

        expect(removeMock).not.toHaveBeenCalled();
        expect(props.actions.openModal).toHaveBeenCalledWith(
            expect.objectContaining({
                modalId: ModalIdentifiers.LEAVE_PRIVATE_CHANNEL_MODAL,
                dialogProps: expect.objectContaining({
                    channel: expect.objectContaining({id: props.channel.id}),
                }),
            }));
    });
});
