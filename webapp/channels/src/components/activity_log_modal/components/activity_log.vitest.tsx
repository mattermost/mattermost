// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {describe, test, expect, vi} from 'vitest';

import {General} from 'mattermost-redux/constants';

import ActivityLog from 'components/activity_log_modal/components/activity_log';

import {renderWithContext, screen, userEvent} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

describe('components/activity_log_modal/ActivityLog', () => {
    const baseProps = {
        index: 0,
        locale: General.DEFAULT_LOCALE,
        currentSession: TestHelper.getSessionMock({
            props: {os: 'Linux', platform: 'Linux', browser: 'Desktop App'},
            id: 'sessionId',
            create_at: 1534917291042,
            last_activity_at: 1534917643890,
        }),
        submitRevoke: vi.fn(),
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <ActivityLog {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with mobile props', () => {
        const mobileDeviceIdProps = {
            ...baseProps,
            currentSession: {...baseProps.currentSession, device_id: 'apple'},
        };
        const {container} = renderWithContext(
            <ActivityLog {...mobileDeviceIdProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('submitRevoke is called correctly', async () => {
        renderWithContext(
            <ActivityLog {...baseProps}/>,
        );

        const logoutButton = screen.getByRole('button', {name: 'Log Out'});
        await userEvent.click(logoutButton);

        expect(baseProps.submitRevoke).toHaveBeenCalled();
        expect(baseProps.submitRevoke).toHaveBeenCalledTimes(1);
        expect(baseProps.submitRevoke).toHaveBeenCalledWith('sessionId', expect.any(Object));
    });

    test('handleMoreInfo updates state correctly', async () => {
        renderWithContext(
            <ActivityLog {...baseProps}/>,
        );

        // Initially, detailed info should not be visible (looking for OS info as indicator)
        expect(screen.queryByText('OS:', {exact: false})).not.toBeInTheDocument();

        // Click "More info" link to show details
        const moreInfoLink = screen.getByRole('link', {name: 'More info'});
        await userEvent.click(moreInfoLink);

        // After clicking, the detailed info should be visible
        expect(screen.getByText('First time active:', {exact: false})).toBeInTheDocument();
        expect(screen.getByText('OS:', {exact: false})).toBeInTheDocument();
    });

    test('should handle Windows platform', () => {
        const windowsSession = TestHelper.getSessionMock({
            props: {platform: 'Windows'},
            device_id: '',
            id: 'windowsSessionId',
            last_activity_at: 1534917643890,
        });

        renderWithContext(
            <ActivityLog
                {...baseProps}
                currentSession={windowsSession}
            />,
        );

        expect(screen.getByTitle('Windows Icon')).toBeInTheDocument();
        expect(screen.getByText('Windows')).toBeInTheDocument();
    });

    test('should handle Macintosh platform', () => {
        const macSession = TestHelper.getSessionMock({
            props: {platform: 'Macintosh'},
            device_id: '',
            id: 'macSessionId',
            last_activity_at: 1534917643890,
        });

        renderWithContext(
            <ActivityLog
                {...baseProps}
                currentSession={macSession}
            />,
        );

        expect(screen.getByTitle('Apple Icon')).toBeInTheDocument();
        expect(screen.getByText('Macintosh')).toBeInTheDocument();
    });

    test('should handle iPhone platform', () => {
        const iphoneSession = TestHelper.getSessionMock({
            props: {platform: 'iPhone'},
            device_id: '',
            id: 'iphoneSessionId',
            last_activity_at: 1534917643890,
        });

        renderWithContext(
            <ActivityLog
                {...baseProps}
                currentSession={iphoneSession}
            />,
        );

        expect(screen.getByTitle('Apple Icon')).toBeInTheDocument();
        expect(screen.getByText('iPhone')).toBeInTheDocument();
    });

    test('should handle Linux platform', () => {
        const linuxSession = TestHelper.getSessionMock({
            props: {platform: 'Linux'},
            device_id: '',
            id: 'linuxSessionId',
            last_activity_at: 1534917643890,
        });

        renderWithContext(
            <ActivityLog
                {...baseProps}
                currentSession={linuxSession}
            />,
        );

        expect(screen.getByTitle('Linux Icon')).toBeInTheDocument();
        expect(screen.getByText('Linux')).toBeInTheDocument();
    });

    test('should handle Linux from os field', () => {
        const linuxOsSession = TestHelper.getSessionMock({
            props: {os: 'Linux x86_64', platform: 'Other'},
            device_id: '',
            id: 'linuxOsSessionId',
            last_activity_at: 1534917643890,
        });

        renderWithContext(
            <ActivityLog
                {...baseProps}
                currentSession={linuxOsSession}
            />,
        );

        expect(screen.getByTitle('Linux Icon')).toBeInTheDocument();
    });

    test('should handle Android from os field', () => {
        const androidSession = TestHelper.getSessionMock({
            props: {os: 'Android 12'},
            device_id: '',
            id: 'androidSessionId',
            last_activity_at: 1534917643890,
        });

        renderWithContext(
            <ActivityLog
                {...baseProps}
                currentSession={androidSession}
            />,
        );

        expect(screen.getByTitle('Android Icon')).toBeInTheDocument();
        expect(screen.getByText('Android')).toBeInTheDocument();
    });

    test('should handle iPhone Native App', () => {
        const iphoneNativeSession = TestHelper.getSessionMock({
            props: {},
            device_id: General.PUSH_NOTIFY_APPLE_REACT_NATIVE,
            id: 'iphoneNativeSessionId',
            last_activity_at: 1534917643890,
        });

        renderWithContext(
            <ActivityLog
                {...baseProps}
                currentSession={iphoneNativeSession}
            />,
        );

        expect(screen.getByTitle('Apple Icon')).toBeInTheDocument();
        expect(screen.getByText('iPhone Native App')).toBeInTheDocument();
    });

    test('should handle iPhone Native Classic App', () => {
        const iphoneClassicSession = TestHelper.getSessionMock({
            props: {},
            device_id: 'apple',
            id: 'iphoneClassicSessionId',
            last_activity_at: 1534917643890,
        });

        renderWithContext(
            <ActivityLog
                {...baseProps}
                currentSession={iphoneClassicSession}
            />,
        );

        expect(screen.getByTitle('Apple Icon')).toBeInTheDocument();
        expect(screen.getByText('iPhone Native Classic App')).toBeInTheDocument();
    });

    test('should handle Android Native App', () => {
        const androidNativeSession = TestHelper.getSessionMock({
            props: {},
            device_id: General.PUSH_NOTIFY_ANDROID_REACT_NATIVE,
            id: 'androidNativeSessionId',
            last_activity_at: 1534917643890,
        });

        renderWithContext(
            <ActivityLog
                {...baseProps}
                currentSession={androidNativeSession}
            />,
        );

        expect(screen.getByTitle('Android Icon')).toBeInTheDocument();
        expect(screen.getByText('Android Native App')).toBeInTheDocument();
    });

    test('should handle Android Native Classic App', () => {
        const androidClassicSession = TestHelper.getSessionMock({
            props: {},
            device_id: 'android',
            id: 'androidClassicSessionId',
            last_activity_at: 1534917643890,
        });

        renderWithContext(
            <ActivityLog
                {...baseProps}
                currentSession={androidClassicSession}
            />,
        );

        expect(screen.getByTitle('Android Icon')).toBeInTheDocument();
        expect(screen.getByText('Android Native Classic App')).toBeInTheDocument();
    });

    test('should handle Desktop App', () => {
        const desktopSession = TestHelper.getSessionMock({
            props: {
                platform: 'Windows',
                browser: 'Desktop App',
            },
            device_id: '',
            id: 'desktopSessionId',
            last_activity_at: 1534917643890,
        });

        renderWithContext(
            <ActivityLog
                {...baseProps}
                currentSession={desktopSession}
            />,
        );

        expect(screen.getByTitle('Windows Icon')).toBeInTheDocument();
        expect(screen.getByText('Native Desktop App')).toBeInTheDocument();
    });

    test('should handle unknown platform', () => {
        const unknownSession = TestHelper.getSessionMock({
            props: {},
            device_id: '',
            id: 'unknownSessionId',
            last_activity_at: 1534917643890,
        });

        const {container} = renderWithContext(
            <ActivityLog
                {...baseProps}
                currentSession={unknownSession}
            />,
        );

        // Unknown platform should not have a device icon with a specific title
        expect(container.querySelector('.fa-windows')).not.toBeInTheDocument();
        expect(container.querySelector('.fa-apple')).not.toBeInTheDocument();
        expect(container.querySelector('.fa-android')).not.toBeInTheDocument();
        expect(container.querySelector('.fa-linux')).not.toBeInTheDocument();
    });

    test('should handle session without props', () => {
        const sessionWithoutProps = TestHelper.getSessionMock({
            device_id: '',
            id: 'noPropsSessionId',
            last_activity_at: 1534917643890,
        });
        delete (sessionWithoutProps as any).props;

        const {container} = renderWithContext(
            <ActivityLog
                {...baseProps}
                currentSession={sessionWithoutProps}
            />,
        );

        // Should render without crashing
        expect(container.querySelector('.activity-log__table')).toBeInTheDocument();
    });

    test('should handle session without device_id', () => {
        const sessionWithoutDeviceId = TestHelper.getSessionMock({
            props: {platform: 'Windows'},
            id: 'noDeviceIdSessionId',
            last_activity_at: 1534917643890,
        });
        delete (sessionWithoutDeviceId as any).device_id;

        renderWithContext(
            <ActivityLog
                {...baseProps}
                currentSession={sessionWithoutDeviceId}
            />,
        );

        expect(screen.getByTitle('Windows Icon')).toBeInTheDocument();
    });
});
