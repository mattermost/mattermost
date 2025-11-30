// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel, ChannelMembership} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';

import ChannelMembersDropdown from 'components/channel_members_dropdown/channel_members_dropdown';

import {renderWithContext, screen, fireEvent, waitFor} from 'tests/vitest_react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';

// Mock the animation to bypass CSS transition delays
vi.mock('components/widgets/menu/menu_wrapper_animation', () => ({
    default: ({show, children}: {show: boolean; children: React.ReactNode}) => (show ? children : null),
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
            removeChannelMember: vi.fn().mockImplementation(() => {
                const error = {
                    message: 'Failed',
                };

                return Promise.resolve({error});
            }),
            getChannelStats: vi.fn(),
            updateChannelMemberSchemeRoles: vi.fn(),
            getChannelMember: vi.fn(),
            openModal: vi.fn().mockReturnValue({type: 'OPEN_MODAL'}),
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
        const removeMock = vi.fn().mockImplementation(() => {
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

        renderWithContext(
            <ChannelMembersDropdown {...props}/>,
        );

        // Open the menu first by clicking on the wrapper div
        const wrapper = screen.getByRole('button', {name: /channel admin/i}).parentElement!;
        fireEvent.click(wrapper);

        // Wait for menu to be visible
        await waitFor(() => {
            expect(screen.getByRole('menu')).toBeInTheDocument();
        });

        // Click on the actual button inside the menu item
        const removeButton = screen.getByText(/remove from channel/i).closest('button')!;
        fireEvent.click(removeButton);
        fireEvent.click(removeButton);

        expect(removeMock).toHaveBeenCalledTimes(1);
    });

    test('should fail to remove channel member', async () => {
        const removeMock = vi.fn().mockImplementation(() => {
            return Promise.resolve({error: {message: 'Failed'}});
        });

        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                removeChannelMember: removeMock,
            },
        };

        renderWithContext(
            <ChannelMembersDropdown {...props}/>,
        );

        // Open the menu first by clicking on the wrapper div
        const wrapper = screen.getByRole('button', {name: /channel admin/i}).parentElement!;
        fireEvent.click(wrapper);

        // Wait for menu to be visible
        await waitFor(() => {
            expect(screen.getByRole('menu')).toBeInTheDocument();
        });

        // Click on the actual button inside the menu item
        const removeButton = screen.getByText(/remove from channel/i).closest('button')!;
        fireEvent.click(removeButton);

        await waitFor(() => {
            expect(removeMock).toHaveBeenCalledTimes(1);
        });

        // Re-open the menu to see the error message (it's displayed inside the menu)
        fireEvent.click(wrapper);

        // Wait for menu to be visible again with the error message
        await waitFor(() => {
            expect(screen.getByRole('menu')).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(screen.getByText('Failed')).toBeInTheDocument();
        });
    });

    test('should remove the channel member', async () => {
        const removeMock = vi.fn().mockImplementation(() => {
            return Promise.resolve({data: true});
        });

        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                removeChannelMember: removeMock,
            },
        };

        renderWithContext(
            <ChannelMembersDropdown {...props}/>,
        );

        // Open the menu first by clicking on the wrapper div
        const wrapper = screen.getByRole('button', {name: /channel admin/i}).parentElement!;
        fireEvent.click(wrapper);

        // Wait for menu to be visible
        await waitFor(() => {
            expect(screen.getByRole('menu')).toBeInTheDocument();
        });

        // Click on the actual button inside the menu item
        const removeButton = screen.getByText(/remove from channel/i).closest('button')!;
        fireEvent.click(removeButton);

        await waitFor(() => {
            expect(removeMock).toHaveBeenCalledTimes(1);
        });
    });

    test('should match snapshot for group_constrained channel', () => {
        const props = {
            ...baseProps,
            channel: {
                ...channel,
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
        const removeMock = vi.fn().mockImplementation(() => {
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
        renderWithContext(
            <ChannelMembersDropdown {...props}/>,
        );

        // Open the menu first by clicking on the wrapper div
        const wrapper = screen.getByRole('button', {name: /channel admin/i}).parentElement!;
        fireEvent.click(wrapper);

        // Wait for menu to be visible
        await waitFor(() => {
            expect(screen.getByRole('menu')).toBeInTheDocument();
        });

        // Click on the leave channel button
        const leaveButton = screen.getByText(/leave channel/i).closest('button')!;
        expect(leaveButton).toBeInTheDocument();
        fireEvent.click(leaveButton);

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
