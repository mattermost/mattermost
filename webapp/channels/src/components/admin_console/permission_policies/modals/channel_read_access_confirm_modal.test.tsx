// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import ChannelReadAccessConfirmModal from './channel_read_access_confirm_modal';

describe('components/admin_console/permission_policies/modals/ChannelReadAccessConfirmModal', () => {
    const baseProps = {
        show: true,
        onHide: jest.fn(),
        onConfirm: jest.fn(),
        targetScope: 'system' as const,
    };

    const workspaceScopeCopy = 'This policy controls Channel Read Access across every channel in the workspace, except direct messages and group messages.';
    const channelScopeCopy = 'This policy controls Channel Read Access for this channel only.';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('states the workspace-wide scope, the effect on sessions and the simulate prompt', () => {
        renderWithContext(<ChannelReadAccessConfirmModal {...baseProps}/>);

        expect(screen.getByText('Save this policy?')).toBeInTheDocument();
        expect(screen.getByText(workspaceScopeCopy)).toBeInTheDocument();
        expect(screen.queryByText(channelScopeCopy)).not.toBeInTheDocument();
        expect(screen.getByText('Any session that does not meet the conditions will lose access to channels covered by this policy.')).toBeInTheDocument();
        expect(screen.getByText('Run Simulate rules first if you have not confirmed who this affects.')).toBeInTheDocument();
    });

    // A channel resource policy is saved with type 'channel' and id = channel.id,
    // so it governs only that channel. Reporting workspace-wide reach here would
    // overstate the blast radius of the save being confirmed.
    test('scopes the copy to the single channel when saving a channel policy', () => {
        renderWithContext(
            <ChannelReadAccessConfirmModal
                {...baseProps}
                targetScope='channel'
            />,
        );

        expect(screen.getByText(channelScopeCopy)).toBeInTheDocument();
        expect(screen.queryByText(workspaceScopeCopy)).not.toBeInTheDocument();

        // Scope-independent copy still shows.
        expect(screen.getByText('Any session that does not meet the conditions will lose access to channels covered by this policy.')).toBeInTheDocument();
        expect(screen.getByText('Run Simulate rules first if you have not confirmed who this affects.')).toBeInTheDocument();
    });

    test('confirming calls onConfirm and not onHide', async () => {
        renderWithContext(<ChannelReadAccessConfirmModal {...baseProps}/>);

        await userEvent.click(screen.getByRole('button', {name: 'Save policy'}));

        expect(baseProps.onConfirm).toHaveBeenCalledTimes(1);
        expect(baseProps.onHide).not.toHaveBeenCalled();
    });

    test('cancelling calls onHide and not onConfirm', async () => {
        renderWithContext(<ChannelReadAccessConfirmModal {...baseProps}/>);

        await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

        expect(baseProps.onHide).toHaveBeenCalledTimes(1);
        expect(baseProps.onConfirm).not.toHaveBeenCalled();
    });

    // The editors keep the dialog mounted while the save request runs, so this
    // state is reachable: isSaving is what stops a second confirm click.
    test('both buttons are inert while a save is in flight', () => {
        renderWithContext(
            <ChannelReadAccessConfirmModal
                {...baseProps}
                isSaving={true}
            />,
        );

        expect(screen.getByRole('button', {name: 'Save policy'})).toBeDisabled();
        expect(screen.getByRole('button', {name: 'Cancel'})).toBeDisabled();
    });

    test('a second confirm click while saving does not fire onConfirm again', async () => {
        const {rerender} = renderWithContext(<ChannelReadAccessConfirmModal {...baseProps}/>);

        await userEvent.click(screen.getByRole('button', {name: 'Save policy'}));
        expect(baseProps.onConfirm).toHaveBeenCalledTimes(1);

        rerender(
            <ChannelReadAccessConfirmModal
                {...baseProps}
                isSaving={true}
            />,
        );
        await userEvent.click(screen.getByRole('button', {name: 'Save policy'}));

        expect(baseProps.onConfirm).toHaveBeenCalledTimes(1);
    });
});
