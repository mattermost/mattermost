// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import {AppCallResponseTypes} from 'mattermost-redux/constants/apps';

import InteractiveDialogAdapter from './interactive_dialog_adapter';

jest.mock('./apps_form/apps_form_container', () => {
    return jest.fn(() => <div id='apps_form_container'/>);
});

describe('InteractiveDialogAdapter', () => {
    const baseProps = {
        url: 'https://example.com/dialog',
        callbackId: 'callback123',
        elements: [
            {
                display_name: 'Display Name',
                name: 'text_field',
                type: 'text',
                default: 'default value',
                max_length: 100,
                min_length: 0,
            },
            {
                display_name: 'Select Field',
                name: 'select_field',
                type: 'select',
                options: [
                    {text: 'Option 1', value: 'opt1'},
                    {text: 'Option 2', value: 'opt2'},
                ],
                default: 'opt1',
            },
        ],
        title: 'Dialog Title',
        introductionText: 'Introduction Text',
        iconUrl: 'https://example.com/icon.png',
        submitLabel: 'Submit',
        notifyOnCancel: true,
        state: 'somestate',
        actions: {
            submitInteractiveDialog: jest.fn().mockResolvedValue({data: {}}),
            lookupInteractiveDialog: jest.fn().mockResolvedValue({
                data: {
                    items: [
                        {text: 'Lookup Option 1', value: 'lookup1'},
                        {text: 'Lookup Option 2', value: 'lookup2'},
                    ],
                },
            }),
            doAppFetchForm: jest.fn(),
            postEphemeralCallResponseForContext: jest.fn(),
        },
    };

    test('should convert dialog elements to app fields correctly', () => {
        const wrapper = shallow(<InteractiveDialogAdapter {...baseProps}/>);
        const instance = wrapper.instance() as InteractiveDialogAdapter;
        
        const fields = instance.convertElementsToFields(baseProps.elements);
        
        expect(fields).toHaveLength(2);
        
        // Text field
        expect(fields[0]).toEqual(expect.objectContaining({
            name: 'text_field',
            type: 'text',
            modal_label: 'Display Name',
            value: 'default value',
            max_length: 100,
            min_length: 0,
        }));
        
        // Select field
        expect(fields[1]).toEqual(expect.objectContaining({
            name: 'select_field',
            type: 'static_select',
            modal_label: 'Select Field',
            options: [
                {label: 'Option 1', value: 'opt1'},
                {label: 'Option 2', value: 'opt2'},
            ],
        }));
    });

    test('should convert dynamic select elements correctly', () => {
        const dynamicElements = [
            {
                display_name: 'Dynamic Select',
                name: 'dynamic_select',
                type: 'select',
                data_source: 'dynamic',
                data_source_url: 'https://example.com/options',
            },
        ];
        
        const props = {...baseProps, elements: dynamicElements};
        const wrapper = shallow(<InteractiveDialogAdapter {...props}/>);
        const instance = wrapper.instance() as InteractiveDialogAdapter;
        
        const fields = instance.convertElementsToFields(props.elements);
        
        expect(fields).toHaveLength(1);
        expect(fields[0]).toEqual(expect.objectContaining({
            name: 'dynamic_select',
            type: 'dynamic_select',
            modal_label: 'Dynamic Select',
            lookup: {
                path: 'https://example.com/options',
            },
        }));
    });

    test('should handle submit correctly', async () => {
        const wrapper = shallow(<InteractiveDialogAdapter {...baseProps}/>);
        const instance = wrapper.instance() as InteractiveDialogAdapter;
        
        const call = {
            values: {
                text_field: 'text value',
                select_field: {label: 'Option 1', value: 'opt1'},
            },
        };
        
        const result = await instance.handleSubmit(call);
        
        expect(result).toEqual({
            data: {
                type: AppCallResponseTypes.OK,
            },
        });
        
        expect(baseProps.actions.submitInteractiveDialog).toHaveBeenCalledWith(expect.objectContaining({
            url: 'https://example.com/dialog',
            callback_id: 'callback123',
            state: 'somestate',
            submission: {
                text_field: 'text value',
                select_field: 'opt1',
            },
        }));
    });

    test('should handle lookup correctly', async () => {
        const wrapper = shallow(<InteractiveDialogAdapter {...baseProps}/>);
        const instance = wrapper.instance() as InteractiveDialogAdapter;
        
        const call = {
            values: {
                text_field: 'text value',
            },
            selected_field: 'dynamic_select',
            query: 'search',
            path: 'https://example.com/lookup',
        };
        
        const result = await instance.handleLookup(call);
        
        expect(result).toEqual({
            data: {
                type: AppCallResponseTypes.OK,
                data: {
                    items: [
                        {label: 'Lookup Option 1', value: 'lookup1'},
                        {label: 'Lookup Option 2', value: 'lookup2'},
                    ],
                },
            },
        });
        
        expect(baseProps.actions.lookupInteractiveDialog).toHaveBeenCalledWith(expect.objectContaining({
            url: 'https://example.com/lookup',
            callback_id: 'callback123',
            state: 'somestate',
            submission: expect.objectContaining({
                text_field: 'text value',
                query: 'search',
                selected_field: 'dynamic_select',
            }),
        }));
    });

    test('should validate lookup URL', async () => {
        const wrapper = shallow(<InteractiveDialogAdapter {...baseProps}/>);
        const instance = wrapper.instance() as InteractiveDialogAdapter;
        
        // Test invalid URL
        const invalidCall = {
            values: {},
            selected_field: 'dynamic_select',
            query: 'search',
            path: 'invalid-url',
        };
        
        const result = await instance.handleLookup(invalidCall);
        
        expect(result).toEqual({
            error: {
                type: AppCallResponseTypes.ERROR,
                text: expect.stringContaining('Invalid lookup URL format'),
            },
        });
        
        // Test valid plugin URL
        const validPluginCall = {
            values: {},
            selected_field: 'dynamic_select',
            query: 'search',
            path: '/plugins/myplugin/lookup',
        };
        
        baseProps.actions.lookupInteractiveDialog.mockClear();
        
        await instance.handleLookup(validPluginCall);
        
        expect(baseProps.actions.lookupInteractiveDialog).toHaveBeenCalledWith(expect.objectContaining({
            url: '/plugins/myplugin/lookup',
        }));
    });

    test('should handle cancel correctly', () => {
        const wrapper = shallow(<InteractiveDialogAdapter {...baseProps}/>);
        const instance = wrapper.instance() as InteractiveDialogAdapter;
        
        instance.handleHide();
        
        expect(baseProps.actions.submitInteractiveDialog).toHaveBeenCalledWith(expect.objectContaining({
            url: 'https://example.com/dialog',
            callback_id: 'callback123',
            state: 'somestate',
            cancelled: true,
            submission: {},
        }));
    });
});
