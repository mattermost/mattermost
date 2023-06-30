// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import {AppField} from '@mattermost/types/apps';

import TextSetting from 'components/widgets/settings/text_setting';

import Markdown from 'components/markdown';

import AppsFormField, {Props} from './apps_form_field';
import AppsFormSelectField from './apps_form_select_field';

describe('components/apps_form/apps_form_field/AppsFormField', () => {
    describe('Text elements', () => {
        const textField: AppField = {
            name: 'field1',
            type: 'text',
            max_length: 100,
            modal_label: 'The Field',
            hint: 'The hint',
            description: 'The description',
            is_required: true,
        };

        const baseDialogTextProps: Props = {
            name: 'testing',
            actions: {
                autocompleteChannels: jest.fn(),
                autocompleteUsers: jest.fn(),
            },
            field: textField,
            value: '',
            onChange: () => {},
            performLookup: jest.fn(),
        };

        const baseTextSettingProps = {
            inputClassName: '',
            label: (
                <React.Fragment>
                    {textField.modal_label}
                    {false}
                </React.Fragment>
            ),
            maxLength: 100,
            placeholder: 'The hint',
            resizable: false,
            type: 'input',
            value: '',
            id: baseDialogTextProps.name,
            helpText: (<Markdown message='The description'/>),
            onChange: jest.fn(),
        };

        it('subtype blank - optional field', () => {
            const wrapper = shallow(
                <AppsFormField
                    {...baseDialogTextProps}
                    field={{
                        ...textField,
                        label: '',
                        is_required: false,
                    }}
                />,
            );
            expect(wrapper.matchesElement(
                <TextSetting
                    {...baseTextSettingProps}
                    label={(
                        <React.Fragment>
                            {textField.modal_label}
                            {<span className='light'>{' (optional)'}</span>}
                        </React.Fragment>
                    )}
                    type='input'
                />,
            )).toEqual(true);
        });

        it('subtype blank', () => {
            const wrapper = shallow(
                <AppsFormField
                    {...baseDialogTextProps}
                />,
            );

            expect(wrapper.matchesElement(
                <TextSetting
                    {...baseTextSettingProps}
                    type='input'
                />,
            )).toEqual(true);
        });

        it('subtype email', () => {
            const wrapper = shallow(
                <AppsFormField
                    {...baseDialogTextProps}
                    field={{
                        ...textField,
                        subtype: 'email',
                    }}
                />,
            );
            expect(wrapper.matchesElement(
                <TextSetting
                    {...baseTextSettingProps}
                    type='email'
                />,
            )).toEqual(true);
        });

        it('subtype invalid', () => {
            const wrapper = shallow(
                <AppsFormField
                    {...baseDialogTextProps}
                    field={{
                        ...textField,
                        subtype: 'invalid',
                    }}
                />,
            );
            expect(wrapper.matchesElement(
                <TextSetting
                    {...baseTextSettingProps}
                    type='input'
                />,
            )).toEqual(true);
        });

        it('subtype password', () => {
            const wrapper = shallow(
                <AppsFormField
                    {...baseDialogTextProps}
                    field={{
                        ...textField,
                        subtype: 'password',
                    }}
                />,
            );
            expect(wrapper.matchesElement(
                <TextSetting
                    {...baseTextSettingProps}
                    type='password'
                />,
            )).toEqual(true);
        });
    });

    describe('Select elements', () => {
        const selectField: AppField = {
            name: 'field1',
            type: 'static_select',
            max_length: 100,
            modal_label: 'The Field',
            hint: 'The hint',
            description: 'The description',
            is_required: true,
            options: [],
        };

        const baseDialogSelectProps: Props = {
            name: 'testing',
            actions: {
                autocompleteChannels: jest.fn(),
                autocompleteUsers: jest.fn(),
            },
            field: selectField,
            value: null,
            onChange: () => {},
            performLookup: jest.fn(),
        };

        const options = [
            {value: 'foo', label: 'foo-text'},
            {value: 'bar', label: 'bar-text'},
        ];

        test('AppsFormSelectField is rendered when type is static_select', () => {
            const wrapper = shallow(
                <AppsFormField
                    {...baseDialogSelectProps}
                    field={{
                        ...selectField,
                        type: 'static_select',
                        options,
                    }}
                    onChange={jest.fn()}
                />,
            );

            expect(wrapper.find(AppsFormSelectField).exists()).toBe(true);
        });

        test('AppsFormSelectField is rendered when type is dynamic_select', () => {
            const wrapper = shallow(
                <AppsFormField
                    {...baseDialogSelectProps}
                    field={{
                        ...selectField,
                        type: 'dynamic_select',
                        options,
                    }}
                    onChange={jest.fn()}
                />,
            );

            expect(wrapper.find(AppsFormSelectField).exists()).toBe(true);
        });

        test('AppsFormSelectField is used when field type is user', () => {
            const wrapper = shallow(
                <AppsFormField
                    {...baseDialogSelectProps}
                    field={{
                        ...selectField,
                        type: 'user',
                    }}
                    onChange={jest.fn()}
                />,
            );

            expect(wrapper.find(AppsFormSelectField).exists()).toBe(true);
        });

        test('AppsFormSelectField is used when field type is channel', () => {
            const wrapper = shallow(
                <AppsFormField
                    {...baseDialogSelectProps}
                    field={{
                        ...selectField,
                        type: 'channel',
                    }}
                    onChange={jest.fn()}
                />,
            );

            expect(wrapper.find(AppsFormSelectField).exists()).toBe(true);
        });

        test('AppSelectForm is rendered when options are undefined', () => {
            const wrapper = shallow(
                <AppsFormField
                    {...baseDialogSelectProps}
                    field={{
                        ...selectField,
                        type: 'static_select',
                        options: undefined,
                    }}
                    onChange={jest.fn()}
                />,
            );

            expect(wrapper.find(AppsFormSelectField).exists()).toBe(true);
        });

        test('AppsFormSelectField is rendered when options are null and value is null', () => {
            const wrapper = shallow(
                <AppsFormField
                    {...baseDialogSelectProps}
                    field={{
                        ...selectField,
                        type: 'static_select',
                        options: undefined,
                    }}
                    value={null}
                    onChange={jest.fn()}
                />,
            );

            expect(wrapper.find(AppsFormSelectField).exists()).toBe(true);
        });

        test('AppsFormSelectField is rendered when options are null and value is not null', () => {
            const wrapper = shallow(
                <AppsFormField
                    {...baseDialogSelectProps}
                    field={{
                        ...selectField,
                        type: 'static_select',
                        options: undefined,
                    }}
                    value={options[0]}
                    onChange={jest.fn()}
                />,
            );

            expect(wrapper.find(AppsFormSelectField).exists()).toBe(true);
        });

        test('AppsFormSelectField is rendered when value is not one of the options', () => {
            const wrapper = shallow(
                <AppsFormField
                    {...baseDialogSelectProps}
                    field={{
                        ...selectField,
                        type: 'static_select',
                        options,
                    }}
                    value={{label: 'Other', value: 'other'}}
                    onChange={jest.fn()}
                />,
            );

            expect(wrapper.find(AppsFormSelectField).exists()).toBe(true);
        });

        test('No default value is selected from the options list', () => {
            const wrapper = shallow(
                <AppsFormField
                    {...baseDialogSelectProps}
                    field={{
                        ...selectField,
                        type: 'static_select',
                        options,
                    }}
                    onChange={jest.fn()}
                />,
            );
            expect(wrapper.find(AppsFormSelectField).prop('value')).toBeNull();
        });

        test('The default value can be specified from the list', () => {
            const wrapper = shallow(
                <AppsFormField
                    {...baseDialogSelectProps}
                    field={{
                        ...selectField,
                        type: 'static_select',
                        options,
                    }}
                    value={options[1]}
                    onChange={jest.fn()}
                />,
            );
            expect(wrapper.find(AppsFormSelectField).prop('value')).toBe(options[1]);
        });
    });
});
