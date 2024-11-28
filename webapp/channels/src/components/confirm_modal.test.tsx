// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {screen, render} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ConfirmModal from './confirm_modal';

describe('ConfirmModal', () => {
    const baseProps = {
        show: true,
        onConfirm: jest.fn(),
        onCancel: jest.fn(),
    };

    test('should pass checkbox state when confirm is pressed', async () => {
        const props = {
            ...baseProps,
            showCheckbox: true,
        };

        render(<ConfirmModal {...props}/>);

        const checkbox = screen.getByRole('checkbox');
        const confirmButton = screen.getByRole('button', {name: ''});

        expect(checkbox).not.toBeChecked();
        
        await userEvent.click(confirmButton);
        expect(props.onConfirm).toHaveBeenCalledWith(false);

        await userEvent.click(checkbox);
        expect(checkbox).toBeChecked();

        await userEvent.click(confirmButton);
        expect(props.onConfirm).toHaveBeenCalledWith(true);
    });

    test('should pass checkbox state when cancel is pressed', async () => {
        const props = {
            ...baseProps,
            showCheckbox: true,
        };

        render(<ConfirmModal {...props}/>);

        const checkbox = screen.getByRole('checkbox');
        const cancelButton = screen.getByTestId('cancel-button');

        expect(checkbox).not.toBeChecked();

        await userEvent.click(cancelButton);
        expect(props.onCancel).toHaveBeenCalledWith(false);

        await userEvent.click(checkbox);
        expect(checkbox).toBeChecked();

        await userEvent.click(cancelButton);
        expect(props.onCancel).toHaveBeenCalledWith(true);
    });
});
