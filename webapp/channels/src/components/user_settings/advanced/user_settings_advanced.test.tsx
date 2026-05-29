// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import {isMac} from '@mattermost/shared/utils/user_agent';

import AdvancedSettingsDisplay from 'components/user_settings/advanced/user_settings_advanced';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {renderWithUserSettingsState} from 'tests/user_settings';
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
        renderWithUserSettingsState(AdvancedSettingsDisplay, requiredProps);

        await userEvent.click(screen.getByRole('button', {name: 'Enable Post Formatting Edit'}));

        await userEvent.click(screen.getByTestId('saveSetting'));

        expect(requiredProps.actions.savePreferences).toHaveBeenCalled();
        expect(screen.queryByTestId('saveSetting')).not.toBeInTheDocument();
    });

    test('should deactivate user and revoke session', async () => {
        const props = {
            ...requiredProps,
            enableUserDeactivation: true,
        };
        renderWithUserSettingsState(AdvancedSettingsDisplay, props);

        await userEvent.click(screen.getByRole('button', {name: 'Deactivate Account Edit'}));

        // Click "Deactivate" button in SettingItemMax to show the modal
        await userEvent.click(screen.getByText('Deactivate'));

        // Click the confirm button in the modal
        await userEvent.click(screen.getByText('Yes, deactivate my account'));

        expect(props.actions.updateUserActive).toHaveBeenCalled();
        expect(props.actions.updateUserActive).toHaveBeenCalledWith(requiredProps.user.id, false);

        expect(props.actions.revokeAllSessionsForUser).toHaveBeenCalled();
        expect(props.actions.revokeAllSessionsForUser).toHaveBeenCalledWith(requiredProps.user.id);
    });

    test('handleDeactivateAccountSubmit() should have updated state.serverError', async () => {
        const error = {message: 'error'};
        const revokeAllSessionsForUser = jest.fn(() => Promise.resolve({error}));
        const props = {
            ...requiredProps,
            enableUserDeactivation: true,
            actions: {...requiredProps.actions, revokeAllSessionsForUser},
        };
        renderWithUserSettingsState(AdvancedSettingsDisplay, props);

        await userEvent.click(screen.getByRole('button', {name: 'Deactivate Account Edit'}));

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
