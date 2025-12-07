// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import ColorInput from './color_input';

describe('components/ColorInput', () => {
    const baseProps = {
        id: 'sidebarBg',
        onChange: jest.fn(),
        value: '#ffffff',
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

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

    test('should toggle picker on click', () => {
        const wrapper = shallow(
            <ColorInput {...baseProps}/>,
        );

        // Initially picker should not be shown
        expect(wrapper.find('.color-popover').exists()).toBe(false);

        // Click to open
        wrapper.find('.input-group-addon').simulate('click');
        expect(wrapper.find('.color-popover').exists()).toBe(true);

        // Click to close
        wrapper.find('.input-group-addon').simulate('click');
        expect(wrapper.find('.color-popover').exists()).toBe(false);

        // Click to open again
        wrapper.find('.input-group-addon').simulate('click');
        expect(wrapper.find('.color-popover').exists()).toBe(true);
    });

    test('should keep what the user types in the textbox until blur', () => {
        const onChange = jest.fn();
        const wrapper = shallow(
            <ColorInput
                {...baseProps}
                onChange={onChange}
            />,
        );

        // Simulate focus with proper event target
        wrapper.find('input').first().simulate('focus', {target: {value: '#ffffff', setSelectionRange: jest.fn()}});

        // Type a short hex color
        wrapper.find('input').first().simulate('change', {target: {value: '#abc'}});
        expect(onChange).toHaveBeenLastCalledWith('#aabbcc');
        expect(wrapper.find('input').first().prop('value')).toEqual('#abc');
        expect(wrapper.find('.color-icon').prop('style')).toHaveProperty('backgroundColor', '#abc');

        // On blur, the value should normalize
        wrapper.find('input').first().simulate('blur');
        expect(onChange).toHaveBeenLastCalledWith('#aabbcc');
        expect(wrapper.find('input').first().prop('value')).toEqual('#aabbcc');
        expect(wrapper.find('.color-icon').prop('style')).toHaveProperty('backgroundColor', '#aabbcc');
    });

    test('should call onChange when color picker changes', () => {
        const onChange = jest.fn();
        const wrapper = shallow(
            <ColorInput
                {...baseProps}
                onChange={onChange}
            />,
        );

        // Open the picker
        wrapper.find('.input-group-addon').simulate('click');

        // Get the color picker inside .color-popover and call its onChange prop directly
        // (shallow render renders HexColorPicker as 'Component')
        const popover = wrapper.find('.color-popover');
        expect(popover.exists()).toBe(true);
        const picker = popover.childAt(0);
        const onChangeProp = picker.prop('onChange') as (color: string) => void;
        onChangeProp('#ff0000');
        expect(onChange).toHaveBeenCalledWith('#ff0000');
    });

    test('should revert to prop value on blur if invalid color entered', () => {
        const onChange = jest.fn();
        const wrapper = shallow(
            <ColorInput
                {...baseProps}
                value='#ffffff'
                onChange={onChange}
            />,
        );

        // Focus and type invalid color (provide proper event target)
        wrapper.find('input').first().simulate('focus', {target: {value: '#ffffff', setSelectionRange: jest.fn()}});
        wrapper.find('input').first().simulate('change', {target: {value: 'invalid'}});

        // On blur, should revert to original value
        wrapper.find('input').first().simulate('blur');
        expect(wrapper.find('input').first().prop('value')).toEqual('#ffffff');
    });
});
