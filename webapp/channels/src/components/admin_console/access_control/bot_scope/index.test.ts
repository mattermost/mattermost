// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AccessControlPolicy} from '@mattermost/types/access_control';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import {hasBalancedParens} from '../cel_lexer';
import {
    BREAKOUT_OR_RETURNED,
    BREAKOUT_TERNARY_RETURNED,
    COMMENT_E,
    COMMENT_RETURNED,
    FIELD_DELETED_RETURNED,
    MASKED_MIXED_RETURNED,
    MASKED_RETURNED,
    PROGRAM_DRAGON,
    SERIALIZER_CASES,
    fixture,
} from '../cel_serializer_test_fixtures';

import {
    BOT_ROLE_KEY,
    getPolicyRoleKey,
    getSyncedAttributeReferences,
    isBotScopePolicy,
    toServerRole,
    unwrapBotExpression,
    wrapBotExpression,
} from './index';

const makeField = (name: string, attrs: Partial<UserPropertyField['attrs']> = {}): UserPropertyField => ({
    id: `id-${name}`,
    name,
    type: 'text',
    group_id: 'custom_profile_attributes',
    target_id: '',
    target_type: '',
    object_type: 'user',
    attrs: {
        sort_order: 0,
        visibility: 'always',
        value_type: '',
        ...attrs,
    },
    create_at: 0,
    update_at: 0,
    delete_at: 0,
    created_by: '',
    updated_by: '',
});

describe('unwrapBotExpression', () => {
    it.each(SERIALIZER_CASES)('$name unwraps exactly', ({returned, unwrapped}) => {
        expect(unwrapBotExpression(returned)).toBe(unwrapped);
    });

    it('keeps the ternary condition parens while stripping the enclosing pair', () => {
        const result = unwrapBotExpression(fixture('c masking on GET').returned);
        expect(result.startsWith('(user.attributes.Program == "Dragon") ? (')).toBe(true);
        expect(result).toContain('&&\nuser.attributes.Program != "Phoenix")');
    });

    it('keeps a leading group that does not enclose the whole expression', () => {
        expect(unwrapBotExpression(fixture('d2 masking on GET').returned)).toBe('("a" in user.attributes.Tags || "b" in user.attributes.Tags) && user.attributes.Clearance == "Secret"');
    });

    it.each([
        [MASKED_RETURNED, 'user.attributes.Level == "--------"'],
        [MASKED_MIXED_RETURNED, 'user.attributes.Level == "--------" && user.attributes.Program == "Dragon"'],
        [FIELD_DELETED_RETURNED, 'user.attributes.Temp == "--------"'],
    ])('unwraps masked placeholder %j', (input, expected) => {
        expect(unwrapBotExpression(input)).toBe(expected);
    });

    it('strips a doubled prefix', () => {
        expect(unwrapBotExpression('!user.isbot || !user.isbot || (user.attributes.Program == "Dragon"\n)')).toBe('user.attributes.Program == "Dragon"');
    });

    it('strips every prefix from the server form of a prefixed body', () => {
        expect(unwrapBotExpression('!user.isbot || !user.isbot || x')).toBe('x');
    });

    it('unwraps the server form of a commented rule', () => {
        expect(unwrapBotExpression(COMMENT_RETURNED)).toBe(PROGRAM_DRAGON);
    });

    it('keeps parens when the first group closes early', () => {
        expect(unwrapBotExpression('!user.isbot || (user.attributes.A == "a") && (user.attributes.B == "b")')).toBe('(user.attributes.A == "a") && (user.attributes.B == "b")');
    });

    it('ignores parens inside string literals', () => {
        expect(unwrapBotExpression('!user.isbot || ("a)" in user.attributes.Tags || "b(" in user.attributes.Tags) && user.attributes.Clearance == "Secret"')).toBe('("a)" in user.attributes.Tags || "b(" in user.attributes.Tags) && user.attributes.Clearance == "Secret"');
    });

    it('ignores || and ( inside a string literal', () => {
        expect(unwrapBotExpression('!user.isbot || user.attributes.X == "a || (b"')).toBe('user.attributes.X == "a || (b"');
    });

    it('strips an enclosing pair whose body has parens in literals', () => {
        expect(unwrapBotExpression('!user.isbot || (user.attributes.X == ")" && user.attributes.Y == "(")')).toBe('user.attributes.X == ")" && user.attributes.Y == "("');
    });

    it('handles a single-quoted literal with an escaped quote', () => {
        expect(unwrapBotExpression("!user.isbot || (user.attributes.X == 'it\\'s (x'\n)")).toBe("user.attributes.X == 'it\\'s (x'");
    });

    it('returns non-prefixed input unchanged and untrimmed', () => {
        expect(unwrapBotExpression('  user.attributes.X == "a"  ')).toBe('  user.attributes.X == "a"  ');
    });

    it('returns empty input unchanged', () => {
        expect(unwrapBotExpression('')).toBe('');
    });

    it.each([
        ['masking failure', 'false'],
        ['leading whitespace', ' !user.isbot || x'],
        ['no spaces around ||', '!user.isbot||x'],
        ['bare negation', '!user.isbot'],
        ['prefix without trailing space', '!user.isbot ||'],
        ['positive isbot', 'user.isbot || x'],
        ['a breakout that lost the prefix', BREAKOUT_TERNARY_RETURNED],
    ])('returns %s unchanged', (_, expr) => {
        expect(unwrapBotExpression(expr)).toBe(expr);
    });

    it('returns an empty string for a bare prefix', () => {
        expect(unwrapBotExpression('!user.isbot || ')).toBe('');
    });

    it('returns an empty string for an empty wrapped body', () => {
        expect(unwrapBotExpression('!user.isbot || (\n)')).toBe('');
    });

    it('unwraps a prefix-kept OR breakout without hiding the || true', () => {
        expect(unwrapBotExpression(BREAKOUT_OR_RETURNED)).toBe('user.attributes.Program == "Dragon" || true');
    });

    it('strips only one enclosing pair', () => {
        expect(unwrapBotExpression('!user.isbot || ((user.attributes.A == "a"))')).toBe('(user.attributes.A == "a")');
    });

    it('does not strip an unbalanced leading paren', () => {
        expect(unwrapBotExpression('!user.isbot || (user.attributes.A == "a"')).toBe('(user.attributes.A == "a"');
    });
});

