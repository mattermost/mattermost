// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import useMissingRequiredChannelAttributes from 'components/common/hooks/useMissingRequiredChannelAttributes';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import UnarchiveChannelModal from './unarchive_channel_modal';

jest.mock('components/common/hooks/useMissingRequiredChannelAttributes');

const mockUseMissingRequiredChannelAttributes = jest.mocked(useMissingRequiredChannelAttributes);

describe('components/unarchive_channel_modal', () => {
    const channel = TestHelper.getChannelMock({
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
    });

    const baseProps = {
        channel,
        actions: {
            unarchiveChannel: jest.fn(),
        },
        onExited: jest.fn(),
    };

    beforeEach(() => {
        mockUseMissingRequiredChannelAttributes.mockReturnValue({loading: false, missing: []});
    });

    test('should have called actions.unarchiveChannel when Unarchive is clicked', async () => {
        const unarchiveChannel = jest.fn().mockResolvedValue({data: true});
        const props = {...baseProps, actions: {unarchiveChannel}};
        renderWithContext(
            <UnarchiveChannelModal {...props}/>,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Unarchive'}));

        expect(unarchiveChannel).toHaveBeenCalledTimes(1);
        expect(unarchiveChannel).toHaveBeenCalledWith(props.channel.id);

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    test('should have called props.onExited on Cancel', async () => {
        const onExited = jest.fn();
        renderWithContext(
            <UnarchiveChannelModal
                {...baseProps}
                onExited={onExited}
            />,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

        await waitFor(() => {
            expect(onExited).toHaveBeenCalledTimes(1);
        });
    });

    test('shows no warning and the plain "Unarchive" label when no required attribute is missing', () => {
        renderWithContext(
            <UnarchiveChannelModal {...baseProps}/>,
        );

        expect(screen.getByRole('button', {name: 'Unarchive'})).toBeInTheDocument();
        expect(screen.queryByText('Missing required attribute values')).not.toBeInTheDocument();
    });

    test('warns and relabels the confirm button when a required attribute is missing, but does not block the restore', async () => {
        mockUseMissingRequiredChannelAttributes.mockReturnValue({
            loading: false,
            missing: [{
                id: 'field1',
                group_id: 'group1',
                name: 'cost_center',
                type: 'text',
                target_id: '',
                target_type: 'channel',
                object_type: 'channel',
                create_at: 0,
                update_at: 0,
                delete_at: 0,
                created_by: '',
                updated_by: '',
                attrs: {required: true, display_name: 'Cost center'},
            }],
        });

        const unarchiveChannel = jest.fn().mockResolvedValue({data: true});
        const props = {...baseProps, actions: {unarchiveChannel}};
        renderWithContext(
            <UnarchiveChannelModal {...props}/>,
        );

        expect(screen.getByText('Missing required attribute values')).toBeInTheDocument();
        const confirmButton = screen.getByRole('button', {name: 'Unarchive anyway'});
        expect(confirmButton).toBeInTheDocument();

        await userEvent.click(confirmButton);

        expect(unarchiveChannel).toHaveBeenCalledWith(props.channel.id);
    });

    test('stays open and shows the server error when unarchiveChannel fails', async () => {
        const unarchiveChannel = jest.fn().mockResolvedValue({error: {message: 'Something went wrong'}});
        const props = {...baseProps, actions: {unarchiveChannel}};
        renderWithContext(
            <UnarchiveChannelModal {...props}/>,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Unarchive'}));

        await waitFor(() => {
            expect(screen.getByText('Something went wrong')).toBeInTheDocument();
        });
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
});
