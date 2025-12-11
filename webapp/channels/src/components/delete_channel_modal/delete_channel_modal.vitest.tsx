// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel, ChannelType} from '@mattermost/types/channels';

import {renderWithContext, screen, fireEvent, waitFor} from 'tests/vitest_react_testing_utils';

import DeleteChannelModal from './delete_channel_modal';
import type {Props} from './delete_channel_modal';

describe('components/delete_channel_modal', () => {
    const channel: Channel = {
        id: 'owsyt8n43jfxjpzh9np93mx1wa',
        create_at: 1508265709607,
        update_at: 1508265709607,
        delete_at: 0,
        team_id: 'eatxocwc3bg9ffo9xyybnj4omr',
        type: 'O' as ChannelType,
        display_name: 'testing',
        name: 'testing',
        header: 'test',
        purpose: 'test',
        last_post_at: 1508265709635,
        last_root_post_at: 1508265709635,
        creator_id: 'zaktnt8bpbgu8mb6ez9k64r7sa',
        scheme_id: '',
        group_constrained: false,
    };

    const baseProps: Props = {
        channel,
        actions: {
            deleteChannel: vi.fn(() => {
                return {data: true};
            }),
        },
        onExited: vi.fn(),
    };

    test('should match snapshot for delete_channel_modal', () => {
        renderWithContext(
            <DeleteChannelModal {...baseProps}/>,
        );

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText(/Are you sure you wish to archive the/)).toBeInTheDocument();
    });

    test('should match state when onHide is called', async () => {
        renderWithContext(
            <DeleteChannelModal {...baseProps}/>,
        );

        expect(screen.getByRole('dialog')).toBeInTheDocument();

        const cancelButton = screen.getByText('Cancel');
        fireEvent.click(cancelButton);

        await waitFor(() => {
            expect(baseProps.onExited).toHaveBeenCalled();
        });
    });

    test('should have called actions.deleteChannel when handleDelete is called', async () => {
        const deleteChannel = vi.fn(() => ({data: true}));
        const props = {...baseProps, actions: {deleteChannel}};

        renderWithContext(
            <DeleteChannelModal {...props}/>,
        );

        const archiveButton = screen.getByText('Archive');
        fireEvent.click(archiveButton);

        expect(deleteChannel).toHaveBeenCalledTimes(1);
        expect(deleteChannel).toHaveBeenCalledWith(props.channel.id);
    });

    test('should have called props.onExited when Modal.onExited is called', async () => {
        const onExited = vi.fn();
        const props = {...baseProps, onExited};

        renderWithContext(
            <DeleteChannelModal {...props}/>,
        );

        // Close the modal by clicking cancel
        const cancelButton = screen.getByText('Cancel');
        fireEvent.click(cancelButton);

        await waitFor(() => {
            expect(onExited).toHaveBeenCalled();
        });
    });
});
