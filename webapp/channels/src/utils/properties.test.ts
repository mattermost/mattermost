// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    CPA_FIELD_NAME_PATTERN,
    CPA_FIELD_NAME_RESERVED_WORDS,
    filterCELIdentifier,
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
    it('already snake_case identifier passes through unchanged', () => {
        expect(slugifyForCEL('dept_head')).toBe('dept_head');
    });

    it('spaces are replaced with underscores and lowercased', () => {
        expect(slugifyForCEL('My Field')).toBe('my_field');
    });

    it('hyphens are replaced with underscores and lowercased', () => {
        expect(slugifyForCEL('foo-Bar')).toBe('foo_bar');
    });

    it('camelCase is converted to snake_case', () => {
        expect(slugifyForCEL('myFieldName')).toBe('my_field_name');
    });

    it('PascalCase is converted to snake_case', () => {
        expect(slugifyForCEL('MyField')).toBe('my_field');
    });

    it('consecutive uppercase acronyms split before final word', () => {
        expect(slugifyForCEL('XMLParser')).toBe('xml_parser');
        expect(slugifyForCEL('HTTPServerError')).toBe('http_server_error');
    });

    it('all-uppercase token is lowercased without inserting separators', () => {
        expect(slugifyForCEL('DEPT')).toBe('dept');
    });

    it('digit-letter boundaries do not insert separators', () => {
        expect(slugifyForCEL('field2name')).toBe('field2name');
        expect(slugifyForCEL('Field2Name')).toBe('field2_name');
    });

    it('leading digit gets underscore prefix', () => {
        expect(slugifyForCEL('7department')).toBe('_7department');
    });

    it('leading underscore is preserved', () => {
        expect(slugifyForCEL('_Private')).toBe('_private');
    });

    it('empty string returns _copy', () => {
        expect(slugifyForCEL('')).toBe('_copy');
    });

    it('all-punctuation string returns _copy', () => {
        expect(slugifyForCEL('---')).toBe('_copy');
    });

    it('non-ASCII letters are replaced with underscores', () => {
        expect(slugifyForCEL('Préférences')).toBe('pr_f_rences');
    });

    it('result always matches CPA_FIELD_NAME_PATTERN', () => {
        const inputs = [
            'My Field',
            'foo-bar',
            '7dept',
            '',
            '---',
            'valid_name',
            'DEPT',
            'MyField',
            'XMLParser',
            'myFieldName',
            '_Private',
            'Préférences',
        ];

        for (const input of inputs) {
            const result = slugifyForCEL(input);
            expect(CPA_FIELD_NAME_PATTERN.test(result)).toBe(true);
        }
    });
});

describe('filterCELIdentifier', () => {
    const cases = [
        ['strips spaces', 'my field', 'myfield'],
        ['strips dashes', 'my-field', 'myfield'],
        ['prefixes leading digit', '7department', '_7department'],
        ['passes valid identifier through', 'my_field_2', 'my_field_2'],
        ['preserves case', 'MyField', 'MyField'],
        ['strips emoji', 'field🎉', 'field'],
        ['empty string stays empty', '', ''],
        ['all digits prefixed', '123', '_123'],
        ['all punctuation becomes empty', '!@#', ''],
        ['preserves multiple underscores', 'my__field', 'my__field'],
        ['leading underscore preserved', '_private', '_private'],
    ] as const;

    test.each(cases)('%s: %s → %s', (_label, input, expected) => {
        expect(filterCELIdentifier(input)).toBe(expected);
    });
});
