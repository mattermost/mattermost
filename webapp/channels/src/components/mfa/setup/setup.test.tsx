// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import Setup from 'components/mfa/setup/setup';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import {TestHelper} from 'utils/test_helper';

jest.mock('actions/global_actions', () => ({
    redirectUserToDefaultTeam: jest.fn(),
}));

describe('components/mfa/setup', () => {
    const user = TestHelper.getUserMock();
    const generateMfaSecret = jest.fn().mockImplementation(() => Promise.resolve({data: {secret: 'generated secret', qr_code: 'qrcode'}}));
    const activateMfa = jest.fn().mockImplementation(() => Promise.resolve({data: {}}));
    const baseProps = {
        state: {enforceMultifactorAuthentication: false},
        updateParent: jest.fn(),
        currentUser: user,
        siteName: 'test',
        enforceMultifactorAuthentication: false,
        actions: {
            activateMfa,
            generateMfaSecret,
        },
        history: {push: jest.fn()},
    };

    test('should match snapshot without required text', async () => {
        const wrapper = shallow<Setup>(
            <Setup {...baseProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
        const requiredText = wrapper.find('#mfa.setup.required_mfa');
        expect(requiredText).not.toBeFalsy();
    });

    test('should match snapshot with required text', async () => {
        const props = {
            ...baseProps,
            enforceMultifactorAuthentication: true,
        };

        const wrapper = shallow<Setup>(
            <Setup {...props}/>,
        );
        const requiredText = wrapper.find('#mfa.setup.required_mfa');
        expect(requiredText).toBeDefined();
    });

    test('should set state after calling component did mount', async () => {
        const wrapper = shallow<Setup>(
            <Setup {...baseProps}/>,
        );
        expect(generateMfaSecret).toBeCalled();
        await wrapper.instance().componentDidMount();
        expect(wrapper.state('secret')).toEqual('generated secret');
        expect(wrapper.state('qrCode')).toEqual('qrcode');
    });

    test('should call activateMfa on submission', async () => {
        const wrapper = mountWithIntl(
            <Setup {...baseProps}/>,
        );

        (wrapper.instance() as Setup).input.current!.value = 'testcodeinput';
        wrapper.find('form').simulate('submit', {preventDefault: () => {}});
        expect(baseProps.actions.activateMfa).toBeCalledWith('testcodeinput');
    });

    test('should focus input when code is empty', async () => {
        const wrapper = mountWithIntl(
            <Setup {...baseProps}/>,
        );
        const input = wrapper.find('input').getDOMNode() as HTMLInputElement;
        const focusSpy = jest.spyOn(input, 'focus');

        wrapper.find('form').simulate('submit', {preventDefault: () => {}});
        expect(focusSpy).toHaveBeenCalled();
    });

    test('should focus input when authentication fails', async () => {
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                activateMfa: jest.fn().mockImplementation(() => Promise.resolve({
                    error: {
                        server_error_id: 'ent.mfa.activate.authenticate.app_error',
                        message: 'Invalid code',
                    },
                })),
            },
        };

        const wrapper = mountWithIntl(
            <Setup {...props}/>,
        );
        const input = wrapper.find('input').getDOMNode() as HTMLInputElement;
        const focusSpy = jest.spyOn(input, 'focus');

        (wrapper.instance() as Setup).input.current!.value = 'invalidcode';
        wrapper.find('form').simulate('submit', {preventDefault: () => {}});
        await new Promise((resolve) => setTimeout(resolve, 0)); // Wait for state update
        expect(focusSpy).toHaveBeenCalled();
    });
});
