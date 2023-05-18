// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ComponentProps} from 'react';
import {shallow} from 'enzyme';

import {TestHelper} from 'utils/test_helper';

import {UserNotifyProps} from '@mattermost/types/users';

import UserSettingsNotifications from './user_settings_notifications';

describe('components/user_settings/display/UserSettingsDisplay', () => {
    const user = TestHelper.getUserMock({
        id: 'user_id',
    });

    const requiredProps: ComponentProps<typeof UserSettingsNotifications> = {
        user,
        updateSection: jest.fn(),
        activeSection: '',
        closeModal: jest.fn(),
        collapseModal: jest.fn(),
        actions: {
            updateMe: jest.fn(() => Promise.resolve({})),
        },
        isCollapsedThreadsEnabled: false,
        sendPushNotifications: false,
        enableAutoResponder: false,
        isCallsEnabled: true,
    };

    test('should have called handleSubmit', async () => {
        const props = {...requiredProps, actions: {...requiredProps.actions}};
        const wrapper = shallow<UserSettingsNotifications>(
            <UserSettingsNotifications {...props}/>,
        );

        await wrapper.instance().handleSubmit();
        expect(requiredProps.actions.updateMe).toHaveBeenCalled();
    });

    test('should have called handleSubmit', async () => {
        const updateMe = jest.fn(() => Promise.resolve({data: true}));

        const props = {...requiredProps, actions: {...requiredProps.actions, updateMe}};
        const wrapper = shallow<UserSettingsNotifications>(
            <UserSettingsNotifications {...props}/>,
        );

        await wrapper.instance().handleSubmit();
        expect(requiredProps.updateSection).toHaveBeenCalled();
        expect(requiredProps.updateSection).toHaveBeenCalledWith('');
    });

    test('should reset state when handleUpdateSection is called', () => {
        const newUpdateSection = jest.fn();
        const updateArg = 'unreadChannels';
        const props = {...requiredProps, updateSection: newUpdateSection, user: {...user, notify_props: {desktop: 'on'} as unknown as UserNotifyProps}};
        const wrapper = shallow<UserSettingsNotifications>(
            <UserSettingsNotifications {...props}/>,
        );

        wrapper.setState({isSaving: true, desktopActivity: 'off' as unknown as UserNotifyProps['desktop']});
        wrapper.instance().handleUpdateSection(updateArg);

        expect(wrapper.state('isSaving')).toEqual(false);
        expect(wrapper.state('desktopActivity')).toEqual('on');
        expect(newUpdateSection).toHaveBeenCalledTimes(1);
    });

    test('should show reply notifications section when CRT off', () => {
        const wrapper = shallow<UserSettingsNotifications>(
            <UserSettingsNotifications {...requiredProps}/>,
        );
        expect(wrapper.exists('SettingItem[section="comments"]')).toBe(true);
    });

    test('should not show reply notifications section when CRT on', () => {
        const wrapper = shallow<UserSettingsNotifications>(
            <UserSettingsNotifications
                {...requiredProps}
                isCollapsedThreadsEnabled={true}
            />,
        );
        expect(wrapper.exists('SettingItem[section="comments"]')).toBe(false);
    });
});
