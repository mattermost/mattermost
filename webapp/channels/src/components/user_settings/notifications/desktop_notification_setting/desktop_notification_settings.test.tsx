// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import type {ComponentProps} from 'react';

import Constants, {NotificationLevels} from 'utils/constants';

import type {PushNotificationOption} from './desktop_notification_settings';
import DesktopNotificationSettings, {getCheckedStateForDesktopThreads, getPushNotificationOptionValue} from './desktop_notification_settings';

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

    test('should call props.updateSection and props.onCancel on handleMinUpdateSection', () => {
        const props = {...baseProps, updateSection: jest.fn(), onCancel: jest.fn()};
        const wrapper = shallow<DesktopNotificationSettings>(
            <DesktopNotificationSettings {...props}/>,
        );

        wrapper.instance().handleMinUpdateSection('');
        expect(props.updateSection).toHaveBeenCalledTimes(1);
        expect(props.updateSection).toHaveBeenCalledWith('');
        expect(props.onCancel).toHaveBeenCalledTimes(1);
        expect(props.onCancel).toHaveBeenCalledWith();

        wrapper.instance().handleMinUpdateSection('desktop');
        expect(props.updateSection).toHaveBeenCalledTimes(2);
        expect(props.updateSection).toHaveBeenCalledWith('desktop');
        expect(props.onCancel).toHaveBeenCalledTimes(2);
        expect(props.onCancel).toHaveBeenCalledWith();
    });

    test('should call props.updateSection on handleMaxUpdateSection', () => {
        const props = {...baseProps, updateSection: jest.fn()};
        const wrapper = shallow<DesktopNotificationSettings>(
            <DesktopNotificationSettings {...props}/>,
        );

        wrapper.instance().handleMaxUpdateSection('');
        expect(props.updateSection).toHaveBeenCalledTimes(1);
        expect(props.updateSection).toHaveBeenCalledWith('');

        wrapper.instance().handleMaxUpdateSection('desktop');
        expect(props.updateSection).toHaveBeenCalledTimes(2);
        expect(props.updateSection).toHaveBeenCalledWith('desktop');
    });

    test('should call props.setParentState on handleOnChange', () => {
        const props = {...baseProps, setParentState: jest.fn()};
        const wrapper = shallow<DesktopNotificationSettings>(
            <DesktopNotificationSettings {...props}/>,
        );

        wrapper.instance().handleOnChange({
            currentTarget: {getAttribute: (key: string) => {
                return {'data-key': 'dataKey', 'data-value': 'dataValue'}[key];
            }},
        } as unknown as React.ChangeEvent<HTMLInputElement>);

        expect(props.setParentState).toHaveBeenCalledTimes(1);
        expect(props.setParentState).toHaveBeenCalledWith('dataKey', 'dataValue');
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

describe('getPushNotificationOptionValue', () => {
    test('When input is undefined it should return the last option', () => {
        expect(getPushNotificationOptionValue(undefined)).not.toBeUndefined();

        const result = getPushNotificationOptionValue(undefined) as PushNotificationOption;
        expect(result.value).toBe(Constants.UserStatuses.OFFLINE);
    });

    test('when input is defined but is not a valid option it should return the last option', () => {
        // We are purposely testing with an invalid value hence the 'any'
        expect(getPushNotificationOptionValue('invalid' as any)).not.toBeUndefined();

        const result = getPushNotificationOptionValue('invalid' as any) as PushNotificationOption;
        expect(result.value).toBe(Constants.UserStatuses.OFFLINE);
    });

    test('When input is a valid option it should return the same option', () => {
        expect(getPushNotificationOptionValue(Constants.UserStatuses.ONLINE)).not.toBeUndefined();

        const result = getPushNotificationOptionValue(Constants.UserStatuses.ONLINE) as PushNotificationOption;
        expect(result.value).toBe(Constants.UserStatuses.ONLINE);

        expect(getPushNotificationOptionValue(Constants.UserStatuses.AWAY)).not.toBeUndefined();

        const result2 = getPushNotificationOptionValue(Constants.UserStatuses.AWAY) as PushNotificationOption;
        expect(result2.value).toBe(Constants.UserStatuses.AWAY);
    });
});
