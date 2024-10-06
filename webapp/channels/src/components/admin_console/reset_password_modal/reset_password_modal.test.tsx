// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {UserNotifyProps, UserProfile} from '@mattermost/types/users';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import {TestHelper} from 'utils/test_helper';

import ResetPasswordModal from './reset_password_modal';

describe('components/admin_console/reset_password_modal/reset_password_modal.tsx', () => {
    const notifyProps: UserNotifyProps = {
        channel: 'true',
        comments: 'never',
        desktop: 'default',
        desktop_sound: 'true',
        calls_desktop_sound: 'true',
        email: 'true',
        first_name: 'true',
        mark_unread: 'all',
        mention_keys: '',
        highlight_keys: '',
        push: 'default',
        push_status: 'ooo',
    };
    const user: UserProfile = TestHelper.getUserMock({
        auth_service: 'test',
        notify_props: notifyProps,
    });

    const baseProps = {
        actions: {updateUserPassword: jest.fn(() => Promise.resolve({data: ''}))},
        currentUserId: user.id,
        user,
        onHide: jest.fn(),
        onExited: jest.fn(),
        passwordConfig: {
            minimumLength: 10,
            requireLowercase: true,
            requireNumber: true,
            requireSymbol: true,
            requireUppercase: true,
        },
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <ResetPasswordModal {...baseProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when there is no user', () => {
        const props = {...baseProps, user: undefined};
        const wrapper = shallow(
            <ResetPasswordModal {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should call updateUserPassword', () => {
        const updateUserPassword = jest.fn(() => Promise.resolve({data: ''}));
        const oldPassword = 'oldPassword123!';
        const newPassword = 'newPassword123!';
        const props = {...baseProps, actions: {updateUserPassword}};
        const wrapper = mountWithIntl(<ResetPasswordModal {...props}/>);

        (wrapper.find('input[type=\'password\']').first().instance() as unknown as HTMLInputElement).value = oldPassword;
        (wrapper.find('input[type=\'password\']').last().instance() as unknown as HTMLInputElement).value = newPassword;
        wrapper.find('button[type=\'submit\']').first().simulate('click', {preventDefault: jest.fn()});

        expect(updateUserPassword.mock.calls.length).toBe(1);
        expect(wrapper.state('serverErrorCurrentPass')).toBeNull();
        expect(wrapper.state('serverErrorNewPass')).toBeNull();
    });

    test('should not call updateUserPassword when the old password is not provided', () => {
        const updateUserPassword = jest.fn(() => Promise.resolve({data: ''}));
        const newPassword = 'newPassword123!';
        const props = {...baseProps, actions: {updateUserPassword}};
        const wrapper = mountWithIntl(<ResetPasswordModal {...props}/>);

        (wrapper.find('input[type=\'password\']').last().instance() as unknown as HTMLInputElement).value = newPassword;
        wrapper.find('button[type=\'submit\']').first().simulate('click', {preventDefault: jest.fn()});

        expect(updateUserPassword.mock.calls.length).toBe(0);
        expect(wrapper.state('serverErrorCurrentPass')).toStrictEqual(
            <FormattedMessage
                defaultMessage='Please enter your current password.'
                id='admin.reset_password.missing_current'
            />);
        expect(wrapper.state('serverErrorNewPass')).toBeNull();
    });

    test('should call updateUserPassword', () => {
        const updateUserPassword = jest.fn(() => Promise.resolve({data: ''}));
        const password = 'Password123!';

        const props = {...baseProps, currentUserId: '2', actions: {updateUserPassword}};
        const wrapper = mountWithIntl(<ResetPasswordModal {...props}/>);

        (wrapper.find('input[type=\'password\']').first().instance() as unknown as HTMLInputElement).value = password;
        wrapper.find('button[type=\'submit\']').first().simulate('click', {preventDefault: jest.fn()});

        expect(updateUserPassword.mock.calls.length).toBe(1);
    });
});
