// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import UnarchiveChannelModal from './unarchive_channel_modal';

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

    test('should match snapshot for unarchive_channel_modal', () => {
        const {baseElement} = renderWithContext(
            <UnarchiveChannelModal {...baseProps}/>,
        );
        expect(baseElement).toMatchSnapshot();
    });

    test('should match state when onHide is called', async () => {
        renderWithContext(
            <UnarchiveChannelModal {...baseProps}/>,
        );

        // Modal should be visible initially
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        // Click cancel button
        await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

        // Modal should be hidden
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    test('should have called actions.unarchiveChannel when handleUnarchive is called', async () => {
        const unarchiveChannel = jest.fn();
        const props = {...baseProps, actions: {unarchiveChannel}};
        renderWithContext(
            <UnarchiveChannelModal {...props}/>,
        );

        // Click unarchive button
        await userEvent.click(screen.getByRole('button', {name: 'Unarchive'}));

        expect(unarchiveChannel).toHaveBeenCalledTimes(1);
        expect(unarchiveChannel).toHaveBeenCalledWith(props.channel.id);

        // Modal should be hidden
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

        // Close modal to trigger onExited
        await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

        await waitFor(() => {
            expect(onExited).toHaveBeenCalledTimes(1);
        });
    });
});
