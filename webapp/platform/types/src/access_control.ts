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
    roles?: string[];
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

    /**
     * Admin-facing name. Required for v0.4 channel-scoped permission rules
     * (file upload/download). Must be unique within the same policy.
     */
    name?: string;

    /**
     * Channel-scoped role this rule applies to (channel_guest / channel_user /
     * channel_admin) for v0.4 permission rules. Membership rules leave this
     * empty.
     */
    role?: string;
}

export const ACCESS_CONTROL_POLICY_VERSION_V0_3 = 'v0.3';
export const ACCESS_CONTROL_POLICY_VERSION_V0_4 = 'v0.4';

export const ACCESS_CONTROL_ACTION_MEMBERSHIP = 'membership';
export const ACCESS_CONTROL_ACTION_UPLOAD_FILE = 'upload_file_attachment';
export const ACCESS_CONTROL_ACTION_DOWNLOAD_FILE = 'download_file_attachment';

export const ACCESS_CONTROL_PERMISSION_ACTIONS: string[] = [
    ACCESS_CONTROL_ACTION_UPLOAD_FILE,
    ACCESS_CONTROL_ACTION_DOWNLOAD_FILE,
];

export const ACCESS_CONTROL_CHANNEL_ROLE_GUEST = 'channel_guest';
export const ACCESS_CONTROL_CHANNEL_ROLE_USER = 'channel_user';
export const ACCESS_CONTROL_CHANNEL_ROLE_ADMIN = 'channel_admin';

export const ACCESS_CONTROL_CHANNEL_ROLES: string[] = [
    ACCESS_CONTROL_CHANNEL_ROLE_GUEST,
    ACCESS_CONTROL_CHANNEL_ROLE_USER,
    ACCESS_CONTROL_CHANNEL_ROLE_ADMIN,
];

/**
 * Returns the first rule with a "membership" action, falling back to rules[0]
 * only when it carries a wildcard action (legacy v0.2 policies).
 */
