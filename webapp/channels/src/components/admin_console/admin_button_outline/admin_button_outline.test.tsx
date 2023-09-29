// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import AdminButtonOutline from './admin_button_outline';

describe('components/admin_console/admin_button_outline/AdminButtonOutline', () => {
    test('should match snapshot with prop disable false', () => {
        const onClick = jest.fn();
        const wrapper = shallow(
            <AdminButtonOutline
                onClick={onClick}
                className='admin-btn-default'
                disabled={false}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with prop disable true', () => {
        const onClick = jest.fn();
        const wrapper = shallow(
            <AdminButtonOutline
                onClick={onClick}
                className='admin-btn-default'
                disabled={true}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with children', () => {
        const onClick = jest.fn();
        const wrapper = shallow(
            <AdminButtonOutline
                onClick={onClick}
                className='admin-btn-default'
                disabled={true}
            >
                {'Test children'}
            </AdminButtonOutline>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with className is not provided in scss file', () => {
        const onClick = jest.fn();
        const wrapper = shallow(
            <AdminButtonOutline
                onClick={onClick}
                className='btn-default'
                disabled={true}
            >
                {'Test children'}
            </AdminButtonOutline>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should handle onClick', () => {
        const onClick = jest.fn();
        const wrapper = shallow(
            <AdminButtonOutline
                onClick={onClick}
                className='admin-btn-default'
                disabled={true}
            >
                {'Test children'}
            </AdminButtonOutline>,
        );

        wrapper.find('button').simulate('click');
        expect(onClick).toHaveBeenCalledTimes(1);
    });
});
