// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ComponentProps} from 'react';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';

import ManageAutoResponder from './manage_auto_responder';

describe('components/user_settings/notifications/ManageAutoResponder', () => {
    const requiredProps: ComponentProps<typeof ManageAutoResponder> = {
        autoResponderActive: false,
        autoResponderMessage: 'Hello World!',
        updateSection: jest.fn(),
        setParentState: jest.fn(),
        submit: jest.fn(),
        saving: false,
        error: '',
    };

    test('should match snapshot, default disabled', () => {
        const wrapper = mountWithIntl(<ManageAutoResponder {...requiredProps}/>);

        expect(wrapper).toMatchSnapshot();

        expect(wrapper.find('#autoResponderActive').exists()).toBe(true);
        expect(wrapper.find('#autoResponderMessage').exists()).toBe(false);
    });

    test('should match snapshot, enabled', () => {
        const wrapper = mountWithIntl(
            <ManageAutoResponder
                {...requiredProps}
                autoResponderActive={true}
            />,
        );

        expect(wrapper).toMatchSnapshot();

        expect(wrapper.find('#autoResponderActive').exists()).toBe(true);
        expect(wrapper.find('#autoResponderMessage').exists()).toBe(true);
    });

    test('should pass handleChange', () => {
        const setParentState = jest.fn();
        const wrapper = mountWithIntl(
            <ManageAutoResponder
                {...requiredProps}
                autoResponderActive={true}
                setParentState={setParentState}
            />,
        );

        expect(wrapper.find('#autoResponderActive').exists()).toBe(true);
        expect(wrapper.find('#autoResponderMessageInput').exists()).toBe(true);

        wrapper.find('#autoResponderMessageInput').simulate('change');
        expect(setParentState).toBeCalled();
        expect(setParentState).toBeCalledWith('autoResponderMessage', 'Hello World!');

        wrapper.find('#autoResponderActive').simulate('change');
        expect(setParentState).toBeCalled();
    });
});
