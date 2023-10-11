// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import RadioSetting from 'components/widgets/settings/radio_setting';
import TextSetting from 'components/widgets/settings/text_setting';

import DialogElement from './dialog_element';

describe('components/interactive_dialog/DialogElement', () => {
    const baseDialogProps = {
        displayName: 'Testing',
        name: 'testing',
        type: 'text',
        maxLength: 100,
        actions: {
            autocompleteChannels: jest.fn(),
            autocompleteUsers: jest.fn(),
        },
        onChange: jest.fn(),
    };

    it('subtype blank', () => {
        const wrapper = shallow(
            <DialogElement
                {...baseDialogProps}
                subtype=''
            />,
        );

        expect(wrapper.find(TextSetting).props().type).toEqual('text');
    });

    it('subtype email', () => {
        const wrapper = shallow(
            <DialogElement
                {...baseDialogProps}
                subtype='email'
            />,
        );
        expect(wrapper.find(TextSetting).props().type).toEqual('email');
    });

    it('subtype password', () => {
        const wrapper = shallow(
            <DialogElement
                {...baseDialogProps}
                subtype='password'
            />,
        );
        expect(wrapper.find(TextSetting).props().type).toEqual('password');
    });

    describe('radioSetting', () => {
        const radioOptions = [
            {value: 'foo', text: 'foo-text'},
            {value: 'bar', text: 'bar-text'},
        ];

        test('RadioSetting is rendered when type is radio', () => {
            const wrapper = shallow(
                <DialogElement
                    {...baseDialogProps}
                    type='radio'
                    options={radioOptions}
                />,
            );

            expect(wrapper.find(RadioSetting).exists()).toBe(true);
        });

        test('RadioSetting is rendered when options are null', () => {
            const wrapper = shallow(
                <DialogElement
                    {...baseDialogProps}
                    type='radio'
                    options={undefined}
                />,
            );

            expect(wrapper.find(RadioSetting).exists()).toBe(true);
        });

        test('RadioSetting is rendered when options are null and value is null', () => {
            const wrapper = shallow(
                <DialogElement
                    {...baseDialogProps}
                    type='radio'
                    options={undefined}
                    value={undefined}
                />,
            );

            expect(wrapper.find(RadioSetting).exists()).toBe(true);
        });

        test('RadioSetting is rendered when options are null and value is not null', () => {
            const wrapper = shallow(
                <DialogElement
                    {...baseDialogProps}
                    type='radio'
                    options={undefined}
                    value={'a'}
                />,
            );

            expect(wrapper.find(RadioSetting).exists()).toBe(true);
        });

        test('RadioSetting is rendered when value is not one of the options', () => {
            const wrapper = shallow(
                <DialogElement
                    {...baseDialogProps}
                    type='radio'
                    options={radioOptions}
                    value={'a'}
                />,
            );

            expect(wrapper.find(RadioSetting).exists()).toBe(true);
        });

        test('No default value is selected from the radio button list', () => {
            const wrapper = shallow(
                <DialogElement
                    {...baseDialogProps}
                    type='radio'
                    options={radioOptions}
                />,
            );
            const instance = wrapper.instance() as DialogElement;
            expect(instance.props.value).toBeUndefined();
        });

        test('The default value can be specified from the list', () => {
            const wrapper = shallow(
                <DialogElement
                    {...baseDialogProps}
                    type='radio'
                    options={radioOptions}
                    value={radioOptions[1].value}
                />,
            );
            expect(wrapper.find({options: radioOptions, value: radioOptions[1].value}).exists()).toBe(true);
        });
    });
});
