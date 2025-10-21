// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import ConfirmModal from './confirm_modal';

describe('ConfirmModal', () => {
    const baseProps = {
        show: true,
        onConfirm: jest.fn(),
        onCancel: jest.fn(),
    };

    test('should pass checkbox state when confirm is pressed', () => {
        const props = {
            ...baseProps,
            showCheckbox: true,
        };

        const wrapper = shallow(<ConfirmModal {...props}/>);

        expect(wrapper.state('checked')).toBe(false);
        expect(wrapper.find('input[type="checkbox"]').prop('checked')).toBe(false);
        expect(wrapper.find('input[type="checkbox"]').exists()).toBe(true);

        wrapper.find('#confirmModalButton').simulate('click');

        expect(props.onConfirm).toHaveBeenCalledWith(false);

        wrapper.find('input[type="checkbox"]').simulate('change', {target: {checked: true}});

        expect(wrapper.state('checked')).toBe(true);
        expect(wrapper.find('input[type="checkbox"]').prop('checked')).toBe(true);

        wrapper.find('#confirmModalButton').simulate('click');

        expect(props.onConfirm).toHaveBeenCalledWith(true);
    });

    test('should pass checkbox state when cancel is pressed', () => {
        const props = {
            ...baseProps,
            showCheckbox: true,
        };

        const wrapper = shallow(<ConfirmModal {...props}/>);

        expect(wrapper.state('checked')).toBe(false);
        expect(wrapper.find('input[type="checkbox"]').prop('checked')).toBe(false);
        expect(wrapper.find('input[type="checkbox"]').exists()).toBe(true);

        wrapper.find('#cancelModalButton').simulate('click');

        expect(props.onCancel).toHaveBeenCalledWith(false);

        wrapper.find('input[type="checkbox"]').simulate('change', {target: {checked: true}});

        expect(wrapper.state('checked')).toBe(true);
        expect(wrapper.find('input[type="checkbox"]').prop('checked')).toBe(true);

        wrapper.find('#cancelModalButton').simulate('click');

        expect(props.onCancel).toHaveBeenCalledWith(true);
    });

    test('should disable confirm button when confirmDisabled is true', () => {
        const props = {
            ...baseProps,
            confirmDisabled: true,
        };

        const wrapper = shallow(<ConfirmModal {...props}/>);
        const confirmButton = wrapper.find('#confirmModalButton');

        expect(confirmButton.prop('disabled')).toBe(true);
    });

    test('should enable confirm button when confirmDisabled is false', () => {
        const props = {
            ...baseProps,
            confirmDisabled: false,
        };

        const wrapper = shallow(<ConfirmModal {...props}/>);
        const confirmButton = wrapper.find('#confirmModalButton');

        expect(confirmButton.prop('disabled')).toBe(false);
    });

    test('should use custom checkbox class when provided', () => {
        const props = {
            ...baseProps,
            showCheckbox: true,
            checkboxClass: 'custom-checkbox-class',
        };

        const wrapper = shallow(<ConfirmModal {...props}/>);
        const checkboxContainer = wrapper.find('.custom-checkbox-class');

        expect(checkboxContainer.exists()).toBe(true);
    });

    test('should call onCheckboxChange when checkbox is changed', () => {
        const mockOnCheckboxChange = jest.fn();
        const props = {
            ...baseProps,
            showCheckbox: true,
            onCheckboxChange: mockOnCheckboxChange,
        };

        const wrapper = shallow(<ConfirmModal {...props}/>);
        const checkbox = wrapper.find('input[type="checkbox"]');

        checkbox.simulate('change', {target: {checked: true}});

        expect(mockOnCheckboxChange).toHaveBeenCalledWith(true);
        expect(wrapper.state('checked')).toBe(true);
    });
});
