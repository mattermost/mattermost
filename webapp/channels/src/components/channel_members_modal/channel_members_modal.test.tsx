// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';

import ChannelInviteModal from 'components/channel_invite_modal';

import {act, renderWithContext, screen} from 'tests/react_testing_utils';
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
        onExited: jest.fn(),
        actions: {
            openModal: jest.fn(),
        },
    };

    test('should match snapshot', () => {
        const {baseElement} = renderWithContext(
            <ChannelMembersModal {...baseProps}/>,
        );

        expect(baseElement).toMatchSnapshot();
    });

    test('should match state when onHide is called', () => {
        const ref = React.createRef<ChannelMembersModal>();
        renderWithContext(
            <ChannelMembersModal
                ref={ref}
                {...baseProps}
            />,
        );

        act(() => {
            ref.current!.setState({show: true});
        });
        act(() => {
            ref.current!.handleHide();
        });
        expect(ref.current!.state.show).toEqual(false);
    });

    test('should have called props.actions.openModal and hide modal when onAddNewMembersButton is called', () => {
        const ref = React.createRef<ChannelMembersModal>();
        renderWithContext(
            <ChannelMembersModal
                ref={ref}
                {...baseProps}
            />,
        );

        act(() => {
            ref.current!.onAddNewMembersButton();
        });
        expect(baseProps.actions.openModal).toHaveBeenCalledTimes(1);

        expect(ref.current!.state.show).toBe(false);
    });

    test('should have state when Modal.onHide', () => {
        const ref = React.createRef<ChannelMembersModal>();
        renderWithContext(
            <ChannelMembersModal
                ref={ref}
                {...baseProps}
            />,
        );

        act(() => {
            ref.current!.setState({show: true});
        });
        act(() => {
            ref.current!.handleHide();
        });
        expect(ref.current!.state.show).toEqual(false);
    });

    test('should match snapshot with archived channel', () => {
        const props = {...baseProps, channel: {...baseProps.channel, delete_at: 1234}};

        const {baseElement} = renderWithContext(
            <ChannelMembersModal {...props}/>,
        );

        expect(baseElement).toMatchSnapshot();
    });

    test('renders the channel display name', () => {
        renderWithContext(
            <ChannelMembersModal {...baseProps}/>,
        );
        expect(screen.getByText(baseProps.channel.display_name)).toBeInTheDocument();
    });

    test('should show the invite modal link if the user can manage channel members', () => {
        const newProps = {...baseProps, canManageChannelMembers: true};
        renderWithContext(
            <ChannelMembersModal {...newProps}/>,
        );
        expect(document.querySelector('#showInviteModal')).toBeInTheDocument();
    });

    test('should not show the invite modal link if the user can not manage channel members', () => {
        const newProps = {...baseProps, canManageChannelMembers: false};
        renderWithContext(
            <ChannelMembersModal {...newProps}/>,
        );
        expect(document.querySelector('#showInviteModal')).not.toBeInTheDocument();
    });

    test('should call openModal with ChannelInviteModal when the add members link is clicked', () => {
        const openModal = jest.fn();
        const newProps = {
            ...baseProps,
            canManageChannelMembers: false,
            actions: {
                openModal,
            },
        };
        const ref = React.createRef<ChannelMembersModal>();
        renderWithContext(
            <ChannelMembersModal
                ref={ref}
                {...newProps}
            />,
        );
        expect(openModal).not.toHaveBeenCalled();
        act(() => {
            ref.current!.onAddNewMembersButton();
        });
        expect(openModal).toHaveBeenCalledWith({
            modalId: ModalIdentifiers.CHANNEL_INVITE,
            dialogType: ChannelInviteModal,
            dialogProps: {channel: newProps.channel},
        });
    });
});
