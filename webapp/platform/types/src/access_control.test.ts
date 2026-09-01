// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getMembershipRule, buildRulesWithMembership, combineMembershipExpressions, getAutoAddFromRules, getAutoAddModeFromRules, autoAddModeForToggle, hasEffectiveRules} from './access_control';
import type {AccessControlPolicyRule} from './access_control';

describe('combineMembershipExpressions', () => {
    test('returns empty string when no expressions', () => {
        expect(combineMembershipExpressions([])).toBe('');
        expect(combineMembershipExpressions([undefined, '', '   '])).toBe('');
    });

    test('returns a single expression as-is (trimmed)', () => {
        expect(combineMembershipExpressions(['  a == 1  '])).toBe('a == 1');
        expect(combineMembershipExpressions([undefined, 'a == 1', ''])).toBe('a == 1');
    });

    test('ANDs multiple expressions, each wrapped in parentheses', () => {
        expect(combineMembershipExpressions(['a == 1', 'b == 2'])).toBe('(a == 1) && (b == 2)');
        expect(combineMembershipExpressions(['a == 1', undefined, 'b == 2', 'c == 3'])).
            toBe('(a == 1) && (b == 2) && (c == 3)');
    });
});

describe('getMembershipRule', () => {
    test('returns the membership rule when present', () => {
        const rules: AccessControlPolicyRule[] = [
            {actions: ['file_upload'], expression: 'upload_expr'},
            {actions: ['membership'], expression: 'membership_expr'},
        ];
        expect(getMembershipRule(rules)).toEqual({actions: ['membership'], expression: 'membership_expr'});
    });

    test('falls back to rules[0] for legacy v0.2 single-rule policy with wildcard action', () => {
        const rules: AccessControlPolicyRule[] = [
            {actions: ['*'], expression: 'legacy_expr'},
        ];
        expect(getMembershipRule(rules)).toEqual({actions: ['*'], expression: 'legacy_expr'});
    });

    test('returns undefined when rules contain only non-membership, non-wildcard actions', () => {
        const rules: AccessControlPolicyRule[] = [
            {actions: ['file_upload'], expression: 'upload_expr'},
            {actions: ['file_download'], expression: 'download_expr'},
        ];
        expect(getMembershipRule(rules)).toBeUndefined();
    });

    test('returns undefined for empty rules array', () => {
        expect(getMembershipRule([])).toBeUndefined();
    });

    test('returns undefined for undefined input', () => {
        expect(getMembershipRule(undefined)).toBeUndefined();
    });
});

describe('buildRulesWithMembership', () => {
    test('inserts membership rule and preserves non-membership rules', () => {
        const existing: AccessControlPolicyRule[] = [
            {actions: ['file_upload'], expression: 'upload_expr'},
            {actions: ['file_download'], expression: 'download_expr'},
        ];
        const result = buildRulesWithMembership(existing, 'new_membership_expr');
        expect(result).toEqual([
            {actions: ['membership'], expression: 'new_membership_expr'},
            {actions: ['file_upload'], expression: 'upload_expr'},
            {actions: ['file_download'], expression: 'download_expr'},
        ]);
    });

    test('replaces existing membership rule while preserving others', () => {
        const existing: AccessControlPolicyRule[] = [
            {actions: ['membership'], expression: 'old_expr'},
            {actions: ['file_upload'], expression: 'upload_expr'},
        ];
        const result = buildRulesWithMembership(existing, 'new_expr');
        expect(result).toEqual([
            {actions: ['membership'], expression: 'new_expr'},
            {actions: ['file_upload'], expression: 'upload_expr'},
        ]);
    });

    test('empty expression removes membership rule', () => {
        const existing: AccessControlPolicyRule[] = [
            {actions: ['membership'], expression: 'old_expr'},
            {actions: ['file_upload'], expression: 'upload_expr'},
        ];
        const result = buildRulesWithMembership(existing, '');
        expect(result).toEqual([
            {actions: ['file_upload'], expression: 'upload_expr'},
        ]);
    });

    test('whitespace-only expression removes membership rule', () => {
        const existing: AccessControlPolicyRule[] = [
            {actions: ['membership'], expression: 'old_expr'},
        ];
        const result = buildRulesWithMembership(existing, '   ');
        expect(result).toEqual([]);
    });

    test('trims whitespace from expression', () => {
        const result = buildRulesWithMembership([], '  some_expr  ');
        expect(result).toEqual([
            {actions: ['membership'], expression: 'some_expr'},
        ]);
    });

    test('empty existing rules with valid expression creates membership-only array', () => {
        const result = buildRulesWithMembership([], 'expr');
        expect(result).toEqual([
            {actions: ['membership'], expression: 'expr'},
        ]);
    });

    test('omitting autoAdd carries the stored metadata through unchanged', () => {
        const existing: AccessControlPolicyRule[] = [
            {actions: ['membership'], expression: 'old_expr', metadata: {auto_add: 'always'}},
        ];
        expect(buildRulesWithMembership(existing, 'new_expr')).toEqual([
            {actions: ['membership'], expression: 'new_expr', metadata: {auto_add: 'always'}},
        ]);
    });

    test('an explicit autoAdd overrides the stored metadata', () => {
        const existing: AccessControlPolicyRule[] = [
            {actions: ['membership'], expression: 'old_expr', metadata: {auto_add: 'always'}},
        ];
        expect(buildRulesWithMembership(existing, 'new_expr', null)).toEqual([
            {actions: ['membership'], expression: 'new_expr', metadata: {auto_add: ''}},
        ]);
    });

    test('keeps an expression-less membership rule alive to carry auto-add', () => {
        expect(buildRulesWithMembership([], '', 'always')).toEqual([
            {actions: ['membership'], expression: '', metadata: {auto_add: 'always'}},
        ]);
    });

    test('keeps an expression-less rule for an explicit off so the server can act on it', () => {
        const existing: AccessControlPolicyRule[] = [
            {actions: ['membership'], expression: 'old_expr', metadata: {auto_add: 'always'}},
        ];
        expect(buildRulesWithMembership(existing, '', null)).toEqual([
            {actions: ['membership'], expression: '', metadata: {auto_add: ''}},
        ]);
    });

    test('drops the membership rule when there is no expression and nothing to carry', () => {
        const existing: AccessControlPolicyRule[] = [
            {actions: ['membership'], expression: 'old_expr'},
            {actions: ['file_upload'], expression: 'upload_expr'},
        ];
        expect(buildRulesWithMembership(existing, '')).toEqual([
            {actions: ['file_upload'], expression: 'upload_expr'},
        ]);
    });
});

