// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen, waitFor} from '@testing-library/react';
import React from 'react';

import {GenericModal} from './generic_modal';

import {wrapIntl} from '../testUtils';

describe('GenericModal', () => {
    const baseProps = {
        onExited: jest.fn(),
        modalHeaderText: 'Modal Header Text',
        children: <></>,
    };

    test('should match snapshot for base case', () => {
        const wrapper = render(
            wrapIntl(<GenericModal {...baseProps}/>),
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should have confirm and cancels buttons when handlers are passed for both buttons', () => {
        const props = {
            ...baseProps,
            handleConfirm: jest.fn(),
            handleCancel: jest.fn(),
        };

        render(
            wrapIntl(<GenericModal {...props}/>),
        );

        expect(screen.getByText('Confirm')).toBeInTheDocument();
        expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    test('calls onExited when modal exits', async () => {
        const onExitedMock = jest.fn();
        const props = {
            ...baseProps,
            onExited: onExitedMock,
        };
        render(
            wrapIntl(<GenericModal {...props}/>),
        );

        // Find and click the close button to trigger modal exit
        const closeButton = screen.getByLabelText('Close');
        closeButton.click();

        // Wait for onExited to be called
        await waitFor(() => {
            expect(onExitedMock).toHaveBeenCalled();
        });
    });

    test('does not throw if onExited is undefined', async () => {
        // Create props without onExited
        const {onExited, ...propsWithoutOnExited} = baseProps; // eslint-disable-line @typescript-eslint/no-unused-vars
        const props = {
            ...propsWithoutOnExited,
            onHide: jest.fn(), // Ensure onHide is provided since it's mandatory
        };

        // This should not throw
        render(
            wrapIntl(<GenericModal {...props}/>),
        );

        // Find and click the close button to trigger modal exit
        const closeButton = screen.getByLabelText('Close');

        // This should not throw
        expect(() => {
            closeButton.click();
        }).not.toThrow();
    });

    test('calls onEntered when modal enters', async () => {
        const onEnteredMock = jest.fn();
        const props = {
            ...baseProps,
            onEntered: onEnteredMock,
            show: false, // Start with modal hidden
        };

        const {rerender} = render(
            wrapIntl(<GenericModal {...props}/>),
        );

        // Show the modal
        rerender(
            wrapIntl(<GenericModal {...props} show={true}/>),
        );

        // Wait for onEntered to be called
        await waitFor(() => {
            expect(onEnteredMock).toHaveBeenCalled();
        });
    });

    test('does not throw if onEntered is undefined', async () => {
        // Create props without onEntered
        const props = {
            ...baseProps,
            show: false, // Start with modal hidden
        };

        const {rerender} = render(
            wrapIntl(<GenericModal {...props}/>),
        );

        // This should not throw
        expect(() => {
            rerender(
                wrapIntl(<GenericModal {...props} show={true}/>),
            );
        }).not.toThrow();
    });

    test('calls onHide when modal is closed', async () => {
        const onHideMock = jest.fn();
        const props = {
            ...baseProps,
            onHide: onHideMock,
        };
        render(
            wrapIntl(<GenericModal {...props}/>),
        );

        // Find and click the close button to trigger modal exit
        const closeButton = screen.getByLabelText('Close');
        closeButton.click();

        // Wait for onHide to be called
        await waitFor(() => {
            expect(onHideMock).toHaveBeenCalled();
        });
    });

    describe('preventClose functionality', () => {
        test('preventClose=true prevents modal from closing when close button is clicked', async () => {
            const onHideMock = jest.fn();
            const onExitedMock = jest.fn();
            const props = {
                ...baseProps,
                onHide: onHideMock,
                onExited: onExitedMock,
                preventClose: true,
                show: true,
            };

            render(
                wrapIntl(<GenericModal {...props}/>),
            );

            const modal = screen.getByRole('dialog');
            expect(modal).toBeInTheDocument();
            expect(modal).toHaveClass('in'); // Modal is visible

            // Find and click the close button
            const closeButton = screen.getByLabelText('Close');
            closeButton.click();

            // onHide should still be called (for error handling, etc.)
            await waitFor(() => {
                expect(onHideMock).toHaveBeenCalled();
            });

            // But modal should still be visible (preventClose prevents internal state change)
            expect(modal).toBeInTheDocument();
            expect(modal).toHaveClass('in'); // Still visible

            // onExited should NOT be called since modal didn't actually close
            expect(onExitedMock).not.toHaveBeenCalled();
        });

        test('preventClose=true prevents modal from closing when cancel button is clicked', async () => {
            const onHideMock = jest.fn();
            const handleCancelMock = jest.fn();
            const props = {
                ...baseProps,
                onHide: onHideMock,
                handleCancel: handleCancelMock,
                preventClose: true,
                show: true,
                autoCloseOnCancelButton: true, // Default behavior
            };

            render(
                wrapIntl(<GenericModal {...props}/>),
            );

            const modal = screen.getByRole('dialog');
            expect(modal).toHaveClass('in');

            // Find and click the cancel button
            const cancelButton = screen.getByText('Cancel');
            cancelButton.click();

            // Both callbacks should be called
            await waitFor(() => {
                expect(handleCancelMock).toHaveBeenCalled();
                expect(onHideMock).toHaveBeenCalled();
            });

            // But modal should still be visible due to preventClose
            expect(modal).toHaveClass('in');
        });

        test('preventClose=true prevents modal from closing when confirm button is clicked', async () => {
            const onHideMock = jest.fn();
            const handleConfirmMock = jest.fn();
            const props = {
                ...baseProps,
                onHide: onHideMock,
                handleConfirm: handleConfirmMock,
                preventClose: true,
                show: true,
                autoCloseOnConfirmButton: true, // Default behavior
            };

            render(
                wrapIntl(<GenericModal {...props}/>),
            );

            const modal = screen.getByRole('dialog');
            expect(modal).toHaveClass('in');

            // Find and click the confirm button
            const confirmButton = screen.getByText('Confirm');
            confirmButton.click();

            // Both callbacks should be called
            await waitFor(() => {
                expect(handleConfirmMock).toHaveBeenCalled();
                expect(onHideMock).toHaveBeenCalled();
            });

            // But modal should still be visible due to preventClose
            expect(modal).toHaveClass('in');
        });

        test('preventClose=false allows normal modal closing via close button', async () => {
            const onHideMock = jest.fn();
            const onExitedMock = jest.fn();
            const props = {
                ...baseProps,
                onHide: onHideMock,
                onExited: onExitedMock,
                preventClose: false,
                show: true,
            };

            render(
                wrapIntl(<GenericModal {...props}/>),
            );

            const modal = screen.getByRole('dialog');
            expect(modal).toHaveClass('in');

            // Find and click the close button
            const closeButton = screen.getByLabelText('Close');
            closeButton.click();

            // onHide should be called
            await waitFor(() => {
                expect(onHideMock).toHaveBeenCalled();
            });

            // Modal should close (lose 'in' class)
            await waitFor(() => {
                expect(modal).not.toHaveClass('in');
            });
        });

        test('preventClose=false allows normal modal closing via cancel button', async () => {
            const onHideMock = jest.fn();
            const handleCancelMock = jest.fn();
            const props = {
                ...baseProps,
                onHide: onHideMock,
                handleCancel: handleCancelMock,
                preventClose: false,
                show: true,
            };

            render(
                wrapIntl(<GenericModal {...props}/>),
            );

            const modal = screen.getByRole('dialog');
            expect(modal).toHaveClass('in');

            // Find and click the cancel button
            const cancelButton = screen.getByText('Cancel');
            cancelButton.click();

            // Both callbacks should be called
            await waitFor(() => {
                expect(handleCancelMock).toHaveBeenCalled();
                expect(onHideMock).toHaveBeenCalled();
            });

            // Modal should close normally
            await waitFor(() => {
                expect(modal).not.toHaveClass('in');
            });
        });

        test('preventClose state can be toggled dynamically', async () => {
            const onHideMock = jest.fn();
            const props = {
                ...baseProps,
                onHide: onHideMock,
                preventClose: true,
                show: true,
            };

            const {rerender} = render(
                wrapIntl(<GenericModal {...props}/>),
            );

            const modal = screen.getByRole('dialog');
            const closeButton = screen.getByLabelText('Close');

            // First click - should be prevented
            closeButton.click();
            await waitFor(() => {
                expect(onHideMock).toHaveBeenCalledTimes(1);
            });
            expect(modal).toHaveClass('in'); // Still visible

            // Change preventClose to false
            rerender(
                wrapIntl(<GenericModal {...props} preventClose={false}/>),
            );

            // Second click - should close modal
            closeButton.click();
            await waitFor(() => {
                expect(onHideMock).toHaveBeenCalledTimes(2);
            });

            // Modal should close now
            await waitFor(() => {
                expect(modal).not.toHaveClass('in');
            });
        });
    });
});