describe('wrapBotExpression', () => {
    // The newline keeps a trailing `// comment` in the rule from commenting out
    // the closing paren; without it the stored rule is unbalanced and the server rejects it.
    it('round-trips through the stored form with the newline before the closing paren', () => {
        const stored = wrapBotExpression(COMMENT_E);

        expect(stored).toBe('!user.isbot || (user.attributes.Program == "Dragon" // note\n)');
        expect(unwrapBotExpression(stored)).toBe(COMMENT_E);

        for (const expr of [
            PROGRAM_DRAGON,
            fixture('c masking on GET').unwrapped,
            fixture('d2 masking on GET').unwrapped,
            fixture('a masking on GET').unwrapped,
            '!user.isbot || x',
        ]) {
            expect(unwrapBotExpression(wrapBotExpression(expr))).toBe(expr);
        }
    });

    it('does not trim its input', () => {
        expect(wrapBotExpression('  x  ')).toContain('(  x  ');
    });

    it('produces balanced output for balanced input', () => {
        expect(hasBalancedParens(wrapBotExpression(COMMENT_E))).toBe(true);
        expect(hasBalancedParens(wrapBotExpression(PROGRAM_DRAGON))).toBe(true);
    });
});

describe('isBotScopePolicy', () => {
    const withProps = (props?: unknown) => ({props} as Pick<AccessControlPolicy, 'props'>);

    it('is true when props.bot_scope is true', () => {
        expect(isBotScopePolicy(withProps({bot_scope: true}))).toBe(true);
    });

    it('is true when props.bot_scope is true alongside other keys', () => {
        expect(isBotScopePolicy(withProps({bot_scope: true, child_ids: ['c1'], channel_count: 1}))).toBe(true);
    });

    it.each([
        ['props are missing', undefined],
        ['props are empty', {}],
        ['bot_scope is false', {bot_scope: false}],
        ['bot_scope is the string "true"', {bot_scope: 'true'}],
        ['bot_scope is 1', {bot_scope: 1}],
        ['bot_scope is null', {bot_scope: null}],
        ['only other keys are set', {bot: true, child_ids: []}],
    ])('is false when %s', (_, props) => {
        expect(isBotScopePolicy(withProps(props))).toBe(false);
    });

    it('ignores a bot-prefixed system_user rule without the flag', () => {
        const policy: Pick<AccessControlPolicy, 'props' | 'roles' | 'rules'> = {
            roles: ['system_user'],
            rules: [{actions: ['upload_file_attachment'], expression: MASKED_RETURNED}],
        };
        expect(isBotScopePolicy(policy)).toBe(false);
    });

    it('ignores the rule text when the flag is set', () => {
        const policy: Pick<AccessControlPolicy, 'props' | 'roles' | 'rules'> = {
            props: {bot_scope: true},
            roles: ['system_user'],
            rules: [{actions: ['upload_file_attachment'], expression: PROGRAM_DRAGON}],
        };
        expect(isBotScopePolicy(policy)).toBe(true);
    });
});

