// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import type {ComponentProps} from 'react';

import {NotificationLevels} from 'utils/constants';

import DesktopNotificationSettings from './desktop_notification_settings';

jest.mock('utils/notification_sounds', () => {
    const original = jest.requireActual('utils/notification_sounds');
    return {
        ...original,
        hasSoundOptions: jest.fn(() => true),
    };
});

describe('components/user_settings/notifications/DesktopNotificationSettings', () => {
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
        activity: NotificationLevels.MENTION,
        threads: NotificationLevels.ALL,
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

        wrapper.setProps({activity: NotificationLevels.NONE});
        expect(wrapper.instance().buildMaximizedSetting()).toMatchSnapshot();
    });

    test('should match snapshot, on buildMinimizedSetting', () => {
        const wrapper = shallow<DesktopNotificationSettings>(
            <DesktopNotificationSettings {...baseProps}/>,
        );

        expect(wrapper.instance().buildMinimizedSetting()).toMatchSnapshot();

        wrapper.setProps({activity: NotificationLevels.NONE});
        expect(wrapper.instance().buildMinimizedSetting()).toMatchSnapshot();
    });
});
