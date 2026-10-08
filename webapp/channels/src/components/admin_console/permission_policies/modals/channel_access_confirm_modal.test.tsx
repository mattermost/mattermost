// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {ACCESS_CONTROL_ACTION_CHANNEL_MANAGEMENT_ACCESS, ACCESS_CONTROL_ACTION_CHANNEL_READ_ACCESS} from '@mattermost/types/access_control';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import ChannelAccessConfirmModal from './channel_access_confirm_modal';

describe('components/admin_console/permission_policies/modals/ChannelAccessConfirmModal', () => {
    const baseProps = {
        show: true,
        onHide: jest.fn(),
        onConfirm: jest.fn(),
        targetScope: 'system' as const,
        actions: [ACCESS_CONTROL_ACTION_CHANNEL_READ_ACCESS],
    };

    const workspaceScopeCopy = 'This policy controls Channel Read Access across every channel in the workspace, except direct messages and group messages.';
    const channelScopeCopy = 'This policy controls Channel Read Access for this channel only.';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('states the workspace-wide scope, the effect on sessions and the simulate prompt', () => {
        renderWithContext(<ChannelAccessConfirmModal {...baseProps}/>);

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
            <ChannelAccessConfirmModal
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

    const managementWorkspaceScopeCopy = 'This policy controls Manage Channel across every channel in the workspace, except direct messages and group messages.';
    const managementChannelScopeCopy = 'This policy controls Manage Channel for this channel only.';
    const managementEffectCopy = 'Anyone who does not meet the conditions will no longer be able to change the settings, bookmarks, members or access rules of channels covered by this policy. System admins are not affected.';

    test('explains channel_management_access alone when it is the only confirmable action', () => {
        renderWithContext(
            <ChannelAccessConfirmModal
                {...baseProps}
                actions={[ACCESS_CONTROL_ACTION_CHANNEL_MANAGEMENT_ACCESS]}
            />,
        );

        expect(screen.getByText(managementWorkspaceScopeCopy)).toBeInTheDocument();
        expect(screen.getByText(managementEffectCopy)).toBeInTheDocument();
        expect(screen.queryByText(workspaceScopeCopy)).not.toBeInTheDocument();
        expect(screen.getByText('Run Simulate rules first if you have not confirmed who this affects.')).toBeInTheDocument();
    });

    test('explains both actions when the policy carries both', () => {
        renderWithContext(
            <ChannelAccessConfirmModal
                {...baseProps}
                targetScope='channel'
                actions={[ACCESS_CONTROL_ACTION_CHANNEL_READ_ACCESS, ACCESS_CONTROL_ACTION_CHANNEL_MANAGEMENT_ACCESS]}
            />,
        );

        expect(screen.getByText(channelScopeCopy)).toBeInTheDocument();
        expect(screen.getByText(managementChannelScopeCopy)).toBeInTheDocument();
        expect(screen.getByText(managementEffectCopy)).toBeInTheDocument();
        expect(screen.getAllByText('Run Simulate rules first if you have not confirmed who this affects.')).toHaveLength(1);
    });

    test('confirming calls onConfirm and not onHide', async () => {
        renderWithContext(<ChannelAccessConfirmModal {...baseProps}/>);

        await userEvent.click(screen.getByRole('button', {name: 'Save policy'}));

        expect(baseProps.onConfirm).toHaveBeenCalledTimes(1);
        expect(baseProps.onHide).not.toHaveBeenCalled();
    });

    test('cancelling calls onHide and not onConfirm', async () => {
        renderWithContext(<ChannelAccessConfirmModal {...baseProps}/>);

        await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

        expect(baseProps.onHide).toHaveBeenCalledTimes(1);
        expect(baseProps.onConfirm).not.toHaveBeenCalled();
    });

    // The editors keep the dialog mounted while the save request runs, so this
    // state is reachable: isSaving is what stops a second confirm click.
    test('both buttons are inert while a save is in flight', () => {
        renderWithContext(
            <ChannelAccessConfirmModal
                {...baseProps}
                isSaving={true}
            />,
        );

        expect(screen.getByRole('button', {name: 'Save policy'})).toBeDisabled();
        expect(screen.getByRole('button', {name: 'Cancel'})).toBeDisabled();
    });

    test('a second confirm click while saving does not fire onConfirm again', async () => {
        const {rerender} = renderWithContext(<ChannelAccessConfirmModal {...baseProps}/>);

        await userEvent.click(screen.getByRole('button', {name: 'Save policy'}));
        expect(baseProps.onConfirm).toHaveBeenCalledTimes(1);

        rerender(
            <ChannelAccessConfirmModal
                {...baseProps}
                isSaving={true}
            />,
        );
        await userEvent.click(screen.getByRole('button', {name: 'Save policy'}));

        expect(baseProps.onConfirm).toHaveBeenCalledTimes(1);
    });
});
