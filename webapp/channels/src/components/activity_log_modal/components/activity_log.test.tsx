// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow, type ShallowWrapper} from 'enzyme';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import {General} from 'mattermost-redux/constants';

import ActivityLog from 'components/activity_log_modal/components/activity_log';

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
        submitRevoke: jest.fn(),
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <ActivityLog {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with mobile props', () => {
        const mobileDeviceIdProps = Object.assign({}, baseProps, {currentSession: {...baseProps.currentSession, device_id: 'apple'}});
        const wrapper = shallow(
            <ActivityLog {...mobileDeviceIdProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('submitRevoke is called correctly', () => {
        const wrapper = shallow<ActivityLog>(
            <ActivityLog {...baseProps}/>,
        );

        const event = {preventDefault: jest.fn()};
        wrapper.instance().submitRevoke(event as unknown as React.MouseEvent);
        expect(baseProps.submitRevoke).toBeCalled();
        expect(baseProps.submitRevoke).toHaveBeenCalledTimes(1);
        expect(baseProps.submitRevoke).toBeCalledWith('sessionId', event);
    });

    test('handleMoreInfo updates state correctly', () => {
        const wrapper = shallow<ActivityLog>(
            <ActivityLog {...baseProps}/>,
        );

        wrapper.instance().handleMoreInfo();
        expect(wrapper.state()).toEqual({moreInfo: true});
    });

    test('should match when isMobileSession is called', () => {
        const wrapper = shallow<ActivityLog>(
            <ActivityLog {...baseProps}/>,
        );

        const isMobileSession = wrapper.instance().isMobileSession;
        expect(isMobileSession(TestHelper.getSessionMock({device_id: 'apple'}))).toEqual(true);
        expect(isMobileSession(TestHelper.getSessionMock({device_id: 'android'}))).toEqual(true);
        expect(isMobileSession(TestHelper.getSessionMock({device_id: 'none'}))).toEqual(false);
    });

    describe('sessionInfo', () => {
        let wrapper: ShallowWrapper<any, any, ActivityLog>;
        let sessionInfo: ActivityLog['sessionInfo'];

        beforeEach(() => {
            wrapper = shallow<ActivityLog>(
                <ActivityLog {...baseProps}/>,
            );
            sessionInfo = wrapper.instance().sessionInfo;
        });

        test('should handle Windows platform', () => {
            const session = TestHelper.getSessionMock({
                props: {platform: 'Windows'},
                device_id: '',
            });
            const result = sessionInfo(session);

            expect(result.devicePicture).toBe('fa fa-windows');
            expect(result.deviceTitle).toEqual({
                id: 'device_icons.windows',
                defaultMessage: 'Windows Icon',
            });
            expect(result.devicePlatform).toBe('Windows');
        });

        test('should handle Macintosh platform', () => {
            const session = TestHelper.getSessionMock({
                props: {platform: 'Macintosh'},
                device_id: '',
            });
            const result = sessionInfo(session);

            expect(result.devicePicture).toBe('fa fa-apple');
            expect(result.deviceTitle).toEqual({
                id: 'device_icons.apple',
                defaultMessage: 'Apple Icon',
            });
            expect(result.devicePlatform).toBe('Macintosh');
        });

        test('should handle iPhone platform', () => {
            const session = TestHelper.getSessionMock({
                props: {platform: 'iPhone'},
                device_id: '',
            });
            const result = sessionInfo(session);

            expect(result.devicePicture).toBe('fa fa-apple');
            expect(result.deviceTitle).toEqual({
                id: 'device_icons.apple',
                defaultMessage: 'Apple Icon',
            });
            expect(result.devicePlatform).toBe('iPhone');
        });

        test('should handle Linux platform', () => {
            const session = TestHelper.getSessionMock({
                props: {platform: 'Linux'},
                device_id: '',
            });
            const result = sessionInfo(session);

            expect(result.devicePicture).toBe('fa fa-linux');
            expect(result.deviceTitle).toEqual({
                id: 'device_icons.linux',
                defaultMessage: 'Linux Icon',
            });
            expect(result.devicePlatform).toBe('Linux');
        });

        test('should handle Linux from os field', () => {
            const session = TestHelper.getSessionMock({
                props: {os: 'Linux x86_64', platform: 'Other'},
                device_id: '',
            });
            const result = sessionInfo(session);

            expect(result.devicePicture).toBe('fa fa-linux');
            expect(result.deviceTitle).toEqual({
                id: 'device_icons.linux',
                defaultMessage: 'Linux Icon',
            });
        });

        test('should handle Android from os field', () => {
            const session = TestHelper.getSessionMock({
                props: {os: 'Android 12'},
                device_id: '',
            });
            const result = sessionInfo(session);

            expect(result.devicePicture).toBe('fa fa-android');
            expect(result.deviceTitle).toEqual({
                id: 'device_icons.android',
                defaultMessage: 'Android Icon',
            });
            expect(result.devicePlatform).toEqual(
                <FormattedMessage
                    id='activity_log_modal.android'
                    defaultMessage='Android'
                />,
            );
        });

        test('should handle iPhone Native App', () => {
            const session = TestHelper.getSessionMock({
                props: {},
                device_id: General.PUSH_NOTIFY_APPLE_REACT_NATIVE,
            });
            const result = sessionInfo(session);

            expect(result.devicePicture).toBe('fa fa-apple');
            expect(result.deviceTitle).toEqual({
                id: 'device_icons.apple',
                defaultMessage: 'Apple Icon',
            });
            expect(result.devicePlatform).toEqual(
                <FormattedMessage
                    id='activity_log_modal.iphoneNativeApp'
                    defaultMessage='iPhone Native App'
                />,
            );
        });

        test('should handle iPhone Native Classic App', () => {
            const session = TestHelper.getSessionMock({
                props: {},
                device_id: 'apple',
            });
            const result = sessionInfo(session);

            expect(result.devicePicture).toBe('fa fa-apple');
            expect(result.deviceTitle).toEqual({
                id: 'device_icons.apple',
                defaultMessage: 'Apple Icon',
            });
            expect(result.devicePlatform).toEqual(
                <FormattedMessage
                    id='activity_log_modal.iphoneNativeClassicApp'
                    defaultMessage='iPhone Native Classic App'
                />,
            );
        });

        test('should handle Android Native App', () => {
            const session = TestHelper.getSessionMock({
                props: {},
                device_id: General.PUSH_NOTIFY_ANDROID_REACT_NATIVE,
            });
            const result = sessionInfo(session);

            expect(result.devicePicture).toBe('fa fa-android');
            expect(result.deviceTitle).toEqual({
                id: 'device_icons.android',
                defaultMessage: 'Android Icon',
            });
            expect(result.devicePlatform).toEqual(
                <FormattedMessage
                    id='activity_log_modal.androidNativeApp'
                    defaultMessage='Android Native App'
                />,
            );
        });

        test('should handle Android Native Classic App', () => {
            const session = TestHelper.getSessionMock({
                props: {},
                device_id: 'android',
            });
            const result = sessionInfo(session);

            expect(result.devicePicture).toBe('fa fa-android');
            expect(result.deviceTitle).toEqual({
                id: 'device_icons.android',
                defaultMessage: 'Android Icon',
            });
            expect(result.devicePlatform).toEqual(
                <FormattedMessage
                    id='activity_log_modal.androidNativeClassicApp'
                    defaultMessage='Android Native Classic App'
                />,
            );
        });

        test('should handle Desktop App', () => {
            const session = TestHelper.getSessionMock({
                props: {
                    platform: 'Windows',
                    browser: 'Desktop App',
                },
                device_id: '',
            });
            const result = sessionInfo(session);

            expect(result.devicePicture).toBe('fa fa-windows');
            expect(result.devicePlatform).toEqual(
                <FormattedMessage
                    id='activity_log_modal.desktop'
                    defaultMessage='Native Desktop App'
                />,
            );
        });

        test('should handle unknown platform', () => {
            const session = TestHelper.getSessionMock({
                props: {},
                device_id: '',
            });
            const result = sessionInfo(session);

            expect(result.devicePicture).toBeUndefined();
            expect(result.deviceTitle).toBe('Unknown');
            expect(result.devicePlatform).toBeUndefined();
        });

        test('should handle session without props', () => {
            const session = TestHelper.getSessionMock({
                device_id: '',
            });
            delete (session as any).props;

            const result = sessionInfo(session);

            expect(result.devicePicture).toBeUndefined();
            expect(result.deviceTitle).toBe('Unknown');
        });

        test('should handle session without device_id', () => {
            const session = TestHelper.getSessionMock({
                props: {platform: 'Windows'},
            });
            delete (session as any).device_id;

            const result = sessionInfo(session);

            expect(result.devicePicture).toBe('fa fa-windows');
            expect(result.deviceTitle).toEqual({
                id: 'device_icons.windows',
                defaultMessage: 'Windows Icon',
            });
        });
    });
});