describe('getSyncedAttributeReferences', () => {
    const clearance = makeField('Clearance', {ldap: 'clearance'});
    const program = makeField('Program', {saml: 'program'});
    const tags = makeField('Tags');
    const level = makeField('Level', {managed: 'admin'});
    const prot = makeField('Prot', {protected: true});
    const emptyLdap = makeField('EmptyLdap', {ldap: ''});
    const fields = [clearance, program, tags, level, prot, emptyLdap];

    it('ignores names that appear only inside literals', () => {
        expect(getSyncedAttributeReferences('user.attributes.Clearance == "Secret" && user.attributes.Tags == "user.attributes.Program"', fields)).toEqual([clearance]);
    });

    it('returns LDAP and SAML fields in field order', () => {
        expect(getSyncedAttributeReferences('user.attributes.Program == "x" && user.attributes.Clearance == "y"', fields)).toEqual([clearance, program]);
    });

    it('excludes admin-managed, protected, empty-LDAP and plain fields', () => {
        expect(getSyncedAttributeReferences('user.attributes.Level == "Gold" && user.attributes.Prot == "x" && user.attributes.EmptyLdap == "z" && user.attributes.Tags == "a"', fields)).toEqual([]);
    });

    it('returns nothing for an empty expression', () => {
        expect(getSyncedAttributeReferences('', fields)).toEqual([]);
    });

    it('returns nothing when there are no fields', () => {
        expect(getSyncedAttributeReferences('user.attributes.Clearance == "Secret"', [])).toEqual([]);
    });

    it('returns each field once even when referenced repeatedly', () => {
        expect(getSyncedAttributeReferences('user.attributes.Clearance == "a" || user.attributes.Clearance == "b"', fields)).toEqual([clearance]);
    });

    it('ignores a synced name that is only commented out', () => {
        expect(getSyncedAttributeReferences('user.attributes.Tags == "a" // was user.attributes.Clearance', fields)).toEqual([]);
    });

    it('finds a synced name after a comment with an apostrophe', () => {
        expect(getSyncedAttributeReferences('// don\'t drop this\nuser.attributes.Tags == \'a\' && user.attributes.Clearance == "b"', fields)).toEqual([clearance]);
    });

    it('finds a synced name used with bracket access', () => {
        expect(getSyncedAttributeReferences('user.attributes["Program"] == "x"', fields)).toEqual([program]);
    });

    it('works on a fixture with newlines', () => {
        expect(getSyncedAttributeReferences(fixture('d3 masking on GET').unwrapped, fields)).toEqual([clearance]);
    });
});

describe('toServerRole', () => {
    it.each([
        [BOT_ROLE_KEY, 'system_user'],
        ['system_user', 'system_user'],
        ['system_guest', 'system_guest'],
        ['system_admin', 'system_admin'],
        ['custom_role', 'custom_role'],
    ])('toServerRole(%p) returns %p', (key, expected) => {
        expect(toServerRole(key)).toBe(expected);
    });
});

describe('getPolicyRoleKey', () => {
    it.each([
        ['an unflagged system_user policy', {roles: ['system_user']}, 'system_user'],
        ['a flagged system_user policy', {roles: ['system_user'], props: {bot_scope: true}}, BOT_ROLE_KEY],
        ['an unflagged system_user policy with a bot-prefixed rule', {roles: ['system_user'], rules: [{actions: [], expression: MASKED_RETURNED}]}, 'system_user'],
        ['an unflagged policy whose first of several roles is system_user', {roles: ['system_user', 'system_admin']}, 'system_user'],
        ['an unflagged policy with no roles', {roles: undefined}, undefined],
    ])('getPolicyRoleKey for %s', (_, policy, expected) => {
        expect(getPolicyRoleKey(policy as Pick<AccessControlPolicy, 'roles' | 'props'>)).toBe(expected);
    });
});
