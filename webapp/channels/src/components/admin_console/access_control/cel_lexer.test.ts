// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    BREAKOUT_OR_E,
    BREAKOUT_OR_RETURNED,
    BREAKOUT_TERNARY_E,
    BREAKOUT_TERNARY_RETURNED,
    COMMENT_E,
    COMMENT_RETURNED,
    COMMENT_SUBMITTED,
    COMMENT_SUBMITTED_NO_NEWLINE,
    FIELD_DELETED_RETURNED,
    MASKED_MIXED_RETURNED,
    MASKED_RETURNED,
    PROGRAM_DRAGON,
    SERIALIZER_CASES,
    fixture,
} from './bot_scope/serializer_test_fixtures';
import {findMatchingParen, hasBalancedParens, isWrappedInParens, referencedUserAttributeNames, splitOutsideLiterals} from './cel_lexer';

describe('hasBalancedParens', () => {
    it.each([
        [BREAKOUT_TERNARY_E, false],
        [BREAKOUT_OR_E, false],
        ['"unterminated', false],
        ['(x == "a"', false],
        ['x // (\n)', false],
        ['x == "a\n"', false],
        ['x == "a\r"', false],
        ["x == 'unterminated", false],
        ['x == "a\\', false],
        [')(', false],
        ['(a))', false],
        [COMMENT_E, true],
        ['x == ")"', true],
        ['x // (', true],
        [PROGRAM_DRAGON, true],
        ['x == "a\\")"', true],
        ['x == \'")\' && (y == "\'(")', true],
        ['x == "//(" && (y)', true],
        ['x // )\n', true],
        ['(a) // )', true],
        ['', true],
    ])('%j -> %s', (input, expected) => {
        expect(hasBalancedParens(input)).toBe(expected);
    });

    it.each([
        ['triple-quoted OR breakout', '"""a"b""") || (true || """c"d"""'],
        ['raw-string OR breakout', 'r"\\") || (true || \'"\\\'\''],
        ['raw-string ternary breakout', 'R"\\") ? (true) : (true || \'"\\\'\''],
        ['raw string', 'x == r"("'],
        ['triple single-quoted string', "x == '''('''"],
        ['triple-quoted string', 'x == """a"""'],
        ['bytes raw string', 'x == br"a"'],
    ])('fails closed on %s', (_, input) => {
        expect(hasBalancedParens(input)).toBe(false);
    });

    it.each([
        ['LF', 'x == "a\\\n) || (true"'],
        ['CR', 'x == "a\\\r) || (true"'],
    ])('does not let a backslash continue a literal across %s', (_, input) => {
        expect(hasBalancedParens(input)).toBe(false);
    });

    it.each(SERIALIZER_CASES)('$name returned is balanced', ({returned}) => {
        expect(hasBalancedParens(returned)).toBe(true);
    });

    it.each([
        MASKED_RETURNED,
        MASKED_MIXED_RETURNED,
        FIELD_DELETED_RETURNED,
        COMMENT_SUBMITTED,
        COMMENT_RETURNED,
        BREAKOUT_OR_RETURNED,
        BREAKOUT_TERNARY_RETURNED,
    ])('%j is balanced', (input) => {
        expect(hasBalancedParens(input)).toBe(true);
    });

    it('treats the newline-less commented wrap as unbalanced', () => {
        expect(hasBalancedParens(COMMENT_SUBMITTED_NO_NEWLINE)).toBe(false);
    });
});

describe('findMatchingParen', () => {
    it.each([
        ['(a) && (b)', 0, 2],
        ['(a) && (b)', 7, 9],
        ['(a) && (b)', 1, -1],
        ['"(" && (b)', 1, -1],
        ['"(" && (b)', 7, 9],
        ['(a', 0, -1],
        ['((a) || b)', 0, 9],
        ['((a) || b)', 1, 3],
        ['(a == ")")', 0, 9],
        ['x // (\n(y)', 5, -1],
        ['x // (\n(y)', 7, 9],
        ['(a)', -1, -1],
        ['(a)', 3, -1],
        ['', 0, -1],
    ])('findMatchingParen(%j, %i) -> %i', (s, openIdx, expected) => {
        expect(findMatchingParen(s, openIdx)).toBe(expected);
    });

    it.each([
        ['an unmatched later )', '(a)) && (b)', 0],
        ['an unmatched later )', '(a)) && (b)', 8],
        ['a later unclosed (', '(a) && (b', 0],
        ['an unterminated string', '(a) "x', 0],
        ['a raw string', '(a) && r"x"', 0],
    ])('returns -1 on input with %s', (_, s, openIdx) => {
        expect(findMatchingParen(s, openIdx)).toBe(-1);
    });
});

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
        expect(referencedUserAttributeNames(fixture('d3 masking on GET').unwrapped)).toEqual(['Tags', 'Clearance']);
    });

    it('collects names from a ternary fixture', () => {
        expect(referencedUserAttributeNames(fixture('c masking on GET').unwrapped)).toEqual(['Program', 'Clearance']);
    });

    it('finds no names in the ID-encoded search form', () => {
        expect(referencedUserAttributeNames(fixture('a masking on search').unwrapped)).toEqual([]);
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

    it('still ignores names that appear only in string literals', () => {
        expect(referencedUserAttributeNames('user.attributes.A == "user.attributes.B" && user.attributes.C in [\'user.attributes.D\']')).toEqual(['A', 'C']);
    });
});

describe('lexer: merged literal masking and paren scan', () => {
    it.each([
        ['a raw string', 'user.attributes.A == r"x" && user.attributes.B == "y"', ['A', 'B']],
        ['a triple-quoted string', 'user.attributes.A == """x""" && user.attributes.B == "y"', ['A', 'B']],
        ['an unterminated literal', 'user.attributes.A == "x\nuser.attributes.B == "y"', ['A', 'B']],
        ['a backslash before a newline', 'user.attributes.A == "x\\\nuser.attributes.B == "y"', ['A', 'B']],
    ])('keeps finding references after %s while failing closed on parens', (_label, input, expected) => {
        expect(referencedUserAttributeNames(input)).toEqual(expected);
        expect(hasBalancedParens(input)).toBe(false);
    });

    it('treats a bytes literal as an ordinary literal', () => {
        const input = 'user.attributes.A == b"x" && user.attributes.B == "y"';
        expect(referencedUserAttributeNames(input)).toEqual(['A', 'B']);
        expect(hasBalancedParens(input)).toBe(true);
    });

    it('keeps the newline that ends a comment, so bracket access on the next line still matches', () => {
        expect(referencedUserAttributeNames('user.attributes // c\n["B"] == "x"')).toEqual(['B']);
    });

    it('ignores parens after a fail-closed point', () => {
        expect(findMatchingParen('r"x" && (a)', 8)).toBe(-1);
    });
});

describe('isWrappedInParens', () => {
    it.each([
        ['(a)', true],
        ['((a) || b)', true],
        ['(a == ")")', true],
        ['(a // )\n)', true],
        ['(a) || (b)', false],
        ['(a', false],
        ['a)', false],
        ['(a))', false],
        ['(a == "x)', false],
        ['(a == r"x")', false],
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
    ])('splits %j on %j', (input, separator, expected) => {
        expect(splitOutsideLiterals(input, separator)).toEqual(expected);
    });
});
