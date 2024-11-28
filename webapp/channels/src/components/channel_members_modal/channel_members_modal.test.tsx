// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type {ChannelType} from '@mattermost/types/channels';

import ChannelInviteModal from 'components/channel_invite_modal';

import {ModalIdentifiers} from 'utils/constants';

import {renderWithIntl} from 'tests/react_testing_utils';

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
        onExited: jest.fn(),
        actions: {
            openModal: jest.fn(),
        },
    };

    test('should render channel members modal', () => {
        renderWithIntl(<ChannelMembersModal {...baseProps}/>);

        expect(screen.getByText(baseProps.channel.display_name)).toBeInTheDocument();
        expect(screen.getByText('Members')).toBeInTheDocument();
        expect(screen.getByRole('dialog', {name: /channel_display_name Members/})).toHaveAttribute('id', 'channelMembersModal');
    });

    test('should handle modal close', async () => {
        const user = userEvent;
        renderWithIntl(<ChannelMembersModal {...baseProps}/>);

        const closeButton = screen.getByLabelText('Close');
        await user.click(closeButton);
        
        // Need to wait for async state updates
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(baseProps.onExited).toHaveBeenCalledTimes(1);
    });

    test('should handle add new members', async () => {
        const user = userEvent;
        renderWithIntl(<ChannelMembersModal {...baseProps}/>);

        const addMembersButton = screen.getByText('Add Members');
        await user.click(addMembersButton);

        expect(baseProps.actions.openModal).toHaveBeenCalledWith({
            modalId: ModalIdentifiers.CHANNEL_INVITE,
            dialogType: ChannelInviteModal,
            dialogProps: {channel: baseProps.channel},
        });
    });

    test('should handle archived channel', () => {
        const props = {...baseProps, channel: {...baseProps.channel, delete_at: 1234}};
        renderWithIntl(<ChannelMembersModal {...props}/>);

        expect(screen.queryByText('Add Members')).not.toBeInTheDocument();
    });

    test('should show/hide invite modal link based on permissions', () => {
        const {rerender} = renderWithIntl(<ChannelMembersModal {...baseProps}/>);
        expect(screen.getByText('Add Members')).toBeInTheDocument();

        const newProps = {...baseProps, canManageChannelMembers: false};
        rerender(<ChannelMembersModal {...newProps}/>);
        expect(screen.queryByText('Add Members')).not.toBeInTheDocument();
    });
});
