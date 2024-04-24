// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import {Modal} from 'react-bootstrap';
import {Provider} from 'react-redux';

import type {DialogElement as TDialogElement} from '@mattermost/types/integrations';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import mockStore from 'tests/test_store';
import EmojiMap from 'utils/emoji_map';

import type {Props} from './interactive_dialog';
import InteractiveDialog from './interactive_dialog';

const submitEvent = {
    preventDefault: jest.fn(),
} as unknown as React.FormEvent<HTMLFormElement>;

describe('components/interactive_dialog/InteractiveDialog', () => {
    const baseProps: Props = {
        url: 'http://example.com',
        callbackId: 'abc',
        elements: [],
        title: 'test title',
        iconUrl: 'http://example.com/icon.png',
        submitLabel: 'Yes',
        notifyOnCancel: true,
        state: 'some state',
        introductionText: 'Some introduction text',
        onExited: jest.fn(),
        actions: {
            submitInteractiveDialog: jest.fn(),
        },
        emojiMap: new EmojiMap(new Map()),
    };

    describe('generic error message', () => {
        test('should appear when submit returns an error', async () => {
            const props = {
                ...baseProps,
                actions: {
                    submitInteractiveDialog: jest.fn().mockResolvedValue({data: {error: 'This is an error.'}}),
                },
            };
            const wrapper = shallow<InteractiveDialog>(<InteractiveDialog {...props}/>);

            await wrapper.instance().handleSubmit(submitEvent);

            const expected = (
                <div className='error-text'>
                    {'This is an error.'}
                </div>
            );
            expect(wrapper.find(Modal.Footer).containsMatchingElement(expected)).toBe(true);
        });

        test('should not appear when submit does not return an error', async () => {
            const wrapper = shallow<InteractiveDialog>(<InteractiveDialog {...baseProps}/>);
            await wrapper.instance().handleSubmit(submitEvent);

            expect(wrapper.find(Modal.Footer).exists('.error-text')).toBe(false);
        });
    });

    describe('default select element in Interactive Dialog', () => {
        test('should be enabled by default', () => {
            const selectElement: TDialogElement = {
                data_source: '',
                default: 'opt3',
                display_name: 'Option Selector',
                name: 'someoptionselector',
                optional: false,
                options: [
                    {text: 'Option1', value: 'opt1'},
                    {text: 'Option2', value: 'opt2'},
                    {text: 'Option3', value: 'opt3'},
                ],
                type: 'select',
                subtype: '',
                placeholder: '',
                help_text: '',
                min_length: 0,
                max_length: 0,
            };

            const {elements, ...rest} = baseProps;
            elements?.push(selectElement);
            const props = {
                ...rest,
                elements,
            };

            const store = mockStore({});
            const wrapper = mountWithIntl(
                <Provider store={store}>
                    <InteractiveDialog {...props}/>
                </Provider>,
            );
            expect(wrapper.find(Modal.Body).find('input').find({defaultValue: 'Option3'}).exists()).toBe(true);
        });
    });

    describe('bool element in Interactive Dialog', () => {
        const element: TDialogElement = {
            data_source: '',
            display_name: 'Boolean Selector',
            name: 'somebool',
            optional: false,
            type: 'bool',
            placeholder: 'Subscribe?',
            subtype: '',
            default: '',
            help_text: '',
            min_length: 0,
            max_length: 0,
            options: [],
        };
        const {elements, ...rest} = baseProps;
        const props = {
            ...rest,
            elements: [
                ...elements || [],
                element,
            ],
        };

        const testCases = [
            {description: 'no default', expectedChecked: false},
            {description: 'unknown default', default: 'unknown', expectedChecked: false},
            {description: 'default of "false"', default: 'false', expectedChecked: false},
            {description: 'default of true', default: true, expectedChecked: true},
            {description: 'default of "true"', default: 'True', expectedChecked: true},
            {description: 'default of "True"', default: 'True', expectedChecked: true},
            {description: 'default of "TRUE"', default: 'TRUE', expectedChecked: true},
        ];

        testCases.forEach((testCase) => test(`should interpret ${testCase.description}`, () => {
            if (testCase.default === undefined) {
                delete (element as any).default;
            } else {
                (element as any).default = testCase.default;
            }

            const store = mockStore({});
            const wrapper = mountWithIntl(
                <Provider store={store}>
                    <InteractiveDialog {...props}/>
                </Provider>,
            );
            expect(wrapper.find(Modal.Body).find('input').find({checked: testCase.expectedChecked}).exists()).toBe(true);
        }));
    });
});
