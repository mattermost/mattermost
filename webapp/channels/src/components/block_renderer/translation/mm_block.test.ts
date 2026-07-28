// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {translateMMBlocks} from './mm_block';

describe('translateMMBlocks interactive blocks', () => {
    it('should reject button blocks with empty text or action_id', () => {
        expect(translateMMBlocks([
            {type: 'button', text: '   ', action_id: 'ok'},
            {type: 'button', text: 'Go', action_id: ''},
        ])).toEqual([]);
    });

    it('should accept button blocks with non-empty text and action_id', () => {
        expect(translateMMBlocks([
            {type: 'button', text: 'Go', action_id: 'go_action'},
        ])).toEqual([{
            type: 'button',
            text: 'Go',
            action_id: 'go_action',
        }]);
    });

    it('should reject static_select blocks with empty placeholder or action_id', () => {
        expect(translateMMBlocks([
            {
                type: 'static_select',
                action_id: 'sel',
                placeholder: '  ',
                options: [{text: 'A', value: 'a'}],
            },
            {
                type: 'static_select',
                action_id: '   ',
                placeholder: 'Pick',
                options: [{text: 'A', value: 'a'}],
            },
        ])).toEqual([]);
    });

    it('should accept static_select blocks with non-empty placeholder and action_id', () => {
        expect(translateMMBlocks([
            {
                type: 'static_select',
                action_id: 'sel_action',
                placeholder: 'Pick one',
                options: [{text: 'A', value: 'a'}],
            },
        ])).toEqual([{
            type: 'static_select',
            action_id: 'sel_action',
            placeholder: 'Pick one',
            options: [{text: 'A', value: 'a'}],
        }]);
    });

    it('should reject text_input blocks with empty name', () => {
        expect(translateMMBlocks([
            {type: 'text_input', name: '  ', label: 'Title'},
        ])).toEqual([]);
    });

    it('should accept text_input blocks with an empty label', () => {
        expect(translateMMBlocks([
            {type: 'text_input', name: 'title', label: ''},
        ])).toEqual([{
            type: 'text_input',
            name: 'title',
            label: '',
        }]);
    });

    it('should accept text_input blocks with form field props', () => {
        expect(translateMMBlocks([
            {
                type: 'text_input',
                name: 'title',
                label: 'Title',
                subtype: 'email',
                multiline: true,
                optional: true,
                placeholder: 'you@example.com',
                help_text: 'Work email',
                initial_value: 'a@b.c',
                min_length: 3,
                max_length: 100,
                onChange: 'refresh',
            },
        ])).toEqual([{
            type: 'text_input',
            name: 'title',
            label: 'Title',
            subtype: 'email',
            multiline: true,
            optional: true,
            placeholder: 'you@example.com',
            help_text: 'Work email',
            initial_value: 'a@b.c',
            min_length: 3,
            max_length: 100,
            onChange: 'refresh',
        }]);
    });

    it('should reject bool_input blocks with empty name', () => {
        expect(translateMMBlocks([
            {type: 'bool_input', name: '  ', label: 'Notify'},
        ])).toEqual([]);
    });

    it('should accept bool_input blocks with an empty label', () => {
        expect(translateMMBlocks([
            {type: 'bool_input', name: 'notify', label: ''},
        ])).toEqual([{
            type: 'bool_input',
            name: 'notify',
            label: '',
        }]);
    });

    it('should accept bool_input blocks with form field props', () => {
        expect(translateMMBlocks([
            {
                type: 'bool_input',
                name: 'notify',
                label: 'Notifications',
                optional: true,
                placeholder: 'Send updates',
                help_text: 'Optional alerts',
                initial_value: true,
                onChange: 'refresh',
            },
        ])).toEqual([{
            type: 'bool_input',
            name: 'notify',
            label: 'Notifications',
            optional: true,
            placeholder: 'Send updates',
            help_text: 'Optional alerts',
            initial_value: true,
            onChange: 'refresh',
        }]);
    });

    it('should reject bool_input with non-boolean initial_value', () => {
        expect(translateMMBlocks([
            {type: 'bool_input', name: 'notify', label: 'Notify', initial_value: 'true'},
        ])).toEqual([]);
    });

    it('should reject date_input blocks with empty name', () => {
        expect(translateMMBlocks([
            {type: 'date_input', name: '  ', label: 'Due'},
        ])).toEqual([]);
    });

    it('should accept date_input blocks with an empty label', () => {
        expect(translateMMBlocks([
            {type: 'date_input', name: 'due', label: ''},
        ])).toEqual([{
            type: 'date_input',
            name: 'due',
            label: '',
        }]);
    });

    it('should accept date_input blocks with form field props', () => {
        expect(translateMMBlocks([
            {
                type: 'date_input',
                name: 'due',
                label: 'Due date',
                optional: true,
                placeholder: 'Pick a date',
                help_text: 'When it is due',
                initial_value: '2025-06-15',
                onChange: 'refresh',
                datetime_config: {
                    min_date: 'today',
                    max_date: '+30d',
                },
            },
        ])).toEqual([{
            type: 'date_input',
            name: 'due',
            label: 'Due date',
            optional: true,
            placeholder: 'Pick a date',
            help_text: 'When it is due',
            initial_value: '2025-06-15',
            onChange: 'refresh',
            datetime_config: {
                min_date: 'today',
                max_date: '+30d',
            },
        }]);
    });

    it('should reject date_input with invalid datetime_config', () => {
        expect(translateMMBlocks([
            {type: 'date_input', name: 'due', label: 'Due', datetime_config: 'bad'},
            {type: 'date_input', name: 'due', label: 'Due', datetime_config: {time_interval: 'x'}},
        ])).toEqual([]);
    });

    it('should reject datetime_input blocks with empty name', () => {
        expect(translateMMBlocks([
            {type: 'datetime_input', name: '  ', label: 'Meeting'},
        ])).toEqual([]);
    });

    it('should accept datetime_input blocks with an empty label', () => {
        expect(translateMMBlocks([
            {type: 'datetime_input', name: 'meeting', label: ''},
        ])).toEqual([{
            type: 'datetime_input',
            name: 'meeting',
            label: '',
        }]);
    });

    it('should accept datetime_input blocks with form field props', () => {
        expect(translateMMBlocks([
            {
                type: 'datetime_input',
                name: 'meeting',
                label: 'Meeting time',
                optional: true,
                placeholder: 'Pick date and time',
                help_text: 'When to meet',
                initial_value: '2025-06-15T10:00:00Z',
                onChange: 'refresh',
                datetime_config: {
                    time_interval: 15,
                    location_timezone: 'America/Denver',
                    manual_time_entry: true,
                },
            },
        ])).toEqual([{
            type: 'datetime_input',
            name: 'meeting',
            label: 'Meeting time',
            optional: true,
            placeholder: 'Pick date and time',
            help_text: 'When to meet',
            initial_value: '2025-06-15T10:00:00Z',
            onChange: 'refresh',
            datetime_config: {
                time_interval: 15,
                location_timezone: 'America/Denver',
                manual_time_entry: true,
            },
        }]);
    });

    it('should reject file_input blocks with empty name', () => {
        expect(translateMMBlocks([
            {type: 'file_input', name: '  ', label: 'Files'},
        ])).toEqual([]);
    });

    it('should accept file_input blocks with an empty label', () => {
        expect(translateMMBlocks([
            {type: 'file_input', name: 'files', label: ''},
        ])).toEqual([{
            type: 'file_input',
            name: 'files',
            label: '',
        }]);
    });

    it('should accept file_input blocks with form field props', () => {
        expect(translateMMBlocks([
            {
                type: 'file_input',
                name: 'attachments',
                label: 'Attachments',
                optional: true,
                placeholder: 'Upload files',
                help_text: 'Optional files',
                allow_multiple: true,
                onChange: 'refresh',
                initial_value: 'fileidaaaaaaaaaaaaaaaaaaaaaaaa,fileidbbbbbbbbbbbbbbbbbbbbbbbb',
            },
        ])).toEqual([{
            type: 'file_input',
            name: 'attachments',
            label: 'Attachments',
            optional: true,
            placeholder: 'Upload files',
            help_text: 'Optional files',
            allow_multiple: true,
            onChange: 'refresh',
            initial_value: 'fileidaaaaaaaaaaaaaaaaaaaaaaaa,fileidbbbbbbbbbbbbbbbbbbbbbbbb',
        }]);
    });

    it('should reject file_input with non-boolean allow_multiple', () => {
        expect(translateMMBlocks([
            {type: 'file_input', name: 'files', label: 'Files', allow_multiple: 'yes'},
        ])).toEqual([]);
    });

    it('should reject select blocks with both options and option_groups', () => {
        expect(translateMMBlocks([{
            type: 'select',
            name: 'color',
            label: 'Color',
            options: [{text: 'Red', value: 'red'}],
            option_groups: [{label: 'Warm', options: [{text: 'Red', value: 'red'}]}],
        }])).toEqual([]);
    });

    it('should accept select blocks with an empty label', () => {
        expect(translateMMBlocks([{
            type: 'select',
            name: 'severity',
            label: '',
            options: [{text: 'High', value: 'high'}],
        }])).toEqual([{
            type: 'select',
            name: 'severity',
            label: '',
            options: [{text: 'High', value: 'high'}],
        }]);
    });

    it('should accept select blocks with style, multiselect, and option_groups', () => {
        expect(translateMMBlocks([{
            type: 'select',
            name: 'fruit',
            label: 'Fruit',
            style: 'expanded',
            multiselect: true,
            optional: true,
            option_groups: [{
                label: 'Citrus',
                options: [{text: 'Orange', value: 'orange'}],
            }],
            initial_options: ['orange'],
            onChange: 'refresh',
        }])).toEqual([{
            type: 'select',
            name: 'fruit',
            label: 'Fruit',
            style: 'expanded',
            multiselect: true,
            optional: true,
            option_groups: [{
                label: 'Citrus',
                options: [{text: 'Orange', value: 'orange'}],
            }],
            initial_options: ['orange'],
            onChange: 'refresh',
        }]);
    });

    it('should accept column gap and reject invalid gap values', () => {
        expect(translateMMBlocks([
            {
                type: 'column',
                gap: 'small',
                items: [{type: 'text', text: 'In column'}],
            },
            {
                type: 'column',
                gap: 'invalid',
                items: [{type: 'text', text: 'Bad gap'}],
            },
        ])).toEqual([{
            type: 'column',
            gap: 'small',
            items: [{type: 'text', text: 'In column'}],
        }]);
    });

    it('should omit collapsed on collapsible blocks when the field is absent', () => {
        expect(translateMMBlocks([
            {
                type: 'collapsible',
                header: [{type: 'text', text: 'Header'}],
                content: [{type: 'text', text: 'Body'}],
            },
        ])).toEqual([{
            type: 'collapsible',
            header: [{type: 'text', text: 'Header'}],
            content: [{type: 'text', text: 'Body'}],
        }]);
    });

    it('should preserve explicit collapsed values on collapsible blocks', () => {
        expect(translateMMBlocks([
            {
                type: 'collapsible',
                collapsed: true,
                header: [{type: 'text', text: 'Header'}],
                content: [{type: 'text', text: 'Body'}],
            },
            {
                type: 'collapsible',
                collapsed: false,
                header: [{type: 'text', text: 'Open header'}],
                content: [{type: 'text', text: 'Open body'}],
            },
            {
                type: 'collapsible',
                collapsed: 'not-a-boolean',
                header: [{type: 'text', text: 'Bad header'}],
                content: [{type: 'text', text: 'Bad body'}],
            },
        ])).toEqual([
            {
                type: 'collapsible',
                collapsed: true,
                header: [{type: 'text', text: 'Header'}],
                content: [{type: 'text', text: 'Body'}],
            },
            {
                type: 'collapsible',
                collapsed: false,
                header: [{type: 'text', text: 'Open header'}],
                content: [{type: 'text', text: 'Open body'}],
            },
        ]);
    });

    it('should accept column_set gap and reject invalid gap values', () => {
        expect(translateMMBlocks([
            {
                type: 'column_set',
                gap: 'large',
                columns: [
                    {type: 'column', items: [{type: 'text', text: 'A'}]},
                    {type: 'column', items: [{type: 'text', text: 'B'}]},
                ],
            },
            {
                type: 'column_set',
                gap: 'huge',
                columns: [
                    {type: 'column', items: [{type: 'text', text: 'C'}]},
                ],
            },
        ])).toEqual([{
            type: 'column_set',
            gap: 'large',
            columns: [
                {type: 'column', items: [{type: 'text', text: 'A'}]},
                {type: 'column', items: [{type: 'text', text: 'B'}]},
            ],
        }]);
    });
});
