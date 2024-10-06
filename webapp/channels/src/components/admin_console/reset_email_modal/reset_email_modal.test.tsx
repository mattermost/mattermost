// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {UserProfile} from '@mattermost/types/users';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import {TestHelper} from 'utils/test_helper';

import ResetEmailModal from './reset_email_modal';

describe('components/admin_console/reset_email_modal/reset_email_modal.tsx', () => {
    const user: UserProfile = TestHelper.getUserMock({
        email: 'arvin.darmawan@gmail.com',
    });

    const baseProps = {
        actions: {patchUser: jest.fn(() => Promise.resolve({}))},
        user,
        currentUserId: 'random_user_id',
        onHide: jest.fn(),
        onSuccess: jest.fn(),
        onExited: jest.fn(),
    };

    test('should match snapshot when not the current user', () => {
        const wrapper = shallow(<ResetEmailModal {...baseProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when there is no user', () => {
        const props = {...baseProps, user: undefined};
        const wrapper = shallow(<ResetEmailModal {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when the current user', () => {
        const props = {...baseProps, currentUserId: user.id};
        const wrapper = shallow(<ResetEmailModal {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should not update email since the email is empty', () => {
        const wrapper = mountWithIntl(<ResetEmailModal {...baseProps}/>);

        (wrapper.find('input[type=\'email\']').first().instance() as unknown as HTMLInputElement).value = '';
        wrapper.find('button[type=\'submit\']').first().simulate('click', {preventDefault: jest.fn()});

        expect(baseProps.actions.patchUser.mock.calls.length).toBe(0);
        expect(wrapper.state('error')).toStrictEqual(
            <FormattedMessage
                id='user.settings.general.validEmail'
                defaultMessage='Please enter a valid email address.'
            />,
        );
    });

    test('should not update email since the email is invalid', () => {
        const wrapper = mountWithIntl(<ResetEmailModal {...baseProps}/>);

        (wrapper.find('input[type=\'email\']').first().instance() as unknown as HTMLInputElement).value = 'invalid-email';
        wrapper.find('button[type=\'submit\']').first().simulate('click', {preventDefault: jest.fn()});

        expect(baseProps.actions.patchUser.mock.calls.length).toBe(0);
        expect(wrapper.state('error')).toStrictEqual(
            <FormattedMessage
                id='user.settings.general.validEmail'
                defaultMessage='Please enter a valid email address.'
            />,
        );
    });

    test('should require password when updating email of the current user', () => {
        const props = {...baseProps, currentUserId: user.id};
        const wrapper = mountWithIntl(<ResetEmailModal {...props}/>);

        (wrapper.find('input[type=\'email\']').first().instance() as unknown as HTMLInputElement).value = 'currentUser@test.com';
        wrapper.find('button[type=\'submit\']').first().simulate('click', {preventDefault: jest.fn()});

        expect(baseProps.actions.patchUser.mock.calls.length).toBe(0);
        expect(wrapper.state('error')).toStrictEqual(
            <FormattedMessage
                id='admin.reset_email.missing_current_password'
                defaultMessage='Please enter your current password.'
            />,
        );
    });

    test('should update email since the email is valid of the another user', () => {
        const wrapper = mountWithIntl(<ResetEmailModal {...baseProps}/>);

        (wrapper.find('input[type=\'email\']').first().instance() as unknown as HTMLInputElement).value = 'user@test.com';
        wrapper.find('button[type=\'submit\']').first().simulate('click', {preventDefault: jest.fn()});

        expect(baseProps.actions.patchUser.mock.calls.length).toBe(1);
        expect(wrapper.state('error')).toBeNull();
    });

    test('should update email since the email is valid of the current user', () => {
        const props = {...baseProps, currentUserId: user.id};
        const wrapper = mountWithIntl(<ResetEmailModal {...props}/>);

        (wrapper.find('input[type=\'email\']').first().instance() as unknown as HTMLInputElement).value = 'currentUser@test.com';
        (wrapper.find('input[type=\'password\']').first().instance() as unknown as HTMLInputElement).value = 'password';
        wrapper.find('button[type=\'submit\']').first().simulate('click', {preventDefault: jest.fn()});

        expect(baseProps.actions.patchUser.mock.calls.length).toBe(1);
        expect(wrapper.state('error')).toBeNull();
    });
});
