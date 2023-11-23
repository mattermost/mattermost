// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import LoginMfa from 'components/login/login_mfa';
import SaveButton from 'components/save_button';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';

describe('components/login/LoginMfa', () => {
    const baseProps = {
        loginId: 'login_id',
        password: 'password',
        onSubmit: jest.fn(),
    };
    const token = '123456';

    test('should match snapshot', () => {
        const wrapper = shallow(
            <LoginMfa {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should handle token entered', () => {
        const wrapper = mountWithIntl(
            <LoginMfa {...baseProps}/>,
        );

        let input = wrapper.find('input').first();
        expect(input.props().disabled).toEqual(false);

        let button = wrapper.find(SaveButton).first();
        expect(button.props().disabled).toEqual(true);

        input.simulate('change', {target: {value: token}});

        button = wrapper.find(SaveButton).first();
        expect(button.props().disabled).toEqual(false);

        input = wrapper.find('input').first();
        expect(input.props().value).toEqual(token);
    });

    test('should handle submit', () => {
        const wrapper = mountWithIntl(
            <LoginMfa {...baseProps}/>,
        );

        let input = wrapper.find('input').first();
        input.simulate('change', {target: {value: token}});

        wrapper.find(SaveButton).simulate('click');

        const saveButton = wrapper.find(SaveButton).first().props();
        expect(saveButton.disabled).toEqual(false);
        expect(saveButton.saving).toEqual(true);

        input = wrapper.find('input').first();
        expect(input.props().disabled).toEqual(true);

        expect(baseProps.onSubmit).toHaveBeenCalledWith({loginId: baseProps.loginId, password: baseProps.password, token});
    });
});
