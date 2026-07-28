// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MmBlock} from '@mattermost/types/mm_blocks';

import {
    checkMmBlocksFormFieldForError,
    collectMmBlocksFormFields,
    isMmBlocksSubmitAction,
    validateMmBlocksFormValues,
} from './form_validation';

describe('form_validation', () => {
    describe('collectMmBlocksFormFields', () => {
        it('collects nested form fields', () => {
            const blocks: MmBlock[] = [
                {type: 'text', text: 'Intro'},
                {
                    type: 'container',
                    content: [
                        {type: 'text_input', name: 'title', label: 'Title'},
                        {
                            type: 'column_set',
                            columns: [{
                                type: 'column',
                                items: [
                                    {type: 'bool_input', name: 'notify', label: 'Notify', optional: true},
                                ],
                            }],
                        },
                    ],
                },
            ];

            expect(collectMmBlocksFormFields(blocks).map((f) => f.name)).toEqual(['title', 'notify']);
        });
    });

    describe('isMmBlocksSubmitAction', () => {
        it('finds nested submit buttons by action_id', () => {
            const blocks: MmBlock[] = [{
                type: 'container',
                content: [
                    {type: 'button', text: 'Save', action_id: 'save', subtype: 'submit'},
                    {type: 'button', text: 'Go', action_id: 'go'},
                ],
            }];
            expect(isMmBlocksSubmitAction(blocks, 'save')).toBe(true);
            expect(isMmBlocksSubmitAction(blocks, 'go')).toBe(false);
            expect(isMmBlocksSubmitAction(blocks, 'missing')).toBe(false);
        });
    });

    describe('checkMmBlocksFormFieldForError', () => {
        it('requires non-optional empty fields', () => {
            expect(checkMmBlocksFormFieldForError(
                {type: 'text_input', name: 'title', label: 'Title'},
                undefined,
            )?.id).toBe('interactive_dialog.error.required');
        });

        it('allows explicit false for bool fields', () => {
            expect(checkMmBlocksFormFieldForError(
                {type: 'bool_input', name: 'notify', label: 'Notify'},
                false,
            )).toBeNull();
        });

        it('enforces min and max length on text', () => {
            expect(checkMmBlocksFormFieldForError(
                {type: 'text_input', name: 'title', label: 'Title', min_length: 3},
                'ab',
            )?.id).toBe('interactive_dialog.error.too_short');

            expect(checkMmBlocksFormFieldForError(
                {type: 'text_input', name: 'title', label: 'Title', max_length: 3},
                'abcd',
            )?.id).toBe('interactive_dialog.error.too_long');
        });

        it('validates email subtype', () => {
            expect(checkMmBlocksFormFieldForError(
                {type: 'text_input', name: 'email', label: 'Email', subtype: 'email', optional: true},
                'not-an-email',
            )?.id).toBe('interactive_dialog.error.bad_email');
        });
    });

    describe('validateMmBlocksFormValues', () => {
        it('returns errors keyed by field name', () => {
            const blocks: MmBlock[] = [
                {type: 'text_input', name: 'title', label: 'Title'},
                {type: 'select', name: 'role', label: 'Role', optional: true},
            ];

            expect(validateMmBlocksFormValues(blocks, {})).toEqual({
                title: expect.objectContaining({id: 'interactive_dialog.error.required'}),
            });
        });
    });
});
