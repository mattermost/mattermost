// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import MarkAllAsReadModal from './mark_all_as_read_modal';

describe('components/MarkAllAsReadModal', () => {
    const baseProps = {
        onConfirm: jest.fn(),
        onHide: jest.fn(),
    };

    test('should render modal content', () => {
        renderWithContext(<MarkAllAsReadModal {...baseProps}/>);

        expect(screen.getByText('Mark all messages as read?')).toBeInTheDocument();
        expect(screen.getByText(/will mark all messages as read/i)).toBeInTheDocument();
    });

    test('should render checkbox with correct label', () => {
        renderWithContext(<MarkAllAsReadModal {...baseProps}/>);

        const checkbox = screen.getByRole('checkbox', {name: /Don't ask me again/});
        expect(checkbox).toBeInTheDocument();
        expect(checkbox).not.toBeChecked();
    });

    test('should toggle checkbox state when clicked', async () => {
        renderWithContext(<MarkAllAsReadModal {...baseProps}/>);

        const checkbox = screen.getByRole('checkbox', {name: /Don't ask me again/});
        expect(checkbox).not.toBeChecked();

        await userEvent.click(checkbox);
        expect(checkbox).toBeChecked();

        await userEvent.click(checkbox);
        expect(checkbox).not.toBeChecked();
    });

    test('should render cancel and confirm buttons', () => {
        renderWithContext(<MarkAllAsReadModal {...baseProps}/>);

        expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Mark all read'})).toBeInTheDocument();
    });

    test('should call onHide when cancel button is clicked', async () => {
        const onHide = jest.fn();
        renderWithContext(
            <MarkAllAsReadModal
                {...baseProps}
                onHide={onHide}
            />,
        );

        const cancelButton = screen.getByRole('button', {name: 'Cancel'});
        await userEvent.click(cancelButton);

        expect(onHide).toHaveBeenCalledTimes(1);
    });

    test('should call onConfirm with false when confirm button is clicked without checkbox', async () => {
        const onConfirm = jest.fn();
        renderWithContext(
            <MarkAllAsReadModal
                {...baseProps}
                onConfirm={onConfirm}
            />,
        );

        const confirmButton = screen.getByRole('button', {name: 'Mark all read'});
        await userEvent.click(confirmButton);

        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onConfirm).toHaveBeenCalledWith(false);
    });

    test('should call onConfirm with true when confirm button is clicked with checkbox checked', async () => {
        const onConfirm = jest.fn();
        renderWithContext(
            <MarkAllAsReadModal
                {...baseProps}
                onConfirm={onConfirm}
            />,
        );

        const checkbox = screen.getByRole('checkbox', {name: /Don't ask me again/});
        await userEvent.click(checkbox);

        const confirmButton = screen.getByRole('button', {name: 'Mark all read'});
        await userEvent.click(confirmButton);

        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onConfirm).toHaveBeenCalledWith(true);
    });

    test('should reset checkbox state when cancel is clicked', async () => {
        renderWithContext(<MarkAllAsReadModal {...baseProps}/>);

        const checkbox = screen.getByRole('checkbox', {name: /Don't ask me again/});
        await userEvent.click(checkbox);
        expect(checkbox).toBeChecked();

        const cancelButton = screen.getByRole('button', {name: 'Cancel'});
        await userEvent.click(cancelButton);

        // Re-render to check state after cancel
        const {rerender} = renderWithContext(<MarkAllAsReadModal {...baseProps}/>);
        rerender(<MarkAllAsReadModal {...baseProps}/>);

        const checkboxAfterCancel = screen.getByRole('checkbox', {name: /Don't ask me again/});
        expect(checkboxAfterCancel).not.toBeChecked();
    });
});
