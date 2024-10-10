// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {mount, shallow} from 'enzyme';
import type {ComponentProps} from 'react';
import React from 'react';

import SpinnerButton from './spinner_button';

function getBaseProps(): ComponentProps<typeof SpinnerButton> {
    return {
        emphasis: 'primary',
        idleText: 'Idle',
        spinningText: 'Spinning',
    };
}

describe('components/SpinnerButton', () => {
    test('should match snapshot with required props', () => {
        const wrapper = shallow(
            <SpinnerButton
                {...getBaseProps()}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with spinning', () => {
        const wrapper = shallow(
            <SpinnerButton
                {...getBaseProps()}
                spinning={true}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should handle onClick', () => {
        const onClick = jest.fn();

        const wrapper = mount(
            <SpinnerButton
                {...getBaseProps()}
                onClick={onClick}
            />,
        );

        wrapper.find('button').simulate('click');
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    test('should add properties to underlying button', () => {
        const wrapper = mount(
            <SpinnerButton
                {...getBaseProps()}
                testId='my-button-id'
                emphasis='tertiary'
            />,
        );

        const button = wrapper.find('button');

        expect(button).not.toBeUndefined();
        expect(button.type()).toEqual('button');
        expect((button.props() as any)['data-testid']).toEqual('my-button-id');
        expect(button.hasClass('btn')).toBeTruthy();
        expect(button.hasClass('btn-tertiary')).toBeTruthy();
    });
});
