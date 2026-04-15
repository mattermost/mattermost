// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getMembershipRule, buildRulesWithMembership} from './access_control';
import type {AccessControlPolicyRule} from './access_control';

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
