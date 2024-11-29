// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {renderWithIntl} from 'tests/react_testing_utils';
import ResetStatusModal from 'components/reset_status_modal/reset_status_modal';

describe('components/ResetStatusModal', () => {
    const autoResetStatus = jest.fn().mockImplementation(
        () => {
            return new Promise((resolve) => {
                process.nextTick(() => resolve({
                    data: {
                        status: 'away',
                        user_id: 'user_id_1',
                        manual: true
                    },
                }));
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

    test('should render modal correctly', async () => {
        renderWithIntl(
            <ResetStatusModal
                onHide={jest.fn()}
                {...baseProps}
            />,
        );

        // Wait for modal to appear after autoResetStatus resolves
        const title = await screen.findByText(/Your status is set to "Away"/i);
        expect(title).toBeInTheDocument();
        
        expect(await screen.findByText('Would you like to switch your status to "Online"?')).toBeInTheDocument();
        expect(screen.getByText('Set status to "Online"')).toBeInTheDocument();
        expect(screen.getByText('Stay as "Away"')).toBeInTheDocument();
        expect(screen.getByText('Do not ask me again')).toBeInTheDocument();
    });

    test('should handle confirm action correctly', async () => {
        const newSetStatus = jest.fn();
        const newSavePreferences = jest.fn();
        const props = {
            ...baseProps,
            actions: {
                autoResetStatus,
                setStatus: newSetStatus,
                savePreferences: newSavePreferences,
            },
        };

        renderWithIntl(
            <ResetStatusModal
                onHide={jest.fn()}
                {...props}
            />,
        );

        // Wait for modal to appear
        const title = await screen.findByText(/Your status is set to "Away"/i);
        expect(title).toBeInTheDocument();

        // Test without checkbox
        await userEvent.click(screen.getByText('Set status to "Online"'));
        expect(newSetStatus).toHaveBeenCalledWith({
            status: 'online',
            user_id: 'user_id_1',
        });
        expect(newSavePreferences).not.toHaveBeenCalled();

        // Test with checkbox
        await userEvent.click(screen.getByText('Do not ask me again'));
        await userEvent.click(screen.getByText('Set status to "Online"'));
        expect(newSetStatus).toHaveBeenCalledTimes(2);
        expect(newSavePreferences).toHaveBeenCalledWith(
            'user_id_1',
            [{category: 'auto_reset_manual_status', name: 'user_id_1', user_id: 'user_id_1', value: 'true'}],
        );
    });

    test('should handle cancel action correctly', async () => {
        const newSavePreferences = jest.fn();
        const props = {
            ...baseProps,
            actions: {
                autoResetStatus,
                setStatus: jest.fn(),
                savePreferences: newSavePreferences,
            },
        };

        renderWithIntl(
            <ResetStatusModal
                onHide={jest.fn()}
                {...props}
            />,
        );

        // Wait for modal to appear
        const title = await screen.findByText(/Your status is set to "Away"/i);
        expect(title).toBeInTheDocument();

        // Test without checkbox
        await userEvent.click(screen.getByText('Stay as "Away"'));
        expect(newSavePreferences).not.toHaveBeenCalled();

        // Test with checkbox
        await userEvent.click(screen.getByText('Do not ask me again'));
        await userEvent.click(screen.getByText('Stay as "Away"'));
        expect(newSavePreferences).toHaveBeenCalledWith(
            'user_id_1',
            [{category: 'auto_reset_manual_status', name: 'user_id_1', user_id: 'user_id_1', value: 'false'}],
        );
    });

    test('should render modal for OOF status correctly', async () => {
        const props = {...baseProps, currentUserStatus: 'ooo'};
        
        renderWithIntl(
            <ResetStatusModal
                onHide={jest.fn()}
                {...props}
            />,
        );

        // Wait for modal to appear
        const title = await screen.findByText(/Your status is set to "Out of office"/i);
        expect(title).toBeInTheDocument();
        expect(await screen.findByText('Would you like to switch your status to "Online" and disable automatic replies?')).toBeInTheDocument();
        expect(screen.getByText('Set status to "Online"')).toBeInTheDocument();
        expect(screen.getByText('Stay "Out of office"')).toBeInTheDocument();
    });
});
