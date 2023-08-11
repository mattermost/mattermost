// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {mount} from 'enzyme';

import {QuickInput} from './quick_input';

describe('components/QuickInput', () => {
    test.each([
        ['in default state', {}],
        ['when not clearable', {value: 'value', clearable: false, onClear: () => {}}],
        ['when no onClear callback', {value: 'value', clearable: true}],
        ['when value undefined', {clearable: true, onClear: () => {}}],
        ['when value empty', {value: '', clearable: true, onClear: () => {}}],
    ])('should not render clear button', (description, props) => {
        const wrapper = mount(
            <QuickInput {...props}/>,
        );

        expect(wrapper.find('.input-clear').exists()).toBe(false);
    });

    describe('should render clear button', () => {
        test('with default tooltip text', () => {
            const wrapper = mount(
                <QuickInput
                    value='mock'
                    clearable={true}
                    onClear={() => {}}
                />,
            );

            expect(wrapper.find('.input-clear')).toMatchSnapshot();
        });

        test('with customized tooltip text', () => {
            const wrapper = mount(
                <QuickInput
                    value='mock'
                    clearable={true}
                    clearableTooltipText='Custom'
                    onClear={() => {}}
                />,
            );

            expect(wrapper.find('.input-clear')).toMatchSnapshot();
        });

        test('with customized tooltip component', () => {
            const wrapper = mount(
                <QuickInput
                    value='mock'
                    clearable={true}
                    clearableTooltipText={
                        <span>{'Custom'}</span>
                    }
                    onClear={() => {}}
                />,
            );

            expect(wrapper.find('.input-clear')).toMatchSnapshot();
        });
    });

    test('should dismiss clear button', () => {
        const focusFn = jest.fn();
        class MockComp extends React.PureComponent {
            focus = focusFn;
            render() {
                return <div/>;
            }
        }
        const wrapper = mount(
            <QuickInput
                value='mock'
                clearable={true}
                onClear={() => {}}
                inputComponent={MockComp}
            />,
        );

        wrapper.setProps({onClear: () => wrapper.setProps({value: ''})});
        expect(wrapper.find('.input-clear').exists()).toBe(true);

        wrapper.find('.input-clear').simulate('mousedown');
        expect(wrapper.find('.input-clear').exists()).toBe(false);
        expect(focusFn).toBeCalled();
    });
});
