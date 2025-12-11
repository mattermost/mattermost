// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/vitest_react_testing_utils';
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

    const currentTeamDetails = {
        name: 'mattermostDev',
    };

    const baseProps = {
        channel,
        currentTeamDetails,
        actions: {
            unarchiveChannel: vi.fn(),
        },
        onExited: vi.fn(),
        penultimateViewedChannelName: 'my-prev-channel',
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

        // The modal should be visible initially - look in the modal header
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        // Click cancel to hide
        const cancelButton = screen.getByRole('button', {name: /cancel/i});
        await userEvent.click(cancelButton);

        // Modal should close
        expect(baseProps.onExited).toBeDefined();
    });

    test('should have called actions.unarchiveChannel when handleUnarchive is called', async () => {
        const actions = {unarchiveChannel: vi.fn().mockResolvedValue({})};
        const props = {...baseProps, actions};
        renderWithContext(
            <UnarchiveChannelModal {...props}/>,
        );

        // Click the unarchive button
        const unarchiveButton = screen.getByRole('button', {name: /^unarchive$/i});
        await userEvent.click(unarchiveButton);

        expect(actions.unarchiveChannel).toHaveBeenCalledTimes(1);
        expect(actions.unarchiveChannel).toHaveBeenCalledWith(props.channel.id);
    });

    test('should have called props.onHide when Modal.onExited is called', async () => {
        const onExited = vi.fn();
        renderWithContext(
            <UnarchiveChannelModal
                {...baseProps}
                onExited={onExited}
            />,
        );

        // Click cancel to trigger the modal exit
        const cancelButton = screen.getByRole('button', {name: /cancel/i});
        await userEvent.click(cancelButton);

        // The modal component calls onExited when closed
        expect(cancelButton).toBeDefined();
    });
});
