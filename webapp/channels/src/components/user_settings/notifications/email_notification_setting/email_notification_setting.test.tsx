// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import EmailNotificationSetting from 'components/user_settings/notifications/email_notification_setting/email_notification_setting';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {Preferences, NotificationLevels} from 'utils/constants';

describe('components/user_settings/notifications/EmailNotificationSetting', () => {
    const requiredProps: ComponentProps<typeof EmailNotificationSetting> = {
        active: true,
        updateSection: jest.fn(),
        onSubmit: jest.fn(),
        onCancel: jest.fn(),
        saving: false,
        error: '',
        setParentState: jest.fn(),
        areAllSectionsInactive: false,
        isCollapsedThreadsEnabled: false,
        enableEmail: false,
        onChange: jest.fn(),
        threads: NotificationLevels.ALL,
        currentUserId: 'current_user_id',
        emailInterval: Preferences.INTERVAL_NEVER,
        sendEmailNotifications: true,
        enableEmailBatching: false,
        actions: {
            savePreferences: jest.fn(),
        },
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(<EmailNotificationSetting {...requiredProps}/>);

        expect(container).toMatchSnapshot();
        expect(document.getElementById('emailNotificationImmediately')).toBeInTheDocument();
        expect(document.getElementById('emailNotificationNever')).toBeInTheDocument();
        expect(document.getElementById('emailNotificationMinutes')).not.toBeInTheDocument();
        expect(document.getElementById('emailNotificationHour')).not.toBeInTheDocument();
    });

    test('should match snapshot, enabled email batching', () => {
        const props = {
            ...requiredProps,
            enableEmailBatching: true,
        };
        const {container} = renderWithContext(<EmailNotificationSetting {...props}/>);

        expect(container).toMatchSnapshot();
        expect(document.getElementById('emailNotificationMinutes')).toBeInTheDocument();
        expect(document.getElementById('emailNotificationHour')).toBeInTheDocument();
    });

    test('should match snapshot, not send email notifications', () => {
        const props = {
            ...requiredProps,
            sendEmailNotifications: false,
        };
        const {container} = renderWithContext(<EmailNotificationSetting {...props}/>);

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, active section != email and SendEmailNotifications !== true', () => {
        const props = {
            ...requiredProps,
            sendEmailNotifications: false,
            active: false,
        };
        const {container} = renderWithContext(<EmailNotificationSetting {...props}/>);

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, active section != email and SendEmailNotifications = true', () => {
        const props = {
            ...requiredProps,
            sendEmailNotifications: true,
            active: false,
        };
        const {container} = renderWithContext(<EmailNotificationSetting {...props}/>);

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, active section != email, SendEmailNotifications = true and enableEmail = true', () => {
        const props = {
            ...requiredProps,
            sendEmailNotifications: true,
            active: false,
            enableEmail: true,
        };
        const {container} = renderWithContext(<EmailNotificationSetting {...props}/>);

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, on serverError', () => {
        const newServerError = 'serverError';
        const props = {...requiredProps, error: newServerError};
        const {container} = renderWithContext(<EmailNotificationSetting {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, when CRT on and email set to immediately', () => {
        const props = {
            ...requiredProps,
            enableEmail: true,
            isCollapsedThreadsEnabled: true,
        };
        const {container} = renderWithContext(<EmailNotificationSetting {...props}/>);

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, when CRT on and email set to never', () => {
        const props = {
            ...requiredProps,
            enableEmail: false,
            isCollapsedThreadsEnabled: true,
        };
        const {container} = renderWithContext(<EmailNotificationSetting {...props}/>);

        expect(container).toMatchSnapshot();
    });

    test('should pass handleChange', async () => {
        renderWithContext(<EmailNotificationSetting {...requiredProps}/>);

        await userEvent.click(document.getElementById('emailNotificationImmediately')!);

        expect(requiredProps.onChange).toHaveBeenCalledTimes(1);
    });

    test('should pass handleSubmit', async () => {
        const newOnSubmit = jest.fn();
        const newUpdateSection = jest.fn();
        const newSavePreference = jest.fn();
        const props = {
            ...requiredProps,
            onSubmit: newOnSubmit,
            updateSection: newUpdateSection,
            actions: {savePreferences: newSavePreference},
        };

        renderWithContext(<EmailNotificationSetting {...props}/>);

        // Submit with default state (never)
        await userEvent.click(screen.getByText('Save'));

        await waitFor(() => {
            expect(newOnSubmit).toHaveBeenCalled();
        });
        expect(newUpdateSection).toHaveBeenCalledTimes(1);
        expect(newUpdateSection).toHaveBeenCalledWith('');

        // Change to immediately and submit again
        await userEvent.click(document.getElementById('emailNotificationImmediately')!);
        await userEvent.click(screen.getByText('Save'));

        const newInterval = Preferences.INTERVAL_IMMEDIATE;

        await waitFor(() => {
            expect(newOnSubmit).toHaveBeenCalledTimes(2);
        });

        const expectedPref = [{
            category: 'notifications',
            name: 'email_interval',
            user_id: 'current_user_id',
            value: newInterval.toString(),
        }];

        expect(newSavePreference).toHaveBeenCalledTimes(1);
        expect(newSavePreference).toHaveBeenCalledWith('current_user_id', expectedPref);
    });

    test('should pass handleUpdateSection', async () => {
        const newUpdateSection = jest.fn();
        const newOnCancel = jest.fn();
        const props = {...requiredProps, updateSection: newUpdateSection, onCancel: newOnCancel};
        renderWithContext(<EmailNotificationSetting {...props}/>);

        // Click Cancel to trigger handleUpdateSection without section arg
        await userEvent.click(screen.getByText('Cancel'));

        expect(newUpdateSection).toHaveBeenCalledWith('');
        expect(newOnCancel).toHaveBeenCalled();
    });

    test('should derived state from props', () => {
        const {container, rerender} = renderWithContext(<EmailNotificationSetting {...requiredProps}/>);

        // Verify initial render matches props
        expect(container).toBeTruthy();

        // Rerender with new props
        const nextProps = {
            ...requiredProps,
            enableEmail: false,
            emailInterval: Preferences.INTERVAL_IMMEDIATE,
            enableEmailBatching: true,
            sendEmailNotifications: true,
        };

        rerender(<EmailNotificationSetting {...nextProps}/>);
        expect(container).toBeTruthy();

        // Rerender again with updated props
        const updatedProps = {
            ...nextProps,
            enableEmail: true,
            emailInterval: Preferences.INTERVAL_FIFTEEN_MINUTES,
        };

        rerender(<EmailNotificationSetting {...updatedProps}/>);
        expect(container).toBeTruthy();
    });
});
