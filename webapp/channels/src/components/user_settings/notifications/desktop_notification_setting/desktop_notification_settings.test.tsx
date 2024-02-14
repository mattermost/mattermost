// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import type {ComponentProps} from 'react';

import Constants, {NotificationLevels} from 'utils/constants';

import type {SelectOptions} from './desktop_notification_settings';
import DesktopNotificationSettings, {
    getCheckedStateForDesktopThreads,
    getValueOfSendMobileNotificationWhenSelect,
    getCheckedStateForDissimilarDesktopAndMobileNotification,
    validNotificationLevels,
    getDefaultMobileNotificationLevelWhenUsedDifferent,
} from './desktop_notification_settings';

jest.mock('utils/notification_sounds', () => {
    const original = jest.requireActual('utils/notification_sounds');
    return {
        ...original,
        hasSoundOptions: jest.fn(() => true),
    };
});

describe('DesktopNotificationSettings', () => {
    const baseProps: ComponentProps<typeof DesktopNotificationSettings> = {
        active: true,
        updateSection: jest.fn(),
        onSubmit: jest.fn(),
        onCancel: jest.fn(),
        saving: false,
        error: '',
        setParentState: jest.fn(),
        areAllSectionsInactive: false,
        isCollapsedThreadsEnabled: false,
        desktopActivity: NotificationLevels.MENTION,
        pushActivity: NotificationLevels.MENTION,
        pushStatus: Constants.UserStatuses.OFFLINE,
        desktopThreads: NotificationLevels.ALL,
        pushThreads: NotificationLevels.ALL,
        sendPushNotifications: true,
        desktopAndMobileSettingsDifferent: false,
        sound: 'false',
        callsSound: 'false',
        selectedSound: 'Bing',
        callsSelectedSound: 'Dynamic',
        isCallsRingingEnabled: false,
    };

    test('should match snapshot, on max setting', () => {
        const wrapper = shallow(
            <DesktopNotificationSettings {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, on max setting with sound enabled', () => {
        const props = {...baseProps, sound: 'true'};
        const wrapper = shallow(
            <DesktopNotificationSettings {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, on max setting with Calls enabled', () => {
        const props = {...baseProps, isCallsRingingEnabled: true};
        const wrapper = shallow(
            <DesktopNotificationSettings {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, on max setting with Calls enabled, calls sound true', () => {
        const props = {...baseProps, isCallsRingingEnabled: true, callsSound: 'true'};
        const wrapper = shallow(
            <DesktopNotificationSettings {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, on min setting', () => {
        const props = {...baseProps, active: false};
        const wrapper = shallow(
            <DesktopNotificationSettings {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should call props.updateSection and props.onCancel on handleChangeForMinSection', () => {
        const props = {...baseProps, updateSection: jest.fn(), onCancel: jest.fn()};
        const wrapper = shallow<DesktopNotificationSettings>(
            <DesktopNotificationSettings {...props}/>,
        );

        wrapper.instance().handleChangeForMinSection('');
        expect(props.updateSection).toHaveBeenCalledTimes(1);
        expect(props.updateSection).toHaveBeenCalledWith('');
        expect(props.onCancel).toHaveBeenCalledTimes(1);
        expect(props.onCancel).toHaveBeenCalledWith();

        wrapper.instance().handleChangeForMinSection('desktop');
        expect(props.updateSection).toHaveBeenCalledTimes(2);
        expect(props.updateSection).toHaveBeenCalledWith('desktop');
        expect(props.onCancel).toHaveBeenCalledTimes(2);
        expect(props.onCancel).toHaveBeenCalledWith();
    });

    test('should call props.updateSection on handleChangeForMaxSection', () => {
        const props = {...baseProps, updateSection: jest.fn()};
        const wrapper = shallow<DesktopNotificationSettings>(
            <DesktopNotificationSettings {...props}/>,
        );

        wrapper.instance().handleChangeForMaxSection('');
        expect(props.updateSection).toHaveBeenCalledTimes(1);
        expect(props.updateSection).toHaveBeenCalledWith('');

        wrapper.instance().handleChangeForMaxSection('desktop');
        expect(props.updateSection).toHaveBeenCalledTimes(2);
        expect(props.updateSection).toHaveBeenCalledWith('desktop');
    });

    test('should match snapshot, on buildMaximizedSetting', () => {
        const wrapper = shallow<DesktopNotificationSettings>(
            <DesktopNotificationSettings {...baseProps}/>,
        );

        expect(wrapper.instance().buildMaximizedSetting()).toMatchSnapshot();

        wrapper.setProps({desktopActivity: NotificationLevels.NONE});
        expect(wrapper.instance().buildMaximizedSetting()).toMatchSnapshot();
    });

    test('should match snapshot, on buildMinimizedSetting', () => {
        const wrapper = shallow<DesktopNotificationSettings>(
            <DesktopNotificationSettings {...baseProps}/>,
        );

        expect(wrapper.instance().buildMinimizedSetting()).toMatchSnapshot();

        wrapper.setProps({desktopActivity: NotificationLevels.NONE});
        expect(wrapper.instance().buildMinimizedSetting()).toMatchSnapshot();
    });
});

describe('getCheckedStateForDesktopThreads', () => {
    test('should return false when desktopThreads is undefined', () => {
        expect(getCheckedStateForDesktopThreads('all')).toBe(false);
    });

    test('should return false if either of them is not for all threads', () => {
        expect(getCheckedStateForDesktopThreads('all', 'mention')).toBe(false);
        expect(getCheckedStateForDesktopThreads('all', 'none')).toBe(false);
        expect(getCheckedStateForDesktopThreads('all', 'default')).toBe(false);

        expect(getCheckedStateForDesktopThreads('none', 'all')).toBe(false);
        expect(getCheckedStateForDesktopThreads('mention', 'all')).toBe(false);
        expect(getCheckedStateForDesktopThreads('default', 'all')).toBe(false);
    });

    test('should return true if both of them are for all threads', () => {
        expect(getCheckedStateForDesktopThreads('all', 'all')).toBe(true);
    });
});

describe('getValueOfSendMobileNotificationWhenSelect', () => {
    test('When input is undefined it should return the last option', () => {
        expect(getValueOfSendMobileNotificationWhenSelect(undefined)).not.toBeUndefined();

        const result = getValueOfSendMobileNotificationWhenSelect(undefined) as SelectOptions;
        expect(result.value).toBe(Constants.UserStatuses.OFFLINE);
    });

    test('when input is defined but is not a valid option it should return the last option', () => {
        // We are purposely testing with an invalid value hence the 'any'
        expect(getValueOfSendMobileNotificationWhenSelect('invalid' as any)).not.toBeUndefined();

        const result = getValueOfSendMobileNotificationWhenSelect('invalid' as any) as SelectOptions;
        expect(result.value).toBe(Constants.UserStatuses.OFFLINE);
    });

    test('When input is a valid option it should return the same option', () => {
        expect(getValueOfSendMobileNotificationWhenSelect(Constants.UserStatuses.ONLINE)).not.toBeUndefined();

        const result = getValueOfSendMobileNotificationWhenSelect(Constants.UserStatuses.ONLINE) as SelectOptions;
        expect(result.value).toBe(Constants.UserStatuses.ONLINE);

        expect(getValueOfSendMobileNotificationWhenSelect(Constants.UserStatuses.AWAY)).not.toBeUndefined();

        const result2 = getValueOfSendMobileNotificationWhenSelect(Constants.UserStatuses.AWAY) as SelectOptions;
        expect(result2.value).toBe(Constants.UserStatuses.AWAY);
    });
});

describe('getCheckedStateForDissimilarDesktopAndMobileNotification', () => {
    test('should return false when desktop and push notification levels are different', () => {
        validNotificationLevels.forEach((desktopLevel) => {
            validNotificationLevels.forEach((mobileLevel) => {
                if (desktopLevel !== mobileLevel) {
                    expect(getCheckedStateForDissimilarDesktopAndMobileNotification(desktopLevel, mobileLevel)).toBe(false);
                }
            });
        });
    });

    test('should return true when desktop and push notification levels are the same', () => {
        validNotificationLevels.forEach((level) => {
            expect(getCheckedStateForDissimilarDesktopAndMobileNotification(level, level)).toBe(true);
        });
    });

    test('should return false when desktop and push notification levels are undefined', () => {
        expect(getCheckedStateForDissimilarDesktopAndMobileNotification(undefined as any, undefined as any)).toBe(false);
        expect(getCheckedStateForDissimilarDesktopAndMobileNotification('hello' as any, NotificationLevels.ALL)).toBe(false);
    });
});

describe('getDefaultMobileNotificationLevelWhenUsedDifferent', () => {
    test('if invalid input is provided it should return the default value', () => {
        expect(getDefaultMobileNotificationLevelWhenUsedDifferent('invalid' as any)).toBe(NotificationLevels.MENTION);
    });

    test('it should never return default notification level', () => {
        validNotificationLevels.forEach((level) => {
            expect(getDefaultMobileNotificationLevelWhenUsedDifferent(level)).not.toBe(NotificationLevels.DEFAULT);
        });
    });

    test('it should return the next level when input is valid', () => {
        // expect(getDefaultMobileNotificationLevelWhenUsedDifferent(NotificationLevels.NONE)).toBe(NotificationLevels.ALL);
        expect(getDefaultMobileNotificationLevelWhenUsedDifferent(NotificationLevels.DEFAULT)).toBe(NotificationLevels.ALL);
        expect(getDefaultMobileNotificationLevelWhenUsedDifferent(NotificationLevels.MENTION)).toBe(NotificationLevels.NONE);
    });
});
