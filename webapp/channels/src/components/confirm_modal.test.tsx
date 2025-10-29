// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act} from '@testing-library/react';
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

        await act(async () => {
            await userEvent.click(confirmButton);
        });
        expect(props.onConfirm).toHaveBeenCalledWith(false);

        await act(async () => {
            await userEvent.click(checkbox);
        });
        expect(checkbox).toBeChecked();

        await act(async () => {
            await userEvent.click(confirmButton);
        });
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

        await act(async () => {
            await userEvent.click(cancelButton);
        });
        expect(props.onCancel).toHaveBeenCalledWith(false);

        await act(async () => {
            await userEvent.click(checkbox);
        });
        expect(checkbox).toBeChecked();

        await act(async () => {
            await userEvent.click(cancelButton);
        });
        expect(props.onCancel).toHaveBeenCalledWith(true);
    });

    test('should disable confirm button when confirmDisabled is true', () => {
        const props = {
            ...baseProps,
            confirmDisabled: true,
            confirmButtonText: 'Confirm',
        };

        const {getByRole} = renderWithContext(<ConfirmModal {...props}/>);
        const confirmButton = getByRole('button', {name: 'Confirm'});

        expect(confirmButton).toBeDisabled();
    });

    test('should enable confirm button when confirmDisabled is false', () => {
        const props = {
            ...baseProps,
            confirmDisabled: false,
            confirmButtonText: 'Confirm',
        };

        const {getByRole} = renderWithContext(<ConfirmModal {...props}/>);
        const confirmButton = getByRole('button', {name: 'Confirm'});

        expect(confirmButton).not.toBeDisabled();
    });

    test('should use custom checkbox class when provided', () => {
        const props = {
            ...baseProps,
            showCheckbox: true,
            checkboxClass: 'custom-checkbox-class',
        };

        renderWithContext(<ConfirmModal {...props}/>);
        const checkboxContainer = document.querySelector('.custom-checkbox-class');

        expect(checkboxContainer).toBeInTheDocument();
    });

    test('should call onCheckboxChange when checkbox is changed', async () => {
        const mockOnCheckboxChange = jest.fn();
        const props = {
            ...baseProps,
            showCheckbox: true,
            onCheckboxChange: mockOnCheckboxChange,
        };

        const {getByRole} = renderWithContext(<ConfirmModal {...props}/>);
        const checkbox = getByRole('checkbox');

        await act(async () => {
            await userEvent.click(checkbox);
        });

        expect(mockOnCheckboxChange).toHaveBeenCalledWith(true);
    });
});
