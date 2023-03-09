// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Provider} from 'react-redux';
import {shallow} from 'enzyme';

import {Modal} from 'react-bootstrap';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import mockStore from 'tests/test_store';

import {AppCallResponseTypes} from 'mattermost-redux/constants/apps';

import Markdown from 'components/markdown';

import {AppsForm, Props} from './apps_form_component';

describe('AppsFormComponent', () => {
    const baseProps: Props = {
        intl: {} as any,
        onExited: jest.fn(),
        isEmbedded: false,
        actions: {
            performLookupCall: jest.fn(),
            refreshOnSelect: jest.fn(),
            submit: jest.fn().mockResolvedValue({
                data: {
                    type: 'ok',
                },
            }),
        },
        form: {
            title: 'Title',
            footer: 'Footer',
            header: 'Header',
            icon: 'Icon',
            submit: {
                path: '/create',
            },
            fields: [
                {
                    name: 'bool1',
                    type: 'bool',
                },
                {
                    name: 'bool2',
                    type: 'bool',
                    value: false,
                },
                {
                    name: 'bool3',
                    type: 'bool',
                    value: true,
                },
                {
                    name: 'text1',
                    type: 'text',
                    value: 'initial text',
                },
                {
                    name: 'select1',
                    type: 'static_select',
                    options: [
                        {label: 'Label1', value: 'Value1'},
                        {label: 'Label2', value: 'Value2'},
                    ],
                    value: {label: 'Label1', value: 'Value1'},
                },
            ],
        },
    };

    test('should set match snapshot', () => {
        const wrapper = shallow<AppsForm>(
            <AppsForm
                {...baseProps}
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should set initial form values', () => {
        const wrapper = shallow<AppsForm>(
            <AppsForm
                {...baseProps}
            />,
        );

        expect(wrapper.state().values).toEqual({
            bool1: false,
            bool2: false,
            bool3: true,
            text1: 'initial text',
            select1: {label: 'Label1', value: 'Value1'},
        });
    });

    test('it should submit and close the modal', async () => {
        const submit = jest.fn().mockResolvedValue({data: {type: 'ok'}});

        const props: Props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                submit,
            },
        };

        const wrapper = shallow<AppsForm>(
            <AppsForm
                {...props}
            />,
        );

        const hide = jest.fn();
        wrapper.instance().handleHide = hide;

        await wrapper.instance().handleSubmit({preventDefault: jest.fn()} as any);

        expect(submit).toHaveBeenCalledWith({
            values: {
                bool1: false,
                bool2: false,
                bool3: true,
                text1: 'initial text',
                select1: {label: 'Label1', value: 'Value1'},
            },
        });
        expect(hide).toHaveBeenCalled();
    });

    describe('generic error message', () => {
        test('should appear when submit returns an error', async () => {
            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    submit: jest.fn().mockResolvedValue({
                        error: {text: 'This is an error.', type: AppCallResponseTypes.ERROR},
                    }),
                },
            };
            const wrapper = shallow<AppsForm>(<AppsForm {...props}/>);

            await wrapper.instance().handleSubmit({preventDefault: jest.fn()} as any);

            const expected = (
                <div className='error-text'>
                    <Markdown message={'This is an error.'}/>
                </div>
            );
            expect(wrapper.find(Modal.Footer).containsMatchingElement(expected)).toBe(true);
        });

        test('should not appear when submit does not return an error', async () => {
            const wrapper = shallow<AppsForm>(<AppsForm {...baseProps}/>);
            await wrapper.instance().handleSubmit({preventDefault: jest.fn()} as any);

            expect(wrapper.find(Modal.Footer).find('.error-text').exists()).toBeFalsy();
        });
    });

    describe('default select element', () => {
        test('should be enabled by default', () => {
            const selectField = {
                type: 'static_select',
                value: {label: 'Option3', value: 'opt3'},
                modal_label: 'Option Selector',
                name: 'someoptionselector',
                is_required: true,
                options: [
                    {label: 'Option1', value: 'opt1'},
                    {label: 'Option2', value: 'opt2'},
                    {label: 'Option3', value: 'opt3'},
                ],
                min_length: 2,
                max_length: 1024,
                hint: '',
                subtype: '',
                description: '',
            };

            const fields = [selectField];
            const props = {
                ...baseProps,
                context: {},
                form: {
                    fields,
                },
            };

            const state = {
                entities: {
                    general: {
                        config: {},
                        license: {},
                    },
                    channels: {
                        channels: {},
                        roles: {},
                    },
                    teams: {
                        teams: {},
                    },
                    posts: {
                        posts: {},
                    },
                    users: {
                        profiles: {},
                    },
                    groups: {
                        myGroups: [],
                    },
                    emojis: {},
                    preferences: {
                        myPreferences: {},
                    },
                },
            };

            const store = mockStore(state);
            const wrapper = mountWithIntl(
                <Provider store={store}>
                    <AppsForm {...props}/>
                </Provider>,
            );
            expect(wrapper.find(Modal.Body).find('div.react-select__single-value').text()).toEqual('Option3');
        });
    });
});
