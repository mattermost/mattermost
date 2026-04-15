// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChannelWithTeamData} from './channels';
import type {UserProfile} from './users';
export type AccessControlPolicy = {
    id: string;
    name: string;
    type: string;
    revision?: number;
    created_at?: number;
    version?: string;
    active?: boolean;
    imports?: string[];
    props?: Record<string, unknown[]>;
    rules: AccessControlPolicyRule[];
    scope?: string;
    scope_id?: string;
}

export type AccessControlPolicyCursor = {
    id: string;
}

export type AccessControlPoliciesResult = {
    policies: AccessControlPolicy[];
    total: number;
}

export type AccessControlPolicySearchOpts = {
    term: string;
    type: string;
    cursor: AccessControlPolicyCursor;
    limit: number;
}

export type AccessControlPolicyChannelsResult = {
    channels: ChannelWithTeamData[];
    total: number;
}

export type AccessControlPolicyRule = {
    actions?: string[];
    expression: string;
}

/**
 * Returns the first rule with a "membership" action, falling back to rules[0]
 * only when it carries a wildcard action (legacy v0.2 policies).
 */
export function getMembershipRule(rules?: AccessControlPolicyRule[]): AccessControlPolicyRule | undefined {
    const membership = rules?.find((r) => r.actions?.includes('membership'));
    if (membership) {
        return membership;
    }
    const first = rules?.[0];
    if (first?.actions?.includes('*')) {
        return first;
    }
    return undefined;
}

/**
 * Replaces or inserts the membership rule in an existing rules array while
 * preserving all non-membership rules (e.g. file_upload, file_download).
 * If expression is empty the membership rule is removed.
 */
export function buildRulesWithMembership(existingRules: AccessControlPolicyRule[], expression: string): AccessControlPolicyRule[] {
    const otherRules = existingRules.filter((r) => !r.actions?.includes('membership'));
    if (!expression.trim()) {
        return otherRules;
    }
    return [{actions: ['membership'], expression: expression.trim()}, ...otherRules];
}

export type CELExpressionError = {
    message: string;
    line: number;
    column: number;
}

export type AccessControlTestResult = {
    users: UserProfile[];
    total: number;
}

export type AccessControlAttribute = {
    name: string;
    values: string[];
}

export type AccessControlVisualAST = {
    conditions: AccessControlVisualASTNode[];
}

export type AccessControlVisualASTNode = {
    attribute: string;
    operator: string;
    value: any;
    value_type: number;
    attribute_type: string;
}

/**
 * Type definition for access control attributes
 */
export type AccessControlAttributes = Record<string, string[]>;

/**
 * Interface for entities that can have access control
 */
export interface AccessControlled {

    /**
     * Whether access control is enforced for this entity
     */
    access_control_enforced?: boolean;
}

export type AccessControlPolicyActiveUpdate = {
    id: string;
    active: boolean;
}
