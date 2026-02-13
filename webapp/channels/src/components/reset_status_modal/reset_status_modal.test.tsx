// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import ResetStatusModal from 'components/reset_status_modal/reset_status_modal';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

describe('components/ResetStatusModal', () => {
    const autoResetStatus = jest.fn().mockImplementation(
        () => {
            return new Promise((resolve) => {
                process.nextTick(() => resolve({data: {status: 'away', user_id: 'user_id_1', manual: true}}));
            });
        },
    );
    const baseProps = {
        autoResetPref: '',
        actions: {
            autoResetStatus,
            setStatus: jest.fn(),
            savePreferences: jest.fn(),
        },
    };

    test('should match snapshot', async () => {
        const {baseElement} = renderWithContext(
            <ResetStatusModal
                onHide={jest.fn()}
                {...baseProps}
            />,
        );

        // Wait for the modal to appear after autoResetStatus resolves
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        expect(baseElement).toMatchSnapshot();
    });

    test('should have match state when onConfirm is called', async () => {
        const setStatus = jest.fn();
        const savePreferences = jest.fn();
        const props = {
            ...baseProps,
            actions: {
                autoResetStatus,
                setStatus,
                savePreferences,
            },
        };
        renderWithContext(
            <ResetStatusModal
                onHide={jest.fn()}
                {...props}
            />,
        );

        // Wait for the modal to appear
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        // Click confirm button without checkbox
        await userEvent.click(screen.getByRole('button', {name: /Set status to "Online"/i}));

        await waitFor(() => {
            expect(setStatus).toHaveBeenCalledTimes(1);
        });
        expect(setStatus).toHaveBeenCalledWith({
            status: 'online',
            user_id: 'user_id_1',
            manual: true,
        });
        expect(savePreferences).not.toHaveBeenCalled();
    });

    test('should save preferences when onConfirm is called with checkbox checked', async () => {
        const setStatus = jest.fn();
        const savePreferences = jest.fn();
        const props = {
            ...baseProps,
            actions: {
                autoResetStatus,
                setStatus,
                savePreferences,
            },
        };
        renderWithContext(
            <ResetStatusModal
                onHide={jest.fn()}
                {...props}
            />,
        );

        // Wait for the modal to appear
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        // Check the checkbox
        await userEvent.click(screen.getByRole('checkbox', {name: /Do not ask me again/i}));

        // Click status to online
        await userEvent.click(screen.getByRole('button', {name: /Set status to "Online"/i}));

        await waitFor(() => {
            expect(setStatus).toHaveBeenCalledTimes(1);
        });
        expect(savePreferences).toHaveBeenCalledTimes(1);
        expect(savePreferences).toHaveBeenCalledWith(
            'user_id_1',
            [{category: 'auto_reset_manual_status', name: 'user_id_1', user_id: 'user_id_1', value: 'true'}],
        );
    });

    test('should have match state when onCancel is called', async () => {
        const savePreferences = jest.fn();
        const props = {
            ...baseProps,
            actions: {
                autoResetStatus,
                setStatus: jest.fn(),
                savePreferences,
            },
        };
        renderWithContext(
            <ResetStatusModal
                onHide={jest.fn()}
                {...props}
            />,
        );

        // Wait for the modal to appear
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        // Click stay away button
        await userEvent.click(screen.getByRole('button', {name: /Stay as "Away"/i}));

        // Modal should be hidden
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
        expect(savePreferences).not.toHaveBeenCalled();
    });

    test('should save preferences when onCancel is called with checkbox checked', async () => {
        const savePreferences = jest.fn();
        const props = {
            ...baseProps,
            actions: {
                autoResetStatus,
                setStatus: jest.fn(),
                savePreferences,
            },
        };
        renderWithContext(
            <ResetStatusModal
                onHide={jest.fn()}
                {...props}
            />,
        );

        // Wait for the modal to appear
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        // Check the checkbox
        await userEvent.click(screen.getByRole('checkbox', {name: /Do not ask me again/i}));

        // Click stay away button
        await userEvent.click(screen.getByRole('button', {name: /Stay as "Away"/i}));

        await waitFor(() => {
            expect(savePreferences).toHaveBeenCalledTimes(1);
        });
        expect(savePreferences).toHaveBeenCalledWith(
            'user_id_1',
            [{category: 'auto_reset_manual_status', name: 'user_id_1', user_id: 'user_id_1', value: 'false'}],
        );
    });

    test('should match snapshot, render modal for OOF status', async () => {
        const autoResetStatusOOF = jest.fn().mockResolvedValue({
            data: {status: 'ooo', user_id: 'user_id_1', manual: true},
        });
        const props = {
            ...baseProps,
            currentUserStatus: 'ooo',
            actions: {
                ...baseProps.actions,
                autoResetStatus: autoResetStatusOOF,
            },
        };
        const {baseElement} = renderWithContext(
            <ResetStatusModal
                onHide={jest.fn()}
                {...props}
            />,
        );

        // Wait for the modal to appear
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        expect(baseElement).toMatchSnapshot();
    });
});
