// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import ViewChannelConfirmModal from './view_channel_confirm_modal';

describe('components/admin_console/permission_policies/modals/ViewChannelConfirmModal', () => {
    const baseProps = {
        show: true,
        onHide: jest.fn(),
        onConfirm: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('states the workspace-wide scope, the effect on sessions and the simulate prompt', () => {
        renderWithContext(<ViewChannelConfirmModal {...baseProps}/>);

        expect(screen.getByText('Save this policy?')).toBeInTheDocument();
        expect(screen.getByText('This policy controls View Channel across every channel in the workspace.')).toBeInTheDocument();
        expect(screen.getByText('Any session that does not meet the conditions will stop seeing channels covered by this policy.')).toBeInTheDocument();
        expect(screen.getByText('Run Simulate rules first if you have not confirmed who this affects.')).toBeInTheDocument();
    });

    test('confirming calls onConfirm and not onHide', async () => {
        renderWithContext(<ViewChannelConfirmModal {...baseProps}/>);

        await userEvent.click(screen.getByRole('button', {name: 'Save policy'}));

        expect(baseProps.onConfirm).toHaveBeenCalledTimes(1);
        expect(baseProps.onHide).not.toHaveBeenCalled();
    });

    test('cancelling calls onHide and not onConfirm', async () => {
        renderWithContext(<ViewChannelConfirmModal {...baseProps}/>);

        await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

        expect(baseProps.onHide).toHaveBeenCalledTimes(1);
        expect(baseProps.onConfirm).not.toHaveBeenCalled();
    });

    // The editors keep the dialog mounted while the save request runs, so this
    // state is reachable: isSaving is what stops a second confirm click.
    test('both buttons are inert while a save is in flight', () => {
        renderWithContext(
            <ViewChannelConfirmModal
                {...baseProps}
                isSaving={true}
            />,
        );

        expect(screen.getByRole('button', {name: 'Save policy'})).toBeDisabled();
        expect(screen.getByRole('button', {name: 'Cancel'})).toBeDisabled();
    });

    test('a second confirm click while saving does not fire onConfirm again', async () => {
        const {rerender} = renderWithContext(<ViewChannelConfirmModal {...baseProps}/>);

        await userEvent.click(screen.getByRole('button', {name: 'Save policy'}));
        expect(baseProps.onConfirm).toHaveBeenCalledTimes(1);

        rerender(
            <ViewChannelConfirmModal
                {...baseProps}
                isSaving={true}
            />,
        );
        await userEvent.click(screen.getByRole('button', {name: 'Save policy'}));

        expect(baseProps.onConfirm).toHaveBeenCalledTimes(1);
    });
});