export function getMembershipRule(rules?: AccessControlPolicyRule[]): AccessControlPolicyRule | undefined {
    const membership = rules?.find((r) => r.actions?.includes(ACCESS_CONTROL_ACTION_MEMBERSHIP));
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
 * Returns the rules that govern non-membership actions (file upload/download
 * permission rules in v0.4). Membership rules and wildcard-action rules are
 * excluded.
 */
export function getPermissionRules(rules?: AccessControlPolicyRule[]): AccessControlPolicyRule[] {
    if (!rules) {
        return [];
    }
    return rules.filter((r) => Boolean(r.actions?.some((a) => ACCESS_CONTROL_PERMISSION_ACTIONS.includes(a))));
}

/**
 * Returns true if any pair of permission rules in the list shares the same
 * (role, action) tuple. The UI uses this to surface an "OR" hint explaining
 * that such rules are combined disjunctively at evaluation time.
 */
export function hasOverlappingPermissionRules(rules?: AccessControlPolicyRule[]): boolean {
    const seen = new Set<string>();
    for (const rule of getPermissionRules(rules)) {
        const role = rule.role || '';
        for (const action of rule.actions || []) {
            const key = `${role}\x00${action}`;
            if (seen.has(key)) {
                return true;
            }
            seen.add(key);
        }
    }
    return false;
}

/**
 * Replaces or inserts the membership rule in an existing rules array while
 * preserving all non-membership rules (e.g. file_upload, file_download).
 * If expression is empty the membership rule is removed.
 */
export function buildRulesWithMembership(existingRules: AccessControlPolicyRule[], expression: string): AccessControlPolicyRule[] {
    const otherRules = existingRules.filter((r) => !r.actions?.includes(ACCESS_CONTROL_ACTION_MEMBERSHIP));
    if (!expression.trim()) {
        return otherRules;
    }
    return [{actions: [ACCESS_CONTROL_ACTION_MEMBERSHIP], expression: expression.trim()}, ...otherRules];
}

/**
 * Replaces all v0.4 permission rules in an existing rules array with the
 * provided permission rules, preserving the membership rule (and any other
 * non-permission entries the backend may add later).
 */
export function buildRulesWithPermissionRules(existingRules: AccessControlPolicyRule[], permissionRules: AccessControlPolicyRule[]): AccessControlPolicyRule[] {
    const nonPermission = existingRules.filter((r) => !r.actions?.some((a) => ACCESS_CONTROL_PERMISSION_ACTIONS.includes(a)));
    return [...nonPermission, ...permissionRules];
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

/**
 * Sources of deny attribution returned by the simulate endpoint.
 *
 * - `this_rule`     — deny came from the rule the author is editing.
 * - `sibling_rule`  — deny came from another rule in the same draft policy.
 * - `channel_policy`— deny came from a sibling channel-policy rule.
 * - `system_permission` — deny came from a higher-scoped system permission policy.
 */
export const POLICY_SIMULATION_BLAME_SOURCES = {
    THIS_RULE: 'this_rule',
    SIBLING_RULE: 'sibling_rule',
    CHANNEL_POLICY: 'channel_policy',
    SYSTEM_PERMISSION: 'system_permission',
    NO_APPLICABLE_POLICY: 'no_applicable_policy',
    SIBLING_SAVED: 'sibling_saved',
} as const;

export type PolicySimulationBlameSource =
    typeof POLICY_SIMULATION_BLAME_SOURCES[keyof typeof POLICY_SIMULATION_BLAME_SOURCES];

export type PolicySimulationBlame = {
    source: PolicySimulationBlameSource;
    policy_id?: string;
    policy_name?: string;
    rule_name?: string;
    role?: string;
};

export type PolicySimulationActionDecision = {
    decision: boolean;
    blame?: PolicySimulationBlame[];
};

/**
 * Per-session decision row for the simulate UI's "Recent activity" expand.
 *
 * The simulator can return one entry per active session for a user so the
 * picker can surface why two sessions of the same person come back with
 * different verdicts (e.g. one session is on a managed device, the other
 * isn't). System admins see the user's real recent sessions; channel admins
 * receive a single synthetic session populated with default values that
 * they can override via the per-row session-attribute editor.
 */
export type PolicySimulationSession = {
    /** Stable session identifier. May be empty for synthetic sessions. */
    id?: string;

    /** Human label for the device/client (e.g. "MacBook Pro"). */
    device?: string;

    /** Network classification (e.g. "WiFi", "VPN", "Mobile"). */
    network?: string;

    /** Last-active timestamp in milliseconds since epoch. */
    last_active_at?: number;

    /** Per-action verdicts for this specific session. Same shape as the
     *  user-level `decisions` map. */
    decisions?: Record<string, PolicySimulationActionDecision>;
};

export type PolicySimulationUserResult = {
    user: UserProfile;
    decisions?: Record<string, PolicySimulationActionDecision>;

    /** Optional per-session breakdown. When populated the picker renders
     *  a Recent activity expand row revealing one decision chip per
     *  session. Empty/undefined falls back to a single user-level chip. */
    sessions?: PolicySimulationSession[];
};

export type PolicySimulationResponse = {
    results: PolicySimulationUserResult[];
    total: number;
    expression_only?: boolean;
};

/**
 * Scope for the simulate-by-users evaluation:
 *  - 'all'         — co-evaluate the draft against any other persisted
 *                    permission policies that govern the same channel/scope
 *                    (parent + system permission policies). Mirrors the
 *                    PEP's behaviour at request time.
 *  - 'this_policy' — evaluate only the draft policy. Authoring view.
 */
export type PolicyEvaluationScope = 'all' | 'this_policy';

export type PolicySimulationParams = {
    policy: AccessControlPolicy;
    actions?: string[];
    rule_name?: string;
    channel_id?: string;
    team_id?: string;
    term?: string;
    limit?: number;
    after?: string;
};

/**
 * Per-user payload for the picker-driven /cel/simulate_users endpoint. The
 * server resolves the user's profile attributes from CPA storage and then
 * layers session context on top: first the requesting admin's active-session
 * snapshot (when use_active_session is true), then the explicit
 * session_overrides map. Either source can be empty; both nil/empty means
 * "no session context" (strict default — rules referencing session.* will
 * surface as denies).
 */
export type PolicySimulationUserOverride = {
    user_id: string;
    use_active_session?: boolean;
    session_overrides?: Record<string, string>;
};

/**
 * Request body for /cel/simulate_users. Used by the picker-based "Test access
 * rule" UX where the author hand-picks specific users instead of asking the
 * server to search.
 */
export type PolicySimulationByUsersParams = {
    policy: AccessControlPolicy;
    actions: string[];
    rule_name?: string;
    channel_id?: string;
    team_id?: string;
    users: PolicySimulationUserOverride[];

    /** Evaluation scope. Defaults to 'this_policy' on the server when
     *  omitted to preserve the existing authoring-only semantics. The
     *  picker UI exposes this as a "Evaluate against: All policies / This
     *  policy only" toggle. */
    evaluation_scope?: PolicyEvaluationScope;
};
