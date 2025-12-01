// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import ResetStatusModal from 'components/reset_status_modal/reset_status_modal';

import {renderWithContext, screen, fireEvent, waitFor} from 'tests/vitest_react_testing_utils';

describe('components/ResetStatusModal', () => {
    const autoResetStatus = vi.fn().mockImplementation(
        () => {
            return new Promise((resolve) => {
                process.nextTick(() => resolve({data: {status: 'away'}}));
            });
        },
    );
    const baseProps = {
        autoResetPref: '',
        actions: {
            autoResetStatus,
            setStatus: vi.fn(),
            savePreferences: vi.fn(),
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <ResetStatusModal
                onHide={vi.fn()}
                {...baseProps}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should have match state when onConfirm is called', async () => {
        const newSetStatus = vi.fn();
        const newSavePreferences = vi.fn();

        // Mock autoResetStatus to return a manual status so modal becomes visible
        const autoResetStatusMock = vi.fn().mockResolvedValue({
            data: {
                status: 'away',
                user_id: 'user_id_1',
                manual: true,
            },
        });

        const props = {
            ...baseProps,
            autoResetPref: '', // Empty pref + manual status = show modal
            actions: {
                autoResetStatus: autoResetStatusMock,
                setStatus: newSetStatus,
                savePreferences: newSavePreferences,
            },
        };

        const {unmount} = renderWithContext(
            <ResetStatusModal
                onHide={vi.fn()}
                {...props}
            />,
        );

        // Wait for the modal to appear after autoResetStatus resolves
        await waitFor(() => {
            expect(screen.getByText('Set status to "Online"')).toBeInTheDocument();
        });

        // Click confirm button without checkbox - savePreferences should NOT be called
        fireEvent.click(screen.getByText('Set status to "Online"'));

        expect(newSetStatus).toHaveBeenCalledTimes(1);
        expect(newSetStatus).toHaveBeenCalledWith({
            status: 'online',
            user_id: 'user_id_1',
            manual: true,
        });

        // savePreferences is NOT called when checkbox is unchecked
        expect(newSavePreferences).not.toHaveBeenCalled();

        // Clean up first modal
        unmount();

        // Reset mocks for second test
        newSetStatus.mockClear();
        newSavePreferences.mockClear();

        // Re-render to test with checkbox checked
        const {unmount: unmount2} = renderWithContext(
            <ResetStatusModal
                onHide={vi.fn()}
                {...props}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('Set status to "Online"')).toBeInTheDocument();
        });

        // Check the "Do not ask me again" checkbox
        const checkbox = screen.getByRole('checkbox');
        fireEvent.click(checkbox);

        // Click confirm button with checkbox checked - savePreferences SHOULD be called
        fireEvent.click(screen.getByText('Set status to "Online"'));

        expect(newSetStatus).toHaveBeenCalledTimes(1);

        // savePreferences IS called when checkbox is checked, with value: 'true'
        expect(newSavePreferences).toHaveBeenCalledTimes(1);
        expect(newSavePreferences).toHaveBeenCalledWith(
            'user_id_1',
            [{category: 'auto_reset_manual_status', name: 'user_id_1', user_id: 'user_id_1', value: 'true'}],
        );

        unmount2();
    });

    test('should have match state when onCancel is called', async () => {
        const newSavePreferences = vi.fn();

        // Mock autoResetStatus to return a manual status so modal becomes visible
        const autoResetStatusMock = vi.fn().mockResolvedValue({
            data: {
                status: 'away',
                user_id: 'user_id_1',
                manual: true,
            },
        });

        const props = {
            ...baseProps,
            autoResetPref: '',
            actions: {
                autoResetStatus: autoResetStatusMock,
                setStatus: vi.fn(),
                savePreferences: newSavePreferences,
            },
        };

        const {unmount} = renderWithContext(
            <ResetStatusModal
                onHide={vi.fn()}
                {...props}
            />,
        );

        // Wait for the modal to appear
        await waitFor(() => {
            expect(screen.getByText('Stay as "Away"')).toBeInTheDocument();
        });

        // Click cancel button without checkbox - savePreferences should NOT be called
        fireEvent.click(screen.getByText('Stay as "Away"'));

        // savePreferences is NOT called when checkbox is unchecked
        expect(newSavePreferences).not.toHaveBeenCalled();

        // Clean up first modal
        unmount();

        // Reset mock for second test
        newSavePreferences.mockClear();

        // Re-render to test with checkbox checked
        const {unmount: unmount2} = renderWithContext(
            <ResetStatusModal
                onHide={vi.fn()}
                {...props}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('Stay as "Away"')).toBeInTheDocument();
        });

        // Check the "Do not ask me again" checkbox
        const checkbox = screen.getByRole('checkbox');
        fireEvent.click(checkbox);

        // Click cancel button with checkbox checked - savePreferences SHOULD be called
        fireEvent.click(screen.getByText('Stay as "Away"'));

        // savePreferences IS called when checkbox is checked, with value: 'false'
        expect(newSavePreferences).toHaveBeenCalledTimes(1);
        expect(newSavePreferences).toHaveBeenCalledWith(
            'user_id_1',
            [{category: 'auto_reset_manual_status', name: 'user_id_1', user_id: 'user_id_1', value: 'false'}],
        );

        unmount2();
    });

    test('should match snapshot, render modal for OOF status', () => {
        const props = {...baseProps, currentUserStatus: 'ooo'};
        const {container} = renderWithContext(
            <ResetStatusModal
                onHide={vi.fn()}
                {...props}
            />,
        );

        expect(container).toMatchSnapshot();
    });
});
