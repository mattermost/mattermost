// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fixture} from './cel_expression_test_fixtures';
import {everyPathRequires, isWrappedInParens, referencedSessionAttributeNames, referencedUserAttributeNames, splitOutsideLiterals} from './cel_lexer';

describe('referencedUserAttributeNames', () => {
    it.each([
        ['user.attributes.A == "user.attributes.B"', ['A']],
        ['user.attributes.A == "x" && user.attributes.B == "y" || user.attributes.A != "z"', ['A', 'B']],
        ["user.attributes.A == 'user.attributes.C' && \"x\" in user.attributes.Tags", ['A', 'Tags']],
        ['user.email == "a@b.c" && user.session.Platform == "desktop"', []],
        ['', []],
        ['user.attributes.A == "a \\" user.attributes.B"', ['A']],
        ['user.attributes.A_1 == "x"', ['A_1']],
    ])('%j -> %j', (input, expected) => {
        expect(referencedUserAttributeNames(input)).toEqual(expected);
    });

    it('collects names from a multi-line fixture in order of first occurrence', () => {
        expect(referencedUserAttributeNames(fixture('d3 masking on GET').expression)).toEqual(['Tags', 'Clearance']);
    });

    it('collects names from a ternary fixture', () => {
        expect(referencedUserAttributeNames(fixture('c masking on GET').expression)).toEqual(['Program', 'Clearance']);
    });

    it('finds no names in the ID-encoded search form', () => {
        expect(referencedUserAttributeNames(fixture('a masking on search').expression)).toEqual([]);
    });

    describe('comments', () => {
        it.each([
            ['a comment-only reference', 'user.attributes.A == "x" // was user.attributes.B', ['A']],
            ['a whole-line comment', '// user.attributes.B == "x"\nuser.attributes.A == "y"', ['A']],
            ['a trailing comment with no newline', 'user.attributes.A == "x" //user.attributes.B', ['A']],
            ['an apostrophe in a comment before a real reference', '// don\'t use teams\nuser.attributes.B == "x" && user.attributes.C == \'y\'', ['B', 'C']],
            ['a quote in a comment after a reference', 'user.attributes.A == "x" // the "B" one\n&& user.attributes.C == "y"', ['A', 'C']],
            ['// inside a string literal', 'user.attributes.A == "http://x" && user.attributes.B == "y"', ['A', 'B']],
            ['a comment marker inside a literal next to a reference', 'user.attributes.A.startsWith("//") && user.attributes.B == "y"', ['A', 'B']],
        ])('%s', (_label, input, expected) => {
            expect(referencedUserAttributeNames(input)).toEqual(expected);
        });
    });

    describe('bracket access', () => {
        it.each([
            ['double-quoted', 'user.attributes["teams"] == "x"', ['teams']],
            ['single-quoted', "user.attributes['teams'] == 'x'", ['teams']],
            ['with whitespace', 'user.attributes [ "Sales Region" ] == "x"', ['Sales Region']],
            ['mixed with dot access, in order and deduped', 'user.attributes.A == "x" && user.attributes["B"] == "y" && user.attributes["A"] != "z"', ['A', 'B']],
            ['inside a comment', 'user.attributes.A == "x" // user.attributes["B"]', ['A']],
            ['inside a string literal', 'user.attributes.A == "user.attributes[\'B\']"', ['A']],
            ['a non-literal index', 'user.attributes[user.attributes.A] == "x"', ['A']],
        ])('%s', (_label, input, expected) => {
            expect(referencedUserAttributeNames(input)).toEqual(expected);
        });
    });

    it.each([
        ['a raw string', 'user.attributes.A == r"x" && user.attributes.B == "y"'],
        ['a triple-quoted string', 'user.attributes.A == """x""" && user.attributes.B == "y"'],
        ['a bytes literal', 'user.attributes.A == b"x" && user.attributes.B == "y"'],
        ['an unterminated literal', 'user.attributes.A == "x\nuser.attributes.B == "y"'],
        ['a backslash before a newline', 'user.attributes.A == "x\\\nuser.attributes.B == "y"'],
    ])('keeps finding references after %s', (_label, input) => {
        expect(referencedUserAttributeNames(input)).toEqual(['A', 'B']);
    });

    it('still ignores names that appear only in string literals', () => {
        expect(referencedUserAttributeNames('user.attributes.A == "user.attributes.B" && user.attributes.C in [\'user.attributes.D\']')).toEqual(['A', 'C']);
    });
});

