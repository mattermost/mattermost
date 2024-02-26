// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import type {ComponentProps} from 'react';

import Constants, {NotificationLevels} from 'utils/constants';

import type {SelectOption} from './desktop_notification_settings';
import DesktopNotificationSettings, {
    areDesktopAndMobileSettingsDifferent,
    getValueOfSendMobileNotificationForSelect,
    shouldShowDesktopAndMobileThreadNotificationCheckbox,
    shouldShowSendMobileNotificationsWhenSelect,
    getValueOfSendMobileNotificationWhenSelect,
    getValueOfDesktopAndMobileThreads,
} from './desktop_notification_settings';

const validNotificationLevels = Object.values(NotificationLevels);

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
    };

    test('should match snapshot, on max setting', () => {
        const wrapper = shallow(
            <DesktopNotificationSettings {...baseProps}/>,
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
});

describe('areDesktopAndMobileSettingsDifferent', () => {
    test('should return true when desktop and push notification levels are different', () => {
        validNotificationLevels.forEach((desktopLevel) => {
            validNotificationLevels.forEach((mobileLevel) => {
                if (desktopLevel !== mobileLevel) {
                    expect(areDesktopAndMobileSettingsDifferent(desktopLevel, mobileLevel)).toBe(true);
                }
            });
        });
    });

    test('should return false when desktop and push notification levels are the same', () => {
        validNotificationLevels.forEach((level) => {
            expect(areDesktopAndMobileSettingsDifferent(level, level)).toBe(false);
        });
    });

    test('should return true when desktop or push notification levels are undefined', () => {
        expect(areDesktopAndMobileSettingsDifferent(undefined as any, undefined as any)).toBe(true);
        expect(areDesktopAndMobileSettingsDifferent(NotificationLevels.ALL, undefined as any)).toBe(true);
        expect(areDesktopAndMobileSettingsDifferent('hello' as any, NotificationLevels.ALL)).toBe(true);
    });
});

describe('getValueOfSendMobileNotificationForSelect', () => {
    test('should return the middle option when input is undefined', () => {
        expect(getValueOfSendMobileNotificationForSelect(undefined as any)).not.toBeUndefined();

        const result = getValueOfSendMobileNotificationForSelect(undefined as any) as SelectOption;
        expect(result.value).toBe(NotificationLevels.MENTION);
    });

    test('should return the middle option when input is not a valid option', () => {
        expect(getValueOfSendMobileNotificationForSelect('invalid' as any)).not.toBeUndefined();

        const result = getValueOfSendMobileNotificationForSelect('invalid' as any) as SelectOption;
        expect(result.value).toBe(NotificationLevels.MENTION);
    });

    test('should return the same option when input is a valid option', () => {
        validNotificationLevels.
            filter((level) => level !== NotificationLevels.DEFAULT).
            forEach((level) => {
                expect(getValueOfSendMobileNotificationForSelect(level)).not.toBeUndefined();

                const result = getValueOfSendMobileNotificationForSelect(level) as SelectOption;
                expect(result.value).toBe(level);
            });
    });
});

describe('shouldShowDesktopAndMobileThreadNotificationCheckbox', () => {
    test('should return false when collapsed threads are not enabled', () => {
        expect(shouldShowDesktopAndMobileThreadNotificationCheckbox(false, 'hello' as any, 'hello' as any)).toBe(false);
    });

    test('should return true when desktop or mobile setting is invalid', () => {
        expect(shouldShowDesktopAndMobileThreadNotificationCheckbox(true, 'nothing' as any, 'all')).toBe(true);
        expect(shouldShowDesktopAndMobileThreadNotificationCheckbox(true, 'all', 'nothing' as any)).toBe(true);
    });

    test('should return true when either desktop or mobile setting is for mentions', () => {
        expect(shouldShowDesktopAndMobileThreadNotificationCheckbox(true, NotificationLevels.MENTION, 'none')).toBe(true);
        expect(shouldShowDesktopAndMobileThreadNotificationCheckbox(true, 'none', NotificationLevels.MENTION)).toBe(true);
    });

    test('should return false when either desktop or mobile setting is not for mentions', () => {
        validNotificationLevels.
            filter((level) => level !== NotificationLevels.MENTION).
            forEach((level) => {
                expect(shouldShowDesktopAndMobileThreadNotificationCheckbox(true, level, 'none')).toBe(false);
                expect(shouldShowDesktopAndMobileThreadNotificationCheckbox(true, 'none', level)).toBe(false);
            });
    });
});

describe('shouldShowSendMobileNotificationsWhenSelect', () => {
    test('should hide when desktop settings are none', () => {
        expect(shouldShowSendMobileNotificationsWhenSelect('none', 'default', false)).toBe(false);
    });

    test('should hide when desktop settings and mobile settings are none', () => {
        expect(shouldShowSendMobileNotificationsWhenSelect('none', 'none', false)).toBe(false);
    });

    test('should hide when desktop setting are not none but mobile settings are none', () => {
        expect(shouldShowSendMobileNotificationsWhenSelect('all', 'none', true)).toBe(false);
        expect(shouldShowSendMobileNotificationsWhenSelect('mention', 'none', true)).toBe(false);
    });

    test('should show when desktop setting are none but mobile settings are not none', () => {
        expect(shouldShowSendMobileNotificationsWhenSelect('none', 'all', true)).toBe(true);
        expect(shouldShowSendMobileNotificationsWhenSelect('none', 'mention', true)).toBe(true);
    });

    test('should hide when settings for both desktop and mobile are none but checkbox is checked', () => {
        expect(shouldShowSendMobileNotificationsWhenSelect('none', 'none', true)).toBe(false);
    });
});

describe('getValueOfSendMobileNotificationWhenSelect', () => {
    test('When input is undefined it should return the last option', () => {
        expect(getValueOfSendMobileNotificationWhenSelect(undefined)).not.toBeUndefined();

        const result = getValueOfSendMobileNotificationWhenSelect(undefined) as SelectOption;
        expect(result.value).toBe(Constants.UserStatuses.OFFLINE);
    });

    test('when input is defined but is not a valid option it should return the last option', () => {
        // We are purposely testing with an invalid value hence the 'any'
        expect(getValueOfSendMobileNotificationWhenSelect('invalid' as any)).not.toBeUndefined();

        const result = getValueOfSendMobileNotificationWhenSelect('invalid' as any) as SelectOption;
        expect(result.value).toBe(Constants.UserStatuses.OFFLINE);
    });

    test('When input is a valid option it should return the same option', () => {
        expect(getValueOfSendMobileNotificationWhenSelect(Constants.UserStatuses.ONLINE)).not.toBeUndefined();

        const result = getValueOfSendMobileNotificationWhenSelect(Constants.UserStatuses.ONLINE) as SelectOption;
        expect(result.value).toBe(Constants.UserStatuses.ONLINE);

        expect(getValueOfSendMobileNotificationWhenSelect(Constants.UserStatuses.AWAY)).not.toBeUndefined();

        const result2 = getValueOfSendMobileNotificationWhenSelect(Constants.UserStatuses.AWAY) as SelectOption;
        expect(result2.value).toBe(Constants.UserStatuses.AWAY);
    });
});

describe('getValueOfDesktopAndMobileThreads', () => {
    test('should return true when desktopThreads is undefined but push thread is for all', () => {
        expect(getValueOfDesktopAndMobileThreads('all', undefined)).toBe(true);
    });

    test('should return false when pushThreads is undefined but when desktopThread is for all', () => {
        expect(getValueOfDesktopAndMobileThreads(undefined, 'all')).toBe(true);
    });

    test('should return true if either of them is for all threads', () => {
        expect(getValueOfDesktopAndMobileThreads('all', 'mention')).toBe(true);
        expect(getValueOfDesktopAndMobileThreads('all', 'none')).toBe(true);
        expect(getValueOfDesktopAndMobileThreads('all', 'default')).toBe(true);

        expect(getValueOfDesktopAndMobileThreads('none', 'all')).toBe(true);
        expect(getValueOfDesktopAndMobileThreads('mention', 'all')).toBe(true);
        expect(getValueOfDesktopAndMobileThreads('default', 'all')).toBe(true);
    });

    test('should return true if both of them are for all threads', () => {
        expect(getValueOfDesktopAndMobileThreads('all', 'all')).toBe(true);
    });

    test('should return false if both of them are not for all threads', () => {
        validNotificationLevels.forEach((desktopLevel) => {
            validNotificationLevels.forEach((mobileLevel) => {
                if (desktopLevel !== 'all' && mobileLevel !== 'all') {
                    expect(getValueOfDesktopAndMobileThreads(desktopLevel, mobileLevel)).toBe(false);
                }
            });
        });
    });
});
