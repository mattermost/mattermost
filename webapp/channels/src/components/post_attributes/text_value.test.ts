// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {limitTextValue, TEXT_VALUE_MAX_BYTES, validateTextValue} from './text_value';

function textField(valueType?: string): PropertyField {
    return {
        id: 'field_1',
        group_id: 'group_id',
        name: 'note',
        type: 'text',
        object_type: 'post',
        target_type: 'system',
        target_id: '',
        attrs: valueType ? {value_type: valueType} : {},
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: 'user_1',
        updated_by: 'user_1',
    };
}

describe('limitTextValue', () => {
    test('keeps a value that fits', () => {
        const atLimit = 'a'.repeat(TEXT_VALUE_MAX_BYTES);
        expect(limitTextValue(atLimit)).toBe(atLimit);
    });

    test('cuts an ASCII value to the byte limit', () => {
        expect(limitTextValue('a'.repeat(70))).toBe('a'.repeat(64));
    });

    test('counts UTF-8 bytes, not UTF-16 code units', () => {
        // "€" is one code unit but three bytes: 22 of them are 66 bytes, which
        // the server refuses.
        expect(limitTextValue('€'.repeat(22))).toBe('€'.repeat(21));
    });

    test('never splits a character that does not fit', () => {
        // 62 bytes of ASCII leaves room for two more, not for a four-byte emoji.
        expect(limitTextValue('a'.repeat(62) + '😀😀')).toBe('a'.repeat(62));
    });

    test('does not count surrounding whitespace, as the server trims it', () => {
        const padded = `  ${'a'.repeat(64)}  `;
        expect(limitTextValue(padded)).toBe(padded);
        expect(limitTextValue(`  ${'a'.repeat(65)}`)).toBe(`  ${'a'.repeat(64)}`);
    });

    test('trims only what the server trims', () => {
        // Go's `strings.TrimSpace` keeps a BOM, which is three bytes, and strips
        // U+0085, which JS `trim()` keeps.
        expect(limitTextValue('\ufeff' + 'a'.repeat(64))).toBe('\ufeff' + 'a'.repeat(61));
        const nextLine = `\u0085${'a'.repeat(64)}\u0085`;
        expect(limitTextValue(nextLine)).toBe(nextLine);
    });

    test('refuses a keystroke at the limit wherever it is typed', () => {
        const atLimit = 'a'.repeat(63) + 'z';
        expect(limitTextValue('b' + atLimit, atLimit)).toBe(atLimit);
        expect(limitTextValue('a'.repeat(30) + 'b' + 'a'.repeat(33) + 'z', atLimit)).toBe(atLimit);
        expect(limitTextValue(atLimit + 'b', atLimit)).toBe(atLimit);
    });

    test('cuts only the pasted text, wherever it is pasted', () => {
        const previous = 'x'.repeat(30) + 'y'.repeat(30);
        expect(limitTextValue('x'.repeat(30) + 'p'.repeat(10) + 'y'.repeat(30), previous)).
            toBe('x'.repeat(30) + 'p'.repeat(4) + 'y'.repeat(30));
    });

    test('cuts a replaced selection down to what fits', () => {
        const previous = 'a'.repeat(60) + 'bc';
        expect(limitTextValue('a'.repeat(60) + 'X'.repeat(10) + 'c', previous)).toBe('a'.repeat(60) + 'XXXc');
    });

    test('never splits a pasted character that shares a surrogate with the previous one', () => {
        // "😀" and "😁" share their first UTF-16 code unit.
        const previous = 'a'.repeat(60) + '😀';
        expect(limitTextValue('a'.repeat(60) + '😁😁', previous)).toBe('a'.repeat(60) + '😁');
    });

    test('cuts a value already over the limit from the end when nothing was inserted', () => {
        const over = 'a'.repeat(70);
        expect(limitTextValue('a'.repeat(69), over)).toBe('a'.repeat(64));
    });
});

describe('validateTextValue', () => {
    test('accepts anything in a field with no value type, or a phone', () => {
        expect(validateTextValue(textField(), 'anything at all')).toBeUndefined();
        expect(validateTextValue(textField('phone'), 'not a number')).toBeUndefined();
    });

    test('accepts an empty value whatever the value type', () => {
        expect(validateTextValue(textField('email'), '   ')).toBeUndefined();
        expect(validateTextValue(textField('url'), '')).toBeUndefined();
    });

    // Each value below was checked against the server's create-post endpoint
    // or `model.ValidatePropertyValueForValueType`, which accept or refuse it
    // as listed.
    test.each([
        'foo@bar.com',
        ' foo@bar.com ',
        'a@b',
        'first.last+tag@sub.example.co',
        "o'brien@x.com",
        'josé@bücher.de',
        'user@[192.168.1.10]',
        'user@[0.0.0.0]',
    ])('email: accepts %j, as the server does', (value) => {
        expect(validateTextValue(textField('email'), value)).toBeUndefined();
    });

    test.each([
        'not-an-email',
        '<foo@bar.com>',
        'foo..bar@x.com',
        'foo;bar@x.com',
        '.foo@x.com',
        'foo.@x.com',
        'foo@bar..com',
        'a@b.com, c@d.com',
        'a@@b.com',
        'user@[256.1.1.1]',
        'user@[010.0.0.1]',
        'user@[1.2.3]',
        'user@[IPv6:2001:db8::1]',
        'user@[foo]',
    ])('email: refuses %j, as the server does', (value) => {
        expect(validateTextValue(textField('email'), value)?.id).toBe('post_attributes.text_value.invalid_email');
    });

    test('email: refuses uppercase, as the server does', () => {
        expect(validateTextValue(textField('email'), 'Foo@bar.com')?.id).toBe('post_attributes.text_value.uppercase_email');
    });

    test.each([
        'https://example.com/path',
        'ftp://files.example.com',
        'http://localhost:8065',
        'http://[::1]:8065/',
        'http://[fe80::1%25eth0]/',
        'http://user@[fe80::1%25en0]:8080/path',
        'http://[fe80::1%25eth0]/100%25',
        'http://example.com/100%25',
        'http://example.com/a?q=100%',
        'http://example.com/a\\b',
        'https://ex%C3%A9mple.com',
        'http://user%41@example.com/',
        '\u0085https://example.com\u0085',
    ])('url: accepts %j, as the server does', (value) => {
        expect(validateTextValue(textField('url'), value)).toBeUndefined();
    });

    test.each([
        'https:example.com',
        'http:/example.com',
        'http://',
        '/relative/path',
        'not a url',
        'example.com',
        'file:///etc/hosts',
        'mailto:a@b.com',
        'http://[fe80::1%25]/',
        'http://[fe80::1%eth0]/',
        'http://[abc]/',
        'http://[fe80::1%25eth0]/100%',
        'http://example.com/100%',
        'http://example.com/%zz',
        'http://example.com/a#f%',
        'http://example.com\\path',
        'http://us\\er@example.com/',
        'https://exa\tmple.com',
        'https://example.com/a\nb',
        'http://exa\x7fmple.com',
        'https://ex%41mple.com',
        'http://ex%2Fample.com',
        '\ufeffhttps://example.com',
    ])('url: refuses %j, as the server does', (value) => {
        expect(validateTextValue(textField('url'), value)?.id).toBe('post_attributes.text_value.invalid_url');
    });
});