describe('getAutoAddFromRules', () => {
    test('reads the mode off the membership rule', () => {
        const rules: AccessControlPolicyRule[] = [
            {actions: ['file_upload'], expression: 'upload_expr', metadata: {auto_add: 'always'}},
            {actions: ['membership'], expression: 'expr', metadata: {auto_add: 'always'}},
        ];
        expect(getAutoAddFromRules(rules)).toBe(true);
        expect(getAutoAddModeFromRules(rules)).toBe('always');
    });

    test('is false when the membership rule carries no mode', () => {
        expect(getAutoAddFromRules([{actions: ['membership'], expression: 'expr'}])).toBe(false);
        expect(getAutoAddFromRules([{actions: ['membership'], expression: 'expr', metadata: {}}])).toBe(false);
        expect(getAutoAddFromRules([{actions: ['membership'], expression: 'expr', metadata: {auto_add: ''}}])).toBe(false);
    });

    test('is false for a mode this client does not know', () => {
        const rules = [{actions: ['membership'], expression: 'expr', metadata: {auto_add: 'only_once'}}] as AccessControlPolicyRule[];
        expect(getAutoAddFromRules(rules)).toBe(false);
        expect(getAutoAddModeFromRules(rules)).toBeUndefined();
    });

    test('is false when there is no membership rule at all', () => {
        expect(getAutoAddFromRules([])).toBe(false);
        expect(getAutoAddFromRules(undefined)).toBe(false);
    });
});

describe('autoAddModeForToggle', () => {
    test('an enabled toggle asks for the always mode', () => {
        expect(autoAddModeForToggle(true)).toBe('always');
    });

    test('a disabled toggle asks for off rather than for preserve', () => {
        expect(autoAddModeForToggle(false)).toBeNull();
    });
});

describe('hasEffectiveRules', () => {
    test('ignores a membership rule that only carries metadata', () => {
        expect(hasEffectiveRules([{actions: ['membership'], expression: '', metadata: {auto_add: 'always'}}])).toBe(false);
        expect(hasEffectiveRules([{actions: ['membership'], expression: '   '}])).toBe(false);
    });

    test('is true once any rule has an expression', () => {
        expect(hasEffectiveRules([
            {actions: ['membership'], expression: '', metadata: {auto_add: 'always'}},
            {actions: ['file_upload'], expression: 'upload_expr'},
        ])).toBe(true);
    });

    test('is false for an empty or missing rules array', () => {
        expect(hasEffectiveRules([])).toBe(false);
        expect(hasEffectiveRules(undefined)).toBe(false);
    });
});
