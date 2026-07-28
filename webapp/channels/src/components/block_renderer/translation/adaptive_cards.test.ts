// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MmImageBlock} from '@mattermost/types/mm_blocks';

import {translateAdaptiveCards} from './adaptive_cards';

function imageFromCards(width: unknown, height?: unknown): MmImageBlock | undefined {
    const blocks = translateAdaptiveCards([{
        type: 'AdaptiveCard',
        body: [{
            type: 'Image',
            url: 'https://example.com/x.png',
            width,
            ...(height === undefined ? {} : {height}),
        }],
    }]);
    return blocks.find((b): b is MmImageBlock => b.type === 'image');
}

describe('translateAdaptiveCards Image pixel dimensions', () => {
    it('accepts plain numbers, px suffix, and decimal literals', () => {
        expect(imageFromCards(120)?.max_width).toBe(120);
        expect(imageFromCards('80px')?.max_width).toBe(80);
        expect(imageFromCards('12.5')?.max_width).toBe(13);
    });

    it('rejects percent and partially numeric strings', () => {
        const image = imageFromCards('100%', '10abc');
        expect(image?.max_width).toBeUndefined();
        expect(image?.max_height).toBeUndefined();
    });
});

describe('translateAdaptiveCards Input.Text', () => {
    it('should reject Input.Text without id', () => {
        expect(translateAdaptiveCards([{
            type: 'AdaptiveCard',
            body: [{
                type: 'Input.Text',
                label: 'Comment',
            }],
        }])).toEqual([]);
    });

    it('should translate Input.Text into text_input blocks', () => {
        expect(translateAdaptiveCards([{
            type: 'AdaptiveCard',
            body: [{
                type: 'Input.Text',
                id: 'comment',
                label: 'Comment',
                placeholder: 'Say something',
                isMultiline: true,
                maxLength: 500,
                value: 'Hello',
                style: 'email',
                isRequired: true,
            }],
        }])).toEqual([{
            type: 'text_input',
            name: 'comment',
            label: 'Comment',
            placeholder: 'Say something',
            multiline: true,
            max_length: 500,
            initial_value: 'Hello',
            subtype: 'email',
        }]);
    });

    it('should default to optional and fall back label from placeholder or id', () => {
        expect(translateAdaptiveCards([{
            type: 'AdaptiveCard',
            body: [{
                type: 'Input.Text',
                id: 'notes',
                placeholder: 'Notes',
                isEnabled: false,
            }],
        }])).toEqual([{
            type: 'text_input',
            name: 'notes',
            label: 'Notes',
            placeholder: 'Notes',
            optional: true,
            disabled: true,
        }]);
    });
});

describe('translateAdaptiveCards Input.Toggle', () => {
    it('should reject Input.Toggle without id', () => {
        expect(translateAdaptiveCards([{
            type: 'AdaptiveCard',
            body: [{
                type: 'Input.Toggle',
                title: 'Notify me',
            }],
        }])).toEqual([]);
    });

    it('should translate Input.Toggle into bool_input blocks', () => {
        expect(translateAdaptiveCards([{
            type: 'AdaptiveCard',
            body: [{
                type: 'Input.Toggle',
                id: 'notify',
                label: 'Notifications',
                title: 'Send email updates',
                value: 'true',
                isRequired: true,
            }],
        }])).toEqual([{
            type: 'bool_input',
            name: 'notify',
            label: 'Notifications',
            placeholder: 'Send email updates',
            initial_value: true,
        }]);
    });

    it('should default to optional and use title/valueOn for placeholder and checked state', () => {
        expect(translateAdaptiveCards([{
            type: 'AdaptiveCard',
            body: [{
                type: 'Input.Toggle',
                id: 'agree',
                title: 'I agree',
                value: 'yes',
                valueOn: 'yes',
                isEnabled: false,
            }],
        }])).toEqual([{
            type: 'bool_input',
            name: 'agree',
            label: 'I agree',
            placeholder: 'I agree',
            optional: true,
            initial_value: true,
            disabled: true,
        }]);
    });
});

describe('translateAdaptiveCards Input.ChoiceSet', () => {
    it('should translate ChoiceSet into select blocks', () => {
        expect(translateAdaptiveCards([{
            type: 'AdaptiveCard',
            body: [{
                type: 'Input.ChoiceSet',
                id: 'color',
                label: 'Color',
                style: 'expanded',
                isMultiSelect: true,
                isRequired: true,
                value: '1,3',
                choices: [
                    {title: 'Red', value: '1'},
                    {title: 'Green', value: '2'},
                    {title: 'Blue', value: '3'},
                ],
            }],
        }])).toEqual([{
            type: 'select',
            name: 'color',
            label: 'Color',
            style: 'expanded',
            multiselect: true,
            initial_options: ['1', '3'],
            options: [
                {text: 'Red', value: '1'},
                {text: 'Green', value: '2'},
                {text: 'Blue', value: '3'},
            ],
        }]);
    });
});

describe('translateAdaptiveCards Input.Date', () => {
    it('should reject Input.Date without id', () => {
        expect(translateAdaptiveCards([{
            type: 'AdaptiveCard',
            body: [{
                type: 'Input.Date',
                label: 'Due',
            }],
        }])).toEqual([]);
    });

    it('should translate Input.Date into date_input blocks', () => {
        expect(translateAdaptiveCards([{
            type: 'AdaptiveCard',
            body: [{
                type: 'Input.Date',
                id: 'due',
                label: 'Due date',
                placeholder: 'YYYY-MM-DD',
                value: '2025-06-15',
                min: '2025-01-01',
                max: '2025-12-31',
                isRequired: true,
            }],
        }])).toEqual([{
            type: 'date_input',
            name: 'due',
            label: 'Due date',
            placeholder: 'YYYY-MM-DD',
            initial_value: '2025-06-15',
            datetime_config: {
                min_date: '2025-01-01',
                max_date: '2025-12-31',
            },
        }]);
    });

    it('should default to optional and respect isEnabled', () => {
        expect(translateAdaptiveCards([{
            type: 'AdaptiveCard',
            body: [{
                type: 'Input.Date',
                id: 'start',
                placeholder: 'Start',
                isEnabled: false,
            }],
        }])).toEqual([{
            type: 'date_input',
            name: 'start',
            label: 'Start',
            placeholder: 'Start',
            optional: true,
            disabled: true,
        }]);
    });
});
