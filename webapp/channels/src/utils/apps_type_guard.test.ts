// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {isAppBinding} from '@mattermost/types/apps';

// isAppField and isAppForm are not exported. Tests exercise them via the
// exported isAppBinding, which validates a binding's form.fields[] using
// isAppField under the hood.
function bindingWithField(field: unknown) {
    return {
        app_id: 'app',
        label: 'Binding',
        form: {
            fields: [field],
        },
    };
}

describe('isAppBinding — isAppField datetime_config validation', () => {
    const baseField = {
        name: 'when',
        type: 'datetime',
    };

    describe('datetime_config.min_date', () => {
        test('accepts valid ISO date', () => {
            const binding = bindingWithField({
                ...baseField,
                datetime_config: {min_date: '2025-01-15'},
            });
            expect(isAppBinding(binding)).toBe(true);
        });

        test('accepts valid ISO datetime', () => {
            const binding = bindingWithField({
                ...baseField,
                datetime_config: {min_date: '2025-01-15T09:00:00Z'},
            });
            expect(isAppBinding(binding)).toBe(true);
        });

        test('accepts relative keyword "today"', () => {
            const binding = bindingWithField({
                ...baseField,
                datetime_config: {min_date: 'today'},
            });
            expect(isAppBinding(binding)).toBe(true);
        });

        test('accepts relative days (+7d)', () => {
            const binding = bindingWithField({
                ...baseField,
                datetime_config: {min_date: '+7d'},
            });
            expect(isAppBinding(binding)).toBe(true);
        });

        test('accepts relative hours (+2H)', () => {
            const binding = bindingWithField({
                ...baseField,
                datetime_config: {min_date: '+2H'},
            });
            expect(isAppBinding(binding)).toBe(true);
        });

        test('rejects unparseable string', () => {
            const binding = bindingWithField({
                ...baseField,
                datetime_config: {min_date: 'not-a-date'},
            });
            expect(isAppBinding(binding)).toBe(false);
        });

        test('rejects non-string value', () => {
            const binding = bindingWithField({
                ...baseField,
                datetime_config: {min_date: 12345},
            });
            expect(isAppBinding(binding)).toBe(false);
        });
    });

    describe('datetime_config.max_date', () => {
        test('accepts valid ISO date', () => {
            const binding = bindingWithField({
                ...baseField,
                datetime_config: {max_date: '2025-12-31'},
            });
            expect(isAppBinding(binding)).toBe(true);
        });

        test('accepts relative weeks (+2w)', () => {
            const binding = bindingWithField({
                ...baseField,
                datetime_config: {max_date: '+2w'},
            });
            expect(isAppBinding(binding)).toBe(true);
        });

        test('rejects unparseable string', () => {
            const binding = bindingWithField({
                ...baseField,
                datetime_config: {max_date: 'bogus'},
            });
            expect(isAppBinding(binding)).toBe(false);
        });

        test('rejects non-string value', () => {
            const binding = bindingWithField({
                ...baseField,
                datetime_config: {max_date: true},
            });
            expect(isAppBinding(binding)).toBe(false);
        });
    });

    describe('datetime_config.time_interval', () => {
        test('accepts number', () => {
            const binding = bindingWithField({
                ...baseField,
                datetime_config: {time_interval: 30},
            });
            expect(isAppBinding(binding)).toBe(true);
        });

        test('rejects non-number value', () => {
            const binding = bindingWithField({
                ...baseField,
                datetime_config: {time_interval: '30'},
            });
            expect(isAppBinding(binding)).toBe(false);
        });
    });

    describe('datetime_config.manual_time_entry', () => {
        test('accepts boolean true', () => {
            const binding = bindingWithField({
                ...baseField,
                datetime_config: {manual_time_entry: true},
            });
            expect(isAppBinding(binding)).toBe(true);
        });

        test('accepts boolean false', () => {
            const binding = bindingWithField({
                ...baseField,
                datetime_config: {manual_time_entry: false},
            });
            expect(isAppBinding(binding)).toBe(true);
        });

        test('rejects non-boolean value', () => {
            const binding = bindingWithField({
                ...baseField,
                datetime_config: {manual_time_entry: 'true'},
            });
            expect(isAppBinding(binding)).toBe(false);
        });
    });

    describe('datetime_config.allow_manual_time_entry (deprecated)', () => {
        test('accepts boolean', () => {
            const binding = bindingWithField({
                ...baseField,
                datetime_config: {allow_manual_time_entry: true},
            });
            expect(isAppBinding(binding)).toBe(true);
        });

        test('rejects non-boolean value', () => {
            const binding = bindingWithField({
                ...baseField,
                datetime_config: {allow_manual_time_entry: 1},
            });
            expect(isAppBinding(binding)).toBe(false);
        });

        test('accepts both new and deprecated fields set simultaneously', () => {
            const binding = bindingWithField({
                ...baseField,
                datetime_config: {
                    manual_time_entry: true,
                    allow_manual_time_entry: false,
                },
            });
            expect(isAppBinding(binding)).toBe(true);
        });
    });

    describe('datetime_config shape', () => {
        test('accepts empty object', () => {
            const binding = bindingWithField({
                ...baseField,
                datetime_config: {},
            });
            expect(isAppBinding(binding)).toBe(true);
        });

        test('rejects null', () => {
            const binding = bindingWithField({
                ...baseField,
                datetime_config: null,
            });
            expect(isAppBinding(binding)).toBe(false);
        });

        test('rejects primitive value', () => {
            const binding = bindingWithField({
                ...baseField,
                datetime_config: 'not-an-object',
            });
            expect(isAppBinding(binding)).toBe(false);
        });
    });

    describe('interaction with deprecated top-level fields', () => {
        test('accepts both datetime_config and legacy top-level min_date when valid', () => {
            const binding = bindingWithField({
                ...baseField,
                min_date: '2024-01-01',
                datetime_config: {min_date: '2025-01-15'},
            });
            expect(isAppBinding(binding)).toBe(true);
        });

        test('rejects when datetime_config.min_date is invalid even if legacy min_date is valid', () => {
            const binding = bindingWithField({
                ...baseField,
                min_date: '2025-01-15',
                datetime_config: {min_date: 'not-a-date'},
            });
            expect(isAppBinding(binding)).toBe(false);
        });
    });
});
