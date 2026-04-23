// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getUserPropertyFieldLabel} from './properties';

describe('utils/properties', () => {
    describe('getUserPropertyFieldLabel', () => {
        const base = {name: 'dept_head'};

        test('returns display_name when set and non-empty', () => {
            expect(getUserPropertyFieldLabel({
                ...base,
                attrs: {sort_order: 0, visibility: 'always', value_type: '', display_name: 'Department Head'},
            })).toBe('Department Head');
        });

        test('returns display_name trimmed when surrounded by whitespace', () => {
            expect(getUserPropertyFieldLabel({
                ...base,
                attrs: {sort_order: 0, visibility: 'always', value_type: '', display_name: '  Department Head  '},
            })).toBe('Department Head');
        });

        test('falls back to name when display_name is undefined', () => {
            expect(getUserPropertyFieldLabel({
                ...base,
                attrs: {sort_order: 0, visibility: 'always', value_type: ''},
            })).toBe('dept_head');
        });

        test('falls back to name when display_name is the empty string', () => {
            expect(getUserPropertyFieldLabel({
                ...base,
                attrs: {sort_order: 0, visibility: 'always', value_type: '', display_name: ''},
            })).toBe('dept_head');
        });

        test('falls back to name when display_name is whitespace-only', () => {
            expect(getUserPropertyFieldLabel({
                ...base,
                attrs: {sort_order: 0, visibility: 'always', value_type: '', display_name: '   '},
            })).toBe('dept_head');
        });

        test('falls back to name when attrs is undefined (defensive)', () => {
            // Type cast needed since UserPropertyField.attrs is normally required;
            // this covers runtime API responses that may omit the field.
            expect(getUserPropertyFieldLabel({
                name: 'dept_head',
                attrs: undefined as any,
            })).toBe('dept_head');
        });
    });
});
