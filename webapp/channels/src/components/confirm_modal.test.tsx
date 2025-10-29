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

    test('should disable confirm button when confirmDisabled is true', () => {
        const props = {
            ...baseProps,
            confirmDisabled: true,
        };

        const wrapper = shallow(<ConfirmModal {...props}/>);
        const confirmButton = wrapper.find('#confirmModalButton');

        expect(confirmButton.prop('disabled')).toBe(true);
    });

    test('should enable confirm button when confirmDisabled is false', () => {
        const props = {
            ...baseProps,
            confirmDisabled: false,
        };

        const wrapper = shallow(<ConfirmModal {...props}/>);
        const confirmButton = wrapper.find('#confirmModalButton');

        expect(confirmButton.prop('disabled')).toBe(false);
    });

    test('should use custom checkbox class when provided', () => {
        const props = {
            ...baseProps,
            showCheckbox: true,
            checkboxClass: 'custom-checkbox-class',
        };

        const wrapper = shallow(<ConfirmModal {...props}/>);
        const checkboxContainer = wrapper.find('.custom-checkbox-class');

        expect(checkboxContainer.exists()).toBe(true);
    });

    test('should call onCheckboxChange when checkbox is changed', () => {
        const mockOnCheckboxChange = jest.fn();
        const props = {
            ...baseProps,
            showCheckbox: true,
            onCheckboxChange: mockOnCheckboxChange,
        };

        const wrapper = shallow(<ConfirmModal {...props}/>);
        const checkbox = wrapper.find('input[type="checkbox"]');

        checkbox.simulate('change', {target: {checked: true}});

        expect(mockOnCheckboxChange).toHaveBeenCalledWith(true);
        expect(wrapper.state('checked')).toBe(true);
    });
});
