// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, userEvent} from 'tests/react_testing_utils';

import ConfirmModal from './confirm_modal';

describe('ConfirmModal', () => {
    const baseProps = {
        show: true,
        onConfirm: jest.fn(),
        onCancel: jest.fn(),
    };

    test('should call onConfirm with correct checkbox value when confirm button is pressed', async () => {
        const props = {
            ...baseProps,
            showCheckbox: true,
            confirmButtonText: 'Confirm',
        };

        const {getByRole} = renderWithContext(<ConfirmModal {...props}/>);

        const checkbox = getByRole('checkbox');

        expect(checkbox).toBeVisible();
        expect(checkbox).not.toBeChecked();

        const confirmButton = getByRole('button', {name: props.confirmButtonText});

        await userEvent.click(confirmButton);
        expect(props.onConfirm).toHaveBeenCalledWith(false);

        await userEvent.click(checkbox);
        expect(checkbox).toBeChecked();

        await userEvent.click(confirmButton);
        expect(props.onConfirm).toHaveBeenCalledWith(true);
    });

    test('should call onCancel with correct checkbox value when cancel button is pressed', async () => {
        const props = {
            ...baseProps,
            showCheckbox: true,
            cancelButtonText: 'Cancel',
        };

        const {getByRole} = renderWithContext(<ConfirmModal {...props}/>);

        const checkbox = getByRole('checkbox');

        expect(checkbox).toBeVisible();
        expect(checkbox).not.toBeChecked();

        const cancelButton = getByRole('button', {name: props.cancelButtonText});

        await userEvent.click(cancelButton);
        expect(props.onCancel).toHaveBeenCalledWith(false);

        await userEvent.click(checkbox);
        expect(checkbox).toBeChecked();

        await userEvent.click(cancelButton);
        expect(props.onCancel).toHaveBeenCalledWith(true);
    });
});
