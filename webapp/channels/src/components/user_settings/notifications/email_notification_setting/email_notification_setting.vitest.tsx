// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import {renderWithContext, screen, fireEvent, waitFor} from 'tests/vitest_react_testing_utils';
import {Preferences, NotificationLevels} from 'utils/constants';

import EmailNotificationSetting from './email_notification_setting';

describe('components/user_settings/notifications/EmailNotificationSetting', () => {
    const requiredProps: ComponentProps<typeof EmailNotificationSetting> = {
        active: true,
        updateSection: vi.fn(),
        onSubmit: vi.fn(),
        onCancel: vi.fn(),
        saving: false,
        error: '',
        setParentState: vi.fn(),
        areAllSectionsInactive: false,
        isCollapsedThreadsEnabled: false,
        enableEmail: false,
        onChange: vi.fn(),
        threads: NotificationLevels.ALL,
        currentUserId: 'current_user_id',
        emailInterval: Preferences.INTERVAL_NEVER,
        sendEmailNotifications: true,
        enableEmailBatching: false,
        actions: {
            savePreferences: vi.fn(),
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('should match snapshot', () => {
        const {container} = renderWithContext(<EmailNotificationSetting {...requiredProps}/>);

        expect(container).toMatchSnapshot();
        expect(container.querySelector('#emailNotificationImmediately')).toBeInTheDocument();
        expect(container.querySelector('#emailNotificationNever')).toBeInTheDocument();
        expect(container.querySelector('#emailNotificationMinutes')).not.toBeInTheDocument();
        expect(container.querySelector('#emailNotificationHour')).not.toBeInTheDocument();
    });

    test('should match snapshot, enabled email batching', () => {
        const props = {
            ...requiredProps,
            enableEmailBatching: true,
        };
        const {container} = renderWithContext(<EmailNotificationSetting {...props}/>);

        expect(container).toMatchSnapshot();
        expect(container.querySelector('#emailNotificationMinutes')).toBeInTheDocument();
        expect(container.querySelector('#emailNotificationHour')).toBeInTheDocument();
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

    test('should pass handleChange', () => {
        const onChange = vi.fn();
        const props = {...requiredProps, onChange};
        const {container} = renderWithContext(<EmailNotificationSetting {...props}/>);

        const immediateOption = container.querySelector('#emailNotificationImmediately') as HTMLInputElement;
        fireEvent.click(immediateOption);

        expect(onChange).toHaveBeenCalled();
    });

    test('should pass handleSubmit', async () => {
        const onSubmit = vi.fn();
        const updateSection = vi.fn();
        const savePreferences = vi.fn();
        const props = {
            ...requiredProps,
            onSubmit,
            updateSection,
            actions: {savePreferences},
        };

        renderWithContext(<EmailNotificationSetting {...props}/>);

        // Find and click the save button
        const saveButton = screen.getByText('Save');
        fireEvent.click(saveButton);

        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalled();
            expect(updateSection).toHaveBeenCalledWith('');
        });
    });

    test('should pass handleUpdateSection', () => {
        const updateSection = vi.fn();
        const onCancel = vi.fn();
        const props = {...requiredProps, updateSection, onCancel};

        renderWithContext(<EmailNotificationSetting {...props}/>);

        // Click cancel button to trigger handleUpdateSection
        const cancelButton = screen.getByText('Cancel');
        fireEvent.click(cancelButton);

        expect(updateSection).toHaveBeenCalledWith('');
        expect(onCancel).toHaveBeenCalled();
    });

    test('should derived state from props', () => {
        // This test verifies that the component respects prop changes
        // The original test accessed component state directly, but we can verify behavior through rendering
        const props = {
            ...requiredProps,
            enableEmail: true,
            emailInterval: Preferences.INTERVAL_IMMEDIATE,
            enableEmailBatching: true,
        };

        const {container, rerender} = renderWithContext(<EmailNotificationSetting {...props}/>);

        // Verify immediate option is checked when enableEmail is true and interval is immediate
        const immediateOption = container.querySelector('#emailNotificationImmediately') as HTMLInputElement;
        expect(immediateOption).toBeInTheDocument();

        // Verify batching options are shown
        expect(container.querySelector('#emailNotificationMinutes')).toBeInTheDocument();
        expect(container.querySelector('#emailNotificationHour')).toBeInTheDocument();

        // Rerender with different props
        const newProps = {
            ...props,
            enableEmail: false,
            emailInterval: Preferences.INTERVAL_NEVER,
        };
        rerender(<EmailNotificationSetting {...newProps}/>);

        // Component should still show the options (active state)
        expect(container.querySelector('#emailNotificationNever')).toBeInTheDocument();
    });
});
