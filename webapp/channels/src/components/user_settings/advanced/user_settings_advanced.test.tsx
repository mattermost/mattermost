// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import {isMac} from '@mattermost/shared/utils/user_agent';

import AdvancedSettingsDisplay from 'components/user_settings/advanced/user_settings_advanced';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {Preferences} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

jest.mock('actions/global_actions');

const isMacMock = jest.mocked(isMac);
jest.mock('@mattermost/shared/utils/user_agent', () => ({
    isDesktopApp: jest.fn(() => false),
    isMac: jest.fn(() => false),
}));

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
        updateSection: jest.fn(),
        activeSection: '',
        closeModal: jest.fn(),
        collapseModal: jest.fn(),
        actions: {
            savePreferences: jest.fn(),
            updateUserActive: jest.fn().mockResolvedValue({data: true}),
            revokeAllSessionsForUser: jest.fn().mockResolvedValue({data: true}),
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

    test('should have called handleSubmit', async () => {
        const updateSection = jest.fn();

        const props = {...requiredProps, updateSection, activeSection: 'formatting'};
        renderWithContext(<AdvancedSettingsDisplay {...props}/>);

        await userEvent.click(screen.getByTestId('saveSetting'));
        expect(updateSection).toHaveBeenCalledWith('');
    });

    test('should have called updateSection', async () => {
        const updateSection = jest.fn();
        const props = {...requiredProps, updateSection, activeSection: 'formatting'};
        renderWithContext(<AdvancedSettingsDisplay {...props}/>);

        // Click Save → handleSubmit → handleUpdateSection('') → updateSection('')
        await userEvent.click(screen.getByTestId('saveSetting'));
        expect(updateSection).toHaveBeenCalledWith('');
    });

    test('should have called updateUserActive', async () => {
        const updateUserActive = jest.fn(() => Promise.resolve({}));
        const revokeAllSessionsForUser = jest.fn().mockResolvedValue({data: true});
        const props = {
            ...requiredProps,
            enableUserDeactivation: true,
            activeSection: 'deactivateAccount',
            actions: {...requiredProps.actions, updateUserActive, revokeAllSessionsForUser},
        };
        renderWithContext(<AdvancedSettingsDisplay {...props}/>);

        // Click "Deactivate" button in SettingItemMax to show the modal
        await userEvent.click(screen.getByText('Deactivate'));

        // Click the confirm button in the modal
        await userEvent.click(screen.getByText('Yes, deactivate my account'));

        expect(updateUserActive).toHaveBeenCalled();
        expect(updateUserActive).toHaveBeenCalledWith(requiredProps.user.id, false);
    });

    test('handleDeactivateAccountSubmit() should have called revokeAllSessions', async () => {
        const revokeAllSessionsForUser = jest.fn().mockResolvedValue({data: true});
        const props = {
            ...requiredProps,
            enableUserDeactivation: true,
            activeSection: 'deactivateAccount',
            actions: {...requiredProps.actions, revokeAllSessionsForUser},
        };
        renderWithContext(<AdvancedSettingsDisplay {...props}/>);

        // Click "Deactivate" button then confirm
        await userEvent.click(screen.getByText('Deactivate'));
        await userEvent.click(screen.getByText('Yes, deactivate my account'));

        expect(revokeAllSessionsForUser).toHaveBeenCalled();
        expect(revokeAllSessionsForUser).toHaveBeenCalledWith(requiredProps.user.id);
    });

    test('handleDeactivateAccountSubmit() should have updated state.serverError', async () => {
        const error = {message: 'error'};
        const revokeAllSessionsForUser = jest.fn(() => Promise.resolve({error}));
        const props = {
            ...requiredProps,
            enableUserDeactivation: true,
            activeSection: 'deactivateAccount',
            actions: {...requiredProps.actions, revokeAllSessionsForUser},
        };
        renderWithContext(<AdvancedSettingsDisplay {...props}/>);

        // Click "Deactivate" button then confirm
        await userEvent.click(screen.getByText('Deactivate'));
        await userEvent.click(screen.getByText('Yes, deactivate my account'));

        expect(await screen.findByText(error.message)).toBeInTheDocument();
    });

    test('function getCtrlSendText should return correct value for Mac', () => {
        isMacMock.mockReturnValue(true);
        const props = {...requiredProps};

        renderWithContext(<AdvancedSettingsDisplay {...props}/>);
        expect(screen.getByText('Send Messages on ⌘+ENTER')).toBeInTheDocument();
    });

    test('function getCtrlSendText should return correct value for Windows', () => {
        isMacMock.mockReturnValue(false);
        const props = {...requiredProps};

        renderWithContext(<AdvancedSettingsDisplay {...props}/>);
        expect(screen.getByText('Send Messages on CTRL+ENTER')).toBeInTheDocument();
    });
});
