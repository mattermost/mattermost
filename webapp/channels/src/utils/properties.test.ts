// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    CPA_FIELD_NAME_PATTERN,
    CPA_FIELD_NAME_RESERVED_WORDS,
    getUserPropertyFieldLabel,
    slugifyForCEL,
    validateCPAFieldName,
} from './properties';

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

        test('returns non-ASCII display_name verbatim', () => {
            expect(getUserPropertyFieldLabel({
                name: 'employee_number',
                attrs: {sort_order: 0, visibility: 'always', value_type: '', display_name: '员工编号'},
            })).toBe('员工编号');
            expect(getUserPropertyFieldLabel({
                name: 'preferences',
                attrs: {sort_order: 0, visibility: 'always', value_type: '', display_name: 'Préférences'},
            })).toBe('Préférences');
        });
    });
});

describe('CPA field name constants - cross-stack drift guard', () => {
    it('CPA_FIELD_NAME_PATTERN string matches the Go source exactly', () => {
        if (CPA_FIELD_NAME_PATTERN.source !== '^[A-Za-z_][A-Za-z0-9_]*$') {
            throw new Error('Update the TS constant to match the Go source at server/public/model/custom_profile_attributes.go');
        }

        expect(CPA_FIELD_NAME_PATTERN.source).toBe('^[A-Za-z_][A-Za-z0-9_]*$');
    });

    it('CPA_FIELD_NAME_RESERVED_WORDS contains exactly 21 words matching the Go source', () => {
        const expected = new Set([
            'true', 'false', 'null',
            'in', 'as',
            'break', 'const', 'continue', 'else',
            'for', 'function', 'if', 'import',
            'let', 'loop', 'package', 'namespace',
            'return', 'var', 'void', 'while',
        ]);

        if (CPA_FIELD_NAME_RESERVED_WORDS.size !== 21) {
            throw new Error('Update the TS constant to match the Go source at server/public/model/custom_profile_attributes.go');
        }

        expect(CPA_FIELD_NAME_RESERVED_WORDS.size).toBe(21);
        for (const word of expected) {
            if (!CPA_FIELD_NAME_RESERVED_WORDS.has(word)) {
                throw new Error('Update the TS constant to match the Go source at server/public/model/custom_profile_attributes.go');
            }

            expect(CPA_FIELD_NAME_RESERVED_WORDS.has(word)).toBe(true);
        }
        for (const word of CPA_FIELD_NAME_RESERVED_WORDS) {
            if (!expected.has(word)) {
                throw new Error('Update the TS constant to match the Go source at server/public/model/custom_profile_attributes.go');
            }

            expect(expected.has(word)).toBe(true);
        }
    });
});

describe('validateCPAFieldName', () => {
    const validCases = [
        ['simple lowercase', 'department'],
        ['leading underscore', '_private'],
        ['uppercase start', 'Department'],
        ['single uppercase', 'A1'],
        ['underscore separator', 'a_b_c'],
        ['all uppercase', 'DEPT'],
        ['case-sensitive: IN is not reserved', 'IN'],
        ['case-sensitive: In is not reserved', 'In'],
        ['single lowercase letter', 'a'],
        ['single underscore', '_'],
        ['single uppercase letter', 'A'],
        ['reserved word as prefix', 'trueish'],
        ['reserved word as suffix', 'my_null'],
        ['255-rune name at exactly max length', 'a'.repeat(255)],
    ] as const;

    test.each(validCases)('%s: %s -> null', (_label, input) => {
        expect(validateCPAFieldName(input)).toBeNull();
    });

    const invalidCharsetCases = [
        ['space in name', 'My Field'],
        ['leading digit', '7department'],
        ['hyphen', 'foo-bar'],
        ['emoji', '🎯'],
        ['empty string', ''],
        ['trailing space', 'name '],
        ['non-ASCII letter', 'départment'],
        ['whitespace only', '   '],
        ['dot separator', 'foo.bar'],
        ['slash', 'foo/bar'],
    ] as const;

    test.each(invalidCharsetCases)('%s: %s -> invalid_charset', (_label, input) => {
        expect(validateCPAFieldName(input)).toEqual({kind: 'invalid_charset'});
    });

    const reservedWords = [
        'true', 'false', 'null',
        'in', 'as',
        'break', 'const', 'continue', 'else',
        'for', 'function', 'if', 'import',
        'let', 'loop', 'package', 'namespace',
        'return', 'var', 'void', 'while',
    ] as const;

    test.each(reservedWords)('reserved word: %s -> reserved_word', (word) => {
        expect(validateCPAFieldName(word)).toEqual({kind: 'reserved_word', word});
    });

    it('254-rune name -> null', () => {
        expect(validateCPAFieldName('a'.repeat(254))).toBeNull();
    });

    it('255-rune name -> null (exactly at cap)', () => {
        expect(validateCPAFieldName('a'.repeat(255))).toBeNull();
    });

    it('256-rune name -> too_long', () => {
        expect(validateCPAFieldName('a'.repeat(256))).toEqual({kind: 'too_long', max: 255});
    });
});

describe('slugifyForCEL', () => {
    it('already valid identifier passes through unchanged', () => {
        expect(slugifyForCEL('dept_head')).toBe('dept_head');
    });

    it('spaces are replaced with underscores', () => {
        expect(slugifyForCEL('My Field')).toBe('My_Field');
    });

    it('hyphens are replaced with underscores', () => {
        expect(slugifyForCEL('foo-bar')).toBe('foo_bar');
    });

    it('leading digit gets underscore prefix', () => {
        expect(slugifyForCEL('7department')).toBe('_7department');
    });

    it('empty string returns _copy', () => {
        expect(slugifyForCEL('')).toBe('_copy');
    });

    it('all-punctuation string returns _copy', () => {
        expect(slugifyForCEL('---')).toBe('_copy');
    });

    it('result always matches CPA_FIELD_NAME_PATTERN', () => {
        const inputs = ['My Field', 'foo-bar', '7dept', '', '---', 'valid_name', 'DEPT'];

        for (const input of inputs) {
            const result = slugifyForCEL(input);
            expect(CPA_FIELD_NAME_PATTERN.test(result)).toBe(true);
        }
    });
});
