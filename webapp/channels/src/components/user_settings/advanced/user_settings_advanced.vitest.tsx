// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/vitest_react_testing_utils';
import {Preferences} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import AdvancedSettingsDisplay from './user_settings_advanced';

vi.mock('actions/global_actions');

const mockIsMac = vi.fn();
vi.mock('utils/user_agent', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual as object,
        isMac: () => mockIsMac(),
    };
});

describe('components/user_settings/display/UserSettingsDisplay', () => {
    const user = TestHelper.getUserMock({
        id: 'user_id',
        username: 'username',
        locale: 'en',
        timezone: {
            useAutomaticTimezone: 'true',
            automaticTimezone: 'America/New_York',
            manualTimezone: '',
        },
    });

    const requiredProps: ComponentProps<typeof AdvancedSettingsDisplay> = {
        user,
        updateSection: vi.fn(),
        activeSection: '',
        closeModal: vi.fn(),
        collapseModal: vi.fn(),
        actions: {
            savePreferences: vi.fn().mockResolvedValue({data: true}),
            updateUserActive: vi.fn().mockResolvedValue({data: true}),
            revokeAllSessionsForUser: vi.fn().mockResolvedValue({data: true}),
        },
        advancedSettingsCategory: [],
        sendOnCtrlEnter: '',
        formatting: '',
        joinLeave: '',
        syncDrafts: '',
        unreadScrollPosition: Preferences.UNREAD_SCROLL_POSITION_START_FROM_LEFT,
        codeBlockOnCtrlEnter: 'false',
        enableUserDeactivation: false,
        syncedDraftsAreAllowed: true,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('function getCtrlSendText should return correct value for Mac', () => {
        mockIsMac.mockReturnValue(true);

        renderWithContext(
            <AdvancedSettingsDisplay
                {...requiredProps}
                activeSection='advancedCtrlSend'
            />,
        );

        expect(screen.getAllByText('Send Messages on ⌘+ENTER').length).toBeGreaterThan(0);
    });

    test('function getCtrlSendText should return correct value for Windows', () => {
        mockIsMac.mockReturnValue(false);

        renderWithContext(
            <AdvancedSettingsDisplay
                {...requiredProps}
                activeSection='advancedCtrlSend'
            />,
        );

        expect(screen.getAllByText('Send Messages on CTRL+ENTER').length).toBeGreaterThan(0);
    });

    test('should have called handleSubmit', async () => {
        const updateSection = vi.fn();

        renderWithContext(
            <AdvancedSettingsDisplay
                {...requiredProps}
                updateSection={updateSection}
                activeSection='advancedCtrlSend'
            />,
        );

        const saveButton = screen.getByRole('button', {name: /save/i});
        await userEvent.click(saveButton);

        await waitFor(() => {
            expect(updateSection).toHaveBeenCalledWith('');
        });
    });

    test('should have called updateUserActive', async () => {
        const updateUserActive = vi.fn(() => Promise.resolve({data: true as const}));
        const revokeAllSessionsForUser = vi.fn(() => Promise.resolve({data: true as const}));

        renderWithContext(
            <AdvancedSettingsDisplay
                {...requiredProps}
                enableUserDeactivation={true}
                activeSection='deactivateAccount'
                actions={{
                    ...requiredProps.actions,
                    updateUserActive,
                    revokeAllSessionsForUser,
                }}
            />,
        );

        // Find and click deactivate button
        const deactivateButton = screen.getByRole('button', {name: /deactivate/i});
        await userEvent.click(deactivateButton);

        // Confirm in modal
        const confirmButton = await screen.findByRole('button', {name: /deactivate/i});
        await userEvent.click(confirmButton);

        await waitFor(() => {
            expect(revokeAllSessionsForUser).toHaveBeenCalledWith(user.id);
            expect(updateUserActive).toHaveBeenCalledWith(user.id, false);
        });
    });

    test('should have called updateSection', async () => {
        const updateSection = vi.fn();

        renderWithContext(
            <AdvancedSettingsDisplay
                {...requiredProps}
                updateSection={updateSection}
                activeSection='advancedCtrlSend'
            />,
        );

        const cancelButton = screen.getByRole('button', {name: /cancel/i});
        await userEvent.click(cancelButton);

        expect(updateSection).toHaveBeenCalled();
    });

    test('handleDeactivateAccountSubmit() should have called revokeAllSessions', async () => {
        const revokeAllSessionsForUser = vi.fn(() => Promise.resolve({data: true as const}));
        const updateUserActive = vi.fn(() => Promise.resolve({data: true as const}));

        renderWithContext(
            <AdvancedSettingsDisplay
                {...requiredProps}
                enableUserDeactivation={true}
                activeSection='deactivateAccount'
                actions={{
                    ...requiredProps.actions,
                    revokeAllSessionsForUser,
                    updateUserActive,
                }}
            />,
        );

        // Find and click deactivate button
        const deactivateButton = screen.getByRole('button', {name: /deactivate/i});
        await userEvent.click(deactivateButton);

        // Confirm in modal
        const confirmButton = await screen.findByRole('button', {name: /deactivate/i});
        await userEvent.click(confirmButton);

        await waitFor(() => {
            expect(revokeAllSessionsForUser).toHaveBeenCalledWith(user.id);
        });
    });

    test('handleDeactivateAccountSubmit() should have updated state.serverError', async () => {
        const errorMessage = 'error';
        const revokeAllSessionsForUser = vi.fn(() => Promise.resolve({error: {message: errorMessage}}));

        renderWithContext(
            <AdvancedSettingsDisplay
                {...requiredProps}
                enableUserDeactivation={true}
                activeSection='deactivateAccount'
                actions={{
                    ...requiredProps.actions,
                    revokeAllSessionsForUser,
                }}
            />,
        );

        // Find and click deactivate button
        const deactivateButton = screen.getByRole('button', {name: /deactivate/i});
        await userEvent.click(deactivateButton);

        // Confirm in modal
        const confirmButton = await screen.findByRole('button', {name: /deactivate/i});
        await userEvent.click(confirmButton);

        await waitFor(() => {
            expect(screen.getByText(errorMessage)).toBeInTheDocument();
        });
    });
});
