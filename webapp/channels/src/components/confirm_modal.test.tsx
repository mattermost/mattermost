// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import Button from './button/button';
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

        wrapper.find(Button).filter({'data-testid': 'confirm-button'}).simulate('click');

        expect(props.onConfirm).toHaveBeenCalledWith(false);

        wrapper.find('input[type="checkbox"]').simulate('change', {target: {checked: true}});

        expect(wrapper.state('checked')).toBe(true);
        expect(wrapper.find('input[type="checkbox"]').prop('checked')).toBe(true);

        wrapper.find(Button).filter({'data-testid': 'confirm-button'}).simulate('click');

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

        wrapper.find(Button).filter({'data-testid': 'cancel-button'}).simulate('click');

        expect(props.onCancel).toHaveBeenCalledWith(false);

        wrapper.find('input[type="checkbox"]').simulate('change', {target: {checked: true}});

        expect(wrapper.state('checked')).toBe(true);
        expect(wrapper.find('input[type="checkbox"]').prop('checked')).toBe(true);

        wrapper.find(Button).filter({'data-testid': 'cancel-button'}).simulate('click');

        expect(props.onCancel).toHaveBeenCalledWith(true);
    });
});