describe('referencedSessionAttributeNames', () => {
    it.each([
        ['user.session.Platform == "desktop"', ['Platform']],
        ['user.session.ip_address.inCIDR("10.0.0.0/8") && user.session["Platform"] == "desktop"', ['ip_address', 'Platform']],
        ['user.attributes.A == "user.session.B" // user.session.C', []],
        ['user.attributes.A == "x" && user.email == "a@b.c"', []],
        ['', []],
        ['"Platform" in user.session && user.attributes.A == "x"', ['Platform']],
        ["'Platform' in user . session || user.session.B == \"y\"", ['Platform', 'B']],
        ['"x" in user.session.Tags', ['Tags']],
        ['user.attributes.A == "\\"Platform\\" in user.session"', []],
        ['user.attributes.A == "x" // "Platform" in user.session', []],
    ])('%j -> %j', (input, expected) => {
        expect(referencedSessionAttributeNames(input)).toEqual(expected);
    });
});

describe('everyPathRequires', () => {
    const isTrusted = (condition: string) => condition.includes('T');

    it.each([
        ['T', true],
        ['u', false],
        ['', false],
        ['T && u', true],
        ['u && u', false],
        ['T || u', false],
        ['T || T', true],
        ['(T || u) && T', true],
        ['(T || u) && u', false],
        ['u && (T || T)', true],
        ['T && u || u', false],
        ['((T))', true],
        ['!T', true],
        ['!(T && u)', false],
        ['!(T || u)', true],
        ['!!(T || u)', false],
        ['u != "x" && T', true],
        ['T ? T : T', true],
        ['T ? u : T', true],
        ['u ? T : u', false],
        ['u ? T : T', true],
        ['T ? u : u', true],
        ['u ? u : T', false],
        ['u ? T : u ? T : T', true],
        ['u ? T : u ? T : u', false],
        ['(u ? T : u) || T', false],
        ['u.f(T || u)', true],
        ['u in [T || u]', true],
        ['T == "x || y"', true],
        ['T == "x" // || u', true],
        ['(T || u) // note', false],
        ['// note\n(T || u)', false],
        ['(T && u) // note', true],
        ['u // T', false],
    ])('%j -> %s', (input, expected) => {
        expect(everyPathRequires(input, isTrusted)).toBe(expected);
    });

    it('passes whole, trimmed conditions to the predicate', () => {
        const trusted = ['user.attributes.a.startsWith("x && y")', 'user.email.endsWith("e")'];
        const expr = 'user.attributes.a.startsWith("x && y") || (user.session.b in ["c", "d"] && !user.email.endsWith("e"))';

        expect(everyPathRequires(expr, (condition) => trusted.includes(condition))).toBe(true);
    });
});

describe('isWrappedInParens', () => {
    it.each([
        ['(a)', true],
        ['((a) || b)', true],
        ['(a == ")")', true],
        ["(a == ')(')", true],
        ['(a == "\\")")', true],
        ['(a // )\n)', true],
        ['(a == r"x")', true],
        ['(a) || (b)', false],
        ['(a) // )', false],
        ['(a', false],
        ['a)', false],
        ['a(b)', false],
        ['(a))', false],
        ['(a == "x)', false],
        ['(a // )', false],
        ['', false],
    ])('%j -> %s', (input, expected) => {
        expect(isWrappedInParens(input)).toBe(expected);
    });
});

describe('splitOutsideLiterals', () => {
    it.each([
        ['a && b', '&&', ['a ', ' b']],
        ['a', '&&', ['a']],
        ['', '&&', ['']],
        ['(a || b) && c', '&&', ['(a || b) ', ' c']],
        ['(a || b) && c', '||', ['(a ', ' b) && c']],
        ['x == "a && b" && y', '&&', ['x == "a && b" ', ' y']],
        ["x == 'a || \\' || b' || y", '||', ["x == 'a || \\' || b' ", ' y']],
        ['a // x && y\n&& b', '&&', ['a // x && y\n', ' b']],
        ['a // it\'s\n&& b', '&&', ['a // it\'s\n', ' b']],
        ['a &&& b', '&&', ['a ', '& b']],
        ['a |||| b', '||', ['a ', '', ' b']],
        ['a && "x', '&&', ['a ', ' "x']],
        ['a == "x && b', '&&', ['a == "x && b']],
        ['a == "x && b\n&& c', '&&', ['a == "x && b\n', ' c']],
    ])('splits %j on %j', (input, separator, expected) => {
        expect(splitOutsideLiterals(input, separator)).toEqual(expected);
    });
});
