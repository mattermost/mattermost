// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {DialogElement} from '@mattermost/types/integrations';

import {
    convertDialogElementToMmBlock,
    convertDialogToMmBlocks,
    dialogShouldShowSubmitChrome,
    DIALOG_SUBMIT_ACTION_ID,
} from './dialog_to_mm_blocks';

describe('convertDialogToMmBlocks', () => {
    const textElement: DialogElement = {
        display_name: 'Name',
        name: 'name',
        type: 'text',
        subtype: '',
        default: 'Ada',
        placeholder: 'Enter name',
        help_text: 'Your name',
        optional: false,
        min_length: 0,
        max_length: 100,
        data_source: '',
        options: [],
    };

    test('converts text, bool, select, and radio elements', () => {
        const elements: DialogElement[] = [
            textElement,
            {
                ...textElement,
                name: 'enabled',
                display_name: 'Enabled',
                type: 'bool',
                default: 'true',
            },
            {
                ...textElement,
                name: 'choice',
                display_name: 'Choice',
                type: 'select',
                options: [{text: 'One', value: '1'}, {text: 'Two', value: '2'}],
            },
            {
                ...textElement,
                name: 'color',
                display_name: 'Color',
                type: 'radio',
                options: [{text: 'Red', value: 'red'}],
                default: 'red',
            },
        ];

        const {blocks, errors} = convertDialogToMmBlocks(elements, 'Intro');
        expect(errors).toEqual([]);
        expect(blocks[0]).toMatchObject({type: 'text', text: 'Intro'});
        expect(blocks[1]).toMatchObject({type: 'text_input', name: 'name', initial_value: 'Ada'});
        expect(blocks[2]).toMatchObject({type: 'bool_input', name: 'enabled', initial_value: true});
        expect(blocks[3]).toMatchObject({type: 'select', name: 'choice', options: [{text: 'One', value: '1'}, {text: 'Two', value: '2'}]});
        expect(blocks[4]).toMatchObject({type: 'select', name: 'color', style: 'expanded', initial_option: 'red'});
        expect(blocks.some((b) => b.type === 'button' && 'action_id' in b && b.action_id === DIALOG_SUBMIT_ACTION_ID)).toBe(false);
    });

    test('maps dynamic select to data_source_action', () => {
        const block = convertDialogElementToMmBlock({
            ...textElement,
            type: 'select',
            data_source: 'dynamic',
            data_source_url: 'https://example.com/lookup',
        });
        expect(block).toMatchObject({
            type: 'select',
            data_source: 'dynamic',
            data_source_action: 'name',
        });
    });

    test('maps textarea to multiline text_input', () => {
        const block = convertDialogElementToMmBlock({
            ...textElement,
            type: 'textarea',
        });
        expect(block).toMatchObject({type: 'text_input', multiline: true});
    });

    test('maps date, datetime, and file elements', () => {
        expect(convertDialogElementToMmBlock({
            ...textElement,
            name: 'due',
            display_name: 'Due',
            type: 'date',
            default: '2025-06-15',
            placeholder: 'Pick a date',
            datetime_config: {min_date: 'today'},
        })).toMatchObject({
            type: 'date_input',
            name: 'due',
            label: 'Due',
            initial_value: '2025-06-15',
            placeholder: 'Pick a date',
            datetime_config: {min_date: 'today'},
        });

        expect(convertDialogElementToMmBlock({
            ...textElement,
            name: 'meeting',
            display_name: 'Meeting',
            type: 'datetime',
            default: '2025-06-15T10:00:00Z',
            datetime_config: {time_interval: 30},
        })).toMatchObject({
            type: 'datetime_input',
            name: 'meeting',
            label: 'Meeting',
            initial_value: '2025-06-15T10:00:00Z',
            datetime_config: {time_interval: 30},
        });

        expect(convertDialogElementToMmBlock({
            ...textElement,
            name: 'attachments',
            display_name: 'Attachments',
            type: 'file',
            placeholder: 'Upload',
            allow_multiple: true,
            default: 'fileidaaaaaaaaaaaaaaaaaaaaaaaa,fileidbbbbbbbbbbbbbbbbbbbbbbbb',
        })).toMatchObject({
            type: 'file_input',
            name: 'attachments',
            label: 'Attachments',
            placeholder: 'Upload',
            allow_multiple: true,
            initial_value: 'fileidaaaaaaaaaaaaaaaaaaaaaaaa,fileidbbbbbbbbbbbbbbbbbbbbbbbb',
        });
    });

    test('merges deprecated top-level date constraints into datetime_config', () => {
        expect(convertDialogElementToMmBlock({
            ...textElement,
            name: 'min_date_field',
            display_name: 'Date With Min',
            type: 'date',
            min_date: 'today',
        })).toMatchObject({
            type: 'date_input',
            datetime_config: {min_date: 'today'},
        });

        expect(convertDialogElementToMmBlock({
            ...textElement,
            name: 'interval_time',
            display_name: 'Custom Interval Time',
            type: 'datetime',
            time_interval: 30,
        })).toMatchObject({
            type: 'datetime_input',
            datetime_config: {time_interval: 30},
        });

        // datetime_config takes precedence over deprecated top-level fields
        expect(convertDialogElementToMmBlock({
            ...textElement,
            name: 'precedence',
            display_name: 'Precedence',
            type: 'date',
            min_date: '2020-01-01',
            max_date: '2030-01-01',
            datetime_config: {min_date: 'today', max_date: '+7d'},
        })).toMatchObject({
            type: 'date_input',
            datetime_config: {min_date: 'today', max_date: '+7d'},
        });
    });

    test('does not inject a submit button into blocks', () => {
        const {blocks} = convertDialogToMmBlocks([textElement], undefined, 'Save');
        expect(blocks.some((b) => b.type === 'button')).toBe(false);
        expect(dialogShouldShowSubmitChrome([textElement], 'Save')).toBe(true);
    });

    test('skips submit chrome for action-button-only dialogs', () => {
        const actionOnly: DialogElement[] = [{
            ...textElement,
            type: 'action_button',
            action_button: {url: '/plugins/foo/action'},
        }];
        const {blocks} = convertDialogToMmBlocks(actionOnly, undefined, undefined);
        expect(blocks.some((b) => b.type === 'button' && 'action_id' in b && b.action_id === DIALOG_SUBMIT_ACTION_ID)).toBe(false);
        expect(blocks.some((b) => b.type === 'button')).toBe(true);
        expect(dialogShouldShowSubmitChrome(actionOnly, undefined)).toBe(false);
        expect(dialogShouldShowSubmitChrome(actionOnly, 'Submit')).toBe(true);
    });
});
