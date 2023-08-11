// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallow} from 'enzyme';

import ColorInput from './color_input';

describe('components/ColorInput', () => {
    const baseProps = {
        id: 'sidebarBg',
        onChange: jest.fn(),
        value: '#ffffff',
    };

    test('should match snapshot, init', () => {
        const wrapper = shallow(
            <ColorInput {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, opened', () => {
        const wrapper = shallow(
            <ColorInput {...baseProps}/>,
        );

        wrapper.find('.input-group-addon').simulate('click');

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, toggle picker', () => {
        const wrapper = shallow(
            <ColorInput {...baseProps}/>,
        );
        wrapper.find('.input-group-addon').simulate('click');
        wrapper.find('.input-group-addon').simulate('click');

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, click on picker', () => {
        const wrapper = shallow(
            <ColorInput {...baseProps}/>,
        );

        wrapper.find('.input-group-addon').simulate('click');
        wrapper.find('.color-popover').simulate('click');

        expect(wrapper).toMatchSnapshot();
    });

    test('should have match state on togglePicker', () => {
        const wrapper = shallow(
            <ColorInput {...baseProps}/>,
        );

        wrapper.setState({isOpened: true});

        wrapper.find('.input-group-addon').simulate('click');
        expect(wrapper.state('isOpened')).toEqual(false);

        wrapper.find('.input-group-addon').simulate('click');
        expect(wrapper.state('isOpened')).toEqual(true);
    });

    test('should keep what the user types in the textbox until blur', () => {
        const wrapper = shallow(
            <ColorInput {...baseProps}/>,
        );

        baseProps.onChange.mockImplementation((value) => wrapper.setProps({value}));

        wrapper.find('input').simulate('focus', {target: null});
        expect(wrapper.state('focused')).toBe(true);

        wrapper.find('input').simulate('change', {target: {value: '#abc'}});
        expect(wrapper.state('value')).toBe('#abc');
        expect(baseProps.onChange).toHaveBeenLastCalledWith('#aabbcc');
        expect(wrapper.find('input').prop('value')).toEqual('#abc');
        expect(wrapper.find('.color-icon').prop('style')).toHaveProperty('backgroundColor', '#abc');

        wrapper.find('input').simulate('blur');
        expect(wrapper.state('focused')).toBe(false);
        expect(wrapper.state('value')).toBe('#aabbcc');
        expect(baseProps.onChange).toHaveBeenLastCalledWith('#aabbcc');
        expect(wrapper.find('input').prop('value')).toEqual('#aabbcc');
        expect(wrapper.find('.color-icon').prop('style')).toHaveProperty('backgroundColor', '#aabbcc');
    });
});
