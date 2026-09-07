// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    ACCESS_CONTROL_ACTION_DOWNLOAD_FILE,
    ACCESS_CONTROL_ACTION_MEMBERSHIP,
    ACCESS_CONTROL_ACTION_UPLOAD_FILE,
    ACCESS_CONTROL_ACTION_ACCESS_CHANNEL,
    ACCESS_CONTROL_PERMISSION_ACTIONS,
    buildRulesWithMembership,
    buildRulesWithPermissionRules,
    combineMembershipExpressions,
    getMembershipRule,
    getPermissionRules,
    hasOverlappingPermissionRules,
} from './access_control';
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
});

describe('access_channel as a permission action', () => {
    test('is part of the permission action set', () => {
        expect(ACCESS_CONTROL_PERMISSION_ACTIONS).toContain(ACCESS_CONTROL_ACTION_ACCESS_CHANNEL);
        expect(ACCESS_CONTROL_ACTION_ACCESS_CHANNEL).toBe('access_channel');
    });

    test('getPermissionRules picks up access_channel rules', () => {
        const rules: AccessControlPolicyRule[] = [
            {actions: [ACCESS_CONTROL_ACTION_MEMBERSHIP], expression: 'membership_expr'},
            {name: 'Access', role: 'channel_user', actions: [ACCESS_CONTROL_ACTION_ACCESS_CHANNEL], expression: 'access_expr'},
        ];
        expect(getPermissionRules(rules)).toEqual([
            {name: 'Access', role: 'channel_user', actions: [ACCESS_CONTROL_ACTION_ACCESS_CHANNEL], expression: 'access_expr'},
        ]);
    });

    test('hasOverlappingPermissionRules detects two access_channel rules for the same role', () => {
        const overlapping: AccessControlPolicyRule[] = [
            {name: 'A', role: 'channel_user', actions: [ACCESS_CONTROL_ACTION_ACCESS_CHANNEL], expression: 'a'},
            {name: 'B', role: 'channel_user', actions: [ACCESS_CONTROL_ACTION_ACCESS_CHANNEL], expression: 'b'},
        ];
        expect(hasOverlappingPermissionRules(overlapping)).toBe(true);

        const distinct: AccessControlPolicyRule[] = [
            {name: 'A', role: 'channel_user', actions: [ACCESS_CONTROL_ACTION_ACCESS_CHANNEL], expression: 'a'},
            {name: 'B', role: 'channel_guest', actions: [ACCESS_CONTROL_ACTION_ACCESS_CHANNEL], expression: 'b'},
        ];
        expect(hasOverlappingPermissionRules(distinct)).toBe(false);
    });

    test('buildRulesWithPermissionRules replaces access_channel rules and keeps membership', () => {
        const existing: AccessControlPolicyRule[] = [
            {actions: [ACCESS_CONTROL_ACTION_MEMBERSHIP], expression: 'membership_expr'},
            {name: 'Old access', role: 'channel_user', actions: [ACCESS_CONTROL_ACTION_ACCESS_CHANNEL], expression: 'old'},
            {name: 'Old upload', role: 'channel_user', actions: [ACCESS_CONTROL_ACTION_UPLOAD_FILE], expression: 'old'},
        ];
        const replacement: AccessControlPolicyRule[] = [
            {name: 'New access', role: 'channel_admin', actions: [ACCESS_CONTROL_ACTION_ACCESS_CHANNEL], expression: 'new'},
        ];
        expect(buildRulesWithPermissionRules(existing, replacement)).toEqual([
            {actions: [ACCESS_CONTROL_ACTION_MEMBERSHIP], expression: 'membership_expr'},
            {name: 'New access', role: 'channel_admin', actions: [ACCESS_CONTROL_ACTION_ACCESS_CHANNEL], expression: 'new'},
        ]);
    });

    test('buildRulesWithMembership preserves an access_channel rule', () => {
        const existing: AccessControlPolicyRule[] = [
            {actions: [ACCESS_CONTROL_ACTION_MEMBERSHIP], expression: 'old_membership'},
            {name: 'Access', role: 'channel_user', actions: [ACCESS_CONTROL_ACTION_ACCESS_CHANNEL], expression: 'access_expr'},
        ];
        expect(buildRulesWithMembership(existing, 'new_membership')).toEqual([
            {actions: [ACCESS_CONTROL_ACTION_MEMBERSHIP], expression: 'new_membership'},
            {name: 'Access', role: 'channel_user', actions: [ACCESS_CONTROL_ACTION_ACCESS_CHANNEL], expression: 'access_expr'},
        ]);
    });

    test('a rule mixing access_channel with a file action counts once per action', () => {
        const rules: AccessControlPolicyRule[] = [{
            name: 'Managed devices',
            role: 'channel_user',
            actions: [ACCESS_CONTROL_ACTION_ACCESS_CHANNEL, ACCESS_CONTROL_ACTION_DOWNLOAD_FILE],
            expression: 'expr',
        }];
        expect(getPermissionRules(rules)).toHaveLength(1);
        expect(hasOverlappingPermissionRules(rules)).toBe(false);
    });
});
