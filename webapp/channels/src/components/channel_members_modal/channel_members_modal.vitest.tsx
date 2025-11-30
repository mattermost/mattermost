// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, waitFor} from '@testing-library/react';
import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';

import ChannelInviteModal from 'components/channel_invite_modal';

import {act, renderWithContext, userEvent} from 'tests/vitest_react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';

import ChannelMembersModal from './channel_members_modal';

describe('components/ChannelMembersModal', () => {
    const baseProps = {
        channel: {
            id: 'channel_id',
            display_name: 'channel_display_name',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
            team_id: '',
            type: 'O' as ChannelType,
            name: '',
            header: '',
            purpose: '',
            last_post_at: 0,
            last_root_post_at: 0,
            creator_id: '',
            scheme_id: '',
            group_constrained: false,
        },
        canManageChannelMembers: true,
        onExited: vi.fn(),
        actions: {
            openModal: vi.fn(),
        },
    };

    test('should match snapshot', async () => {
        let container: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
                <ChannelMembersModal {...baseProps}/>,
            );
            container = result.container;
        });

        expect(container!).toMatchSnapshot();
    });

    test('should match state when onHide is called', async () => {
        renderWithContext(
            <ChannelMembersModal {...baseProps}/>,
        );

        // Modal should be visible initially
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        // Click the close button to hide the modal
        const closeButton = screen.getByLabelText('Close');
        await userEvent.click(closeButton);

        // Modal should be hidden (not visible)
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    test('should have called props.actions.openModal and hide modal when onAddNewMembersButton is called', async () => {
        const openModal = vi.fn();
        const props = {
            ...baseProps,
            actions: {
                openModal,
            },
        };

        renderWithContext(
            <ChannelMembersModal {...props}/>,
        );

        // Modal should be visible initially
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        // Click the add members button
        const addMembersButton = document.getElementById('showInviteModal')!;
        await userEvent.click(addMembersButton);

        // openModal should have been called
        expect(openModal).toHaveBeenCalledTimes(1);

        // Modal should be hidden
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    test('should have state when Modal.onHide', async () => {
        renderWithContext(
            <ChannelMembersModal {...baseProps}/>,
        );

        // Modal should be visible initially
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        // Trigger modal hide by clicking close button
        const closeButton = screen.getByLabelText('Close');
        await userEvent.click(closeButton);

        // Modal should be hidden
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    test('should match snapshot with archived channel', async () => {
        const props = {...baseProps, channel: {...baseProps.channel, delete_at: 1234}};

        let container: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
                <ChannelMembersModal {...props}/>,
            );
            container = result.container;
        });

        expect(container!).toMatchSnapshot();
    });

    test('renders the channel display name', async () => {
        await act(async () => {
            renderWithContext(
                <ChannelMembersModal {...baseProps}/>,
            );
        });
        expect(screen.getByText(baseProps.channel.display_name)).toBeInTheDocument();
    });

    test('should show the invite modal link if the user can manage channel members', async () => {
        const newProps = {...baseProps, canManageChannelMembers: true};
        await act(async () => {
            renderWithContext(
                <ChannelMembersModal {...newProps}/>,
            );
        });
        expect(document.getElementById('showInviteModal')).toBeInTheDocument();
    });

    test('should not show the invite modal link if the user can not manage channel members', async () => {
        const newProps = {...baseProps, canManageChannelMembers: false};
        await act(async () => {
            renderWithContext(
                <ChannelMembersModal {...newProps}/>,
            );
        });
        expect(document.getElementById('showInviteModal')).not.toBeInTheDocument();
    });

    test('should call openModal with ChannelInviteModal when the add members link is clicked', async () => {
        const openModal = vi.fn();
        const newProps = {
            ...baseProps,
            canManageChannelMembers: false,
            actions: {
                openModal,
            },
        };
        renderWithContext(
            <ChannelMembersModal {...newProps}/>,
        );

        expect(openModal).not.toHaveBeenCalled();

        // Since canManageChannelMembers is false, we need to call the method directly
        // In the original Jest test, it called wrapper.instance().onAddNewMembersButton()
        // For RTL, we'll simulate by using canManageChannelMembers: true
        const newPropsWithAccess = {
            ...baseProps,
            canManageChannelMembers: true,
            actions: {
                openModal,
            },
        };

        const {unmount} = renderWithContext(
            <ChannelMembersModal {...newPropsWithAccess}/>,
        );

        const addMembersButton = document.getElementById('showInviteModal')!;
        await userEvent.click(addMembersButton);

        expect(openModal).toHaveBeenCalledWith({
            modalId: ModalIdentifiers.CHANNEL_INVITE,
            dialogType: ChannelInviteModal,
            dialogProps: {channel: newPropsWithAccess.channel},
        });

        unmount();
    });
});
