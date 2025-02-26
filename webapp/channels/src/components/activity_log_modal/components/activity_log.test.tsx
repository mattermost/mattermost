// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
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

    test('should match when mobileSessionInfo is called', () => {
        const wrapper = shallow<ActivityLog>(
            <ActivityLog {...baseProps}/>,
        );

        const mobileSessionInfo = wrapper.instance().mobileSessionInfo;

        const appleText = (
            <FormattedMessage
                defaultMessage='iPhone Native Classic App'
                id='activity_log_modal.iphoneNativeClassicApp'
            />
        );
        const apple = {devicePicture: 'fa fa-apple', devicePlatform: appleText};
        expect(mobileSessionInfo(TestHelper.getSessionMock({device_id: 'apple'}))).toMatchObject(apple);

        const androidText = (
            <FormattedMessage
                defaultMessage='Android Native Classic App'
                id='activity_log_modal.androidNativeClassicApp'
            />
        );
        const android = {devicePicture: 'fa fa-android', devicePlatform: androidText};
        expect(mobileSessionInfo(TestHelper.getSessionMock({device_id: 'android'}))).toMatchObject(android);

        const appleRNText = (
            <FormattedMessage
                defaultMessage='iPhone Native App'
                id='activity_log_modal.iphoneNativeApp'
            />
        );
        const appleRN = {devicePicture: 'fa fa-apple', devicePlatform: appleRNText};
        expect(mobileSessionInfo(TestHelper.getSessionMock({device_id: 'apple_rn'}))).toMatchObject(appleRN);

        const androidRNText = (
            <FormattedMessage
                defaultMessage='Android Native App'
                id='activity_log_modal.androidNativeApp'
            />
        );
        const androidRN = {devicePicture: 'fa fa-android', devicePlatform: androidRNText};
        expect(mobileSessionInfo(TestHelper.getSessionMock({device_id: 'android_rn'}))).toMatchObject(androidRN);
    });
});
