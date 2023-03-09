// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {mount, shallow} from 'enzyme';

import SpinnerButton from 'components/spinner_button';

describe('components/SpinnerButton', () => {
    test('should match snapshot with required props', () => {
        const wrapper = shallow(
            <SpinnerButton
                spinning={false}
                spinningText='Test'
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with spinning', () => {
        const wrapper = shallow(
            <SpinnerButton
                spinning={true}
                spinningText='Test'
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with children', () => {
        const wrapper = shallow(
            <SpinnerButton
                spinning={false}
                spinningText='Test'
            >
                <span id='child1'/>
                <span id='child2'/>
            </SpinnerButton>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should handle onClick', () => {
        const onClick = jest.fn();

        const wrapper = mount(
            <SpinnerButton
                spinning={false}
                onClick={onClick}
                spinningText='Test'
            />,
        );

        wrapper.find('button').simulate('click');
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    test('should add properties to underlying button', () => {
        const wrapper = mount(
            <SpinnerButton
                id='my-button-id'
                className='btn btn-success'
                spinningText='Test'
            />,
        );

        const button = wrapper.find('button');

        expect(button).not.toBeUndefined();
        expect(button.type()).toEqual('button');
        expect(button.props().id).toEqual('my-button-id');
        expect(button.hasClass('btn')).toBeTruthy();
        expect(button.hasClass('btn-success')).toBeTruthy();
    });
});
