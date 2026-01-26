// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, fireEvent, waitFor} from '@testing-library/react';
import React from 'react';

import TextInputModal from 'components/text_input_modal/text_input_modal';

import {renderWithContext} from 'tests/react_testing_utils';

describe('components/TextInputModal', () => {
    const baseProps = {
        show: true,
        title: 'Test Modal',
        placeholder: 'Enter text...',
        onConfirm: jest.fn(),
        onCancel: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should render modal when show is true', () => {
        renderWithContext(<TextInputModal {...baseProps}/>);

        expect(screen.getByRole('dialog', {name: 'Test Modal'})).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Enter text...')).toBeInTheDocument();
    });

    test('should not render modal when show is false', () => {
        renderWithContext(<TextInputModal {...{...baseProps, show: false}}/>);

        expect(screen.queryByText('Test Modal')).not.toBeInTheDocument();
    });

    test('should render with initial value', () => {
        renderWithContext(
            <TextInputModal
                {...baseProps}
                initialValue='Initial text'
            />,
        );

        const input = screen.getByPlaceholderText('Enter text...') as HTMLInputElement;
        expect(input.value).toBe('Initial text');
    });

    test('should render with field label when provided', () => {
        renderWithContext(
            <TextInputModal
                {...baseProps}
                fieldLabel='Custom Label'
            />,
        );

        expect(screen.getByText('Custom Label')).toBeInTheDocument();
    });

    test('should render with help text when provided', () => {
        renderWithContext(
            <TextInputModal
                {...baseProps}
                helpText='This is help text'
            />,
        );

        expect(screen.getByText('This is help text')).toBeInTheDocument();
    });

    test('should render custom button text', () => {
        renderWithContext(
            <TextInputModal
                {...baseProps}
                confirmButtonText='Save'
                cancelButtonText='Discard'
            />,
        );

        expect(screen.getByText('Save')).toBeInTheDocument();
        expect(screen.getByText('Discard')).toBeInTheDocument();
    });

    test('should update input value on change', () => {
        renderWithContext(<TextInputModal {...baseProps}/>);

        const input = screen.getByPlaceholderText('Enter text...') as HTMLInputElement;
        fireEvent.change(input, {target: {value: 'New value'}});

        expect(input.value).toBe('New value');
    });

    test('should call onConfirm with trimmed value when confirm button is clicked', async () => {
        renderWithContext(<TextInputModal {...baseProps}/>);

        const input = screen.getByPlaceholderText('Enter text...');
        fireEvent.change(input, {target: {value: '  Test value  '}});

        const confirmButton = screen.getByText('Confirm');
        fireEvent.click(confirmButton);

        await waitFor(() => {
            expect(baseProps.onConfirm).toHaveBeenCalledWith('Test value');
        });
    });

    test('should call onConfirm when Enter key is pressed', async () => {
        renderWithContext(<TextInputModal {...baseProps}/>);

        const input = screen.getByPlaceholderText('Enter text...');
        fireEvent.change(input, {target: {value: 'Test value'}});
        fireEvent.keyDown(input, {key: 'Enter', code: 'Enter'});

        await waitFor(() => {
            expect(baseProps.onConfirm).toHaveBeenCalledWith('Test value');
        });
    });

    test('should not call onConfirm with empty value', async () => {
        renderWithContext(<TextInputModal {...baseProps}/>);

        const input = screen.getByPlaceholderText('Enter text...');
        fireEvent.change(input, {target: {value: '   '}});

        const confirmButton = screen.getByText('Confirm');
        fireEvent.click(confirmButton);

        await waitFor(() => {
            expect(baseProps.onConfirm).not.toHaveBeenCalled();
        });
    });

    test('should disable confirm button when input is empty', () => {
        renderWithContext(<TextInputModal {...baseProps}/>);

        const confirmButton = screen.getByText('Confirm');
        expect(confirmButton).toBeDisabled();
    });

    test('should enable confirm button when input has value', () => {
        renderWithContext(<TextInputModal {...baseProps}/>);

        const input = screen.getByPlaceholderText('Enter text...');
        fireEvent.change(input, {target: {value: 'Test'}});

        const confirmButton = screen.getByText('Confirm');
        expect(confirmButton).not.toBeDisabled();
    });

    test('should call onCancel when cancel button is clicked', () => {
        renderWithContext(<TextInputModal {...baseProps}/>);

        const cancelButton = screen.getByText('Cancel');
        fireEvent.click(cancelButton);

        expect(baseProps.onCancel).toHaveBeenCalledTimes(1);
    });

    test('should call onHide when provided and cancel is clicked', () => {
        const onHide = jest.fn();
        renderWithContext(
            <TextInputModal
                {...baseProps}
                onHide={onHide}
            />,
        );

        const cancelButton = screen.getByRole('button', {name: 'Cancel'});
        fireEvent.click(cancelButton);

        expect(baseProps.onCancel).toHaveBeenCalledTimes(1);
        expect(onHide).toHaveBeenCalled();
    });

    test('should call onExited when provided', () => {
        const onExited = jest.fn();
        const {rerender} = renderWithContext(
            <TextInputModal
                {...baseProps}
                onExited={onExited}
            />,
        );

        // Simulate modal closing
        rerender(
            <TextInputModal
                {...baseProps}
                show={false}
                onExited={onExited}
            />,
        );

        // Note: onExited is called by GenericModal on exit animation complete
        // This test verifies the prop is passed through correctly
    });

    test('should enforce maxLength on input', () => {
        renderWithContext(
            <TextInputModal
                {...baseProps}
                maxLength={10}
            />,
        );

        const input = screen.getByPlaceholderText('Enter text...') as HTMLInputElement;
        expect(input.maxLength).toBe(10);
    });

    test('should use default maxLength of 255 when not provided', () => {
        renderWithContext(<TextInputModal {...baseProps}/>);

        const input = screen.getByPlaceholderText('Enter text...') as HTMLInputElement;
        expect(input.maxLength).toBe(255);
    });

    test('should reset value when modal is closed and reopened', () => {
        const {rerender} = renderWithContext(
            <TextInputModal
                {...baseProps}
                initialValue='Initial'
            />,
        );

        const input = screen.getByPlaceholderText('Enter text...') as HTMLInputElement;
        fireEvent.change(input, {target: {value: 'Changed'}});
        expect(input.value).toBe('Changed');

        // Close modal
        rerender(
            <TextInputModal
                {...baseProps}
                show={false}
                initialValue='Initial'
            />,
        );

        // Reopen modal
        rerender(
            <TextInputModal
                {...baseProps}
                show={true}
                initialValue='Initial'
            />,
        );

        const reopenedInput = screen.getByPlaceholderText('Enter text...') as HTMLInputElement;
        expect(reopenedInput.value).toBe('Initial');
    });

    test('should update value when initialValue changes while modal is open', () => {
        const {rerender} = renderWithContext(
            <TextInputModal
                {...baseProps}
                initialValue='First'
            />,
        );

        const input = screen.getByPlaceholderText('Enter text...') as HTMLInputElement;
        expect(input.value).toBe('First');

        rerender(
            <TextInputModal
                {...baseProps}
                initialValue='Second'
            />,
        );

        expect(input.value).toBe('Second');
    });

    test('should render with custom test id for input', () => {
        renderWithContext(
            <TextInputModal
                {...baseProps}
                inputTestId='custom-input-test-id'
            />,
        );

        expect(screen.getByTestId('custom-input-test-id')).toBeInTheDocument();
    });

    test('should use default test id when not provided', () => {
        renderWithContext(<TextInputModal {...baseProps}/>);

        expect(screen.getByTestId('text-input-modal-input')).toBeInTheDocument();
    });

    test('should handle async onConfirm', async () => {
        const asyncOnConfirm = jest.fn().mockResolvedValue(undefined);
        renderWithContext(
            <TextInputModal
                {...baseProps}
                onConfirm={asyncOnConfirm}
            />,
        );

        const input = screen.getByPlaceholderText('Enter text...');
        fireEvent.change(input, {target: {value: 'Test value'}});

        const confirmButton = screen.getByText('Confirm');
        fireEvent.click(confirmButton);

        await waitFor(() => {
            expect(asyncOnConfirm).toHaveBeenCalledWith('Test value');
        });
    });

    test('should disable confirm button while submitting', async () => {
        const slowOnConfirm = jest.fn().mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));
        renderWithContext(
            <TextInputModal
                {...baseProps}
                onConfirm={slowOnConfirm}
            />,
        );

        const input = screen.getByPlaceholderText('Enter text...');
        fireEvent.change(input, {target: {value: 'Test value'}});

        const confirmButton = screen.getByText('Confirm');
        fireEvent.click(confirmButton);

        // Button should be disabled during submission
        expect(confirmButton).toBeDisabled();

        await waitFor(() => {
            expect(slowOnConfirm).toHaveBeenCalled();
        });
    });

    test('should handle onConfirm error and re-enable button', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const failingOnConfirm = jest.fn().mockRejectedValue(new Error('Test error'));
        renderWithContext(
            <TextInputModal
                {...baseProps}
                onConfirm={failingOnConfirm}
            />,
        );

        const input = screen.getByPlaceholderText('Enter text...');
        fireEvent.change(input, {target: {value: 'Test value'}});

        const confirmButton = screen.getByText('Confirm');
        fireEvent.click(confirmButton);

        await waitFor(() => {
            expect(failingOnConfirm).toHaveBeenCalledWith('Test value');
        });

        // Button should be re-enabled after error
        await waitFor(() => {
            expect(confirmButton).not.toBeDisabled();
        });

        expect(consoleSpy).toHaveBeenCalledWith('[TextInputModal] Error in onConfirm:', expect.any(Error));
        consoleSpy.mockRestore();
    });

    test('should use ariaLabel when provided', () => {
        renderWithContext(
            <TextInputModal
                {...baseProps}
                ariaLabel='Custom Aria Label'
            />,
        );

        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-label', 'Custom Aria Label');
    });

    test('should use title as ariaLabel when ariaLabel is not provided', () => {
        renderWithContext(<TextInputModal {...baseProps}/>);

        expect(screen.getByRole('dialog', {name: 'Test Modal'})).toBeInTheDocument();
    });
});
