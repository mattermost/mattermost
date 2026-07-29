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
};

export type AccessControlPolicyCursor = {
    id: string;
};

export type AccessControlPoliciesResult = {
    policies: AccessControlPolicy[];
    total: number;
};

export type AccessControlPolicySearchOpts = {
    term: string;
    type: string;
    cursor: AccessControlPolicyCursor;
    limit: number;
};

export type AccessControlPolicyChannelsResult = {
    channels: ChannelWithTeamData[];
    total: number;
};

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
};

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

// ANDs CEL membership expressions; searchUsersForExpression doesn't resolve
// policy imports, so callers combine them here.
export function combineMembershipExpressions(expressions: Array<string | undefined>): string {
    const parts = expressions.
        map((expr) => expr?.trim()).
        filter((expr): expr is string => Boolean(expr));

    if (parts.length === 0) {
        return '';
    }
    if (parts.length === 1) {
        return parts[0]!;
    }
    return parts.map((expr) => `(${expr})`).join(' && ');
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
 *
 * Legacy v0.1/v0.2 policies stored the membership rule with a wildcard
 * action (`actions: ['*']`) instead of the explicit `membership` action;
 * `getMembershipRule` already treats both shapes equivalently. Mirror
 * that here so a wildcard membership rule isn't preserved alongside the
 * newly inserted explicit one — the user would otherwise end up with
 * two membership rules in the same payload.
 */
export function buildRulesWithMembership(existingRules: AccessControlPolicyRule[], expression: string): AccessControlPolicyRule[] {
    const otherRules = existingRules.filter((r) =>
        !r.actions?.includes(ACCESS_CONTROL_ACTION_MEMBERSHIP) &&
        !r.actions?.includes('*'),
    );
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
};

export type AccessControlTestResult = {
    users: UserProfile[];
    total: number;
};

export type AccessControlAttribute = {
    name: string;
    values: string[];
};

export type AccessControlVisualAST = {
    conditions: AccessControlVisualASTNode[];
};

export type AccessControlVisualASTNode = {
    attribute: string;
    operator: string;
    value: any;
    value_type: number;
    attribute_type: string;
    has_masked_values?: boolean;
};

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
};

/**
 * Sources of deny attribution returned by the simulate endpoint.
 *
 * - `this_rule`         — deny came from the rule the author is editing.
 * - `sibling_rule`      — deny came from another rule in the same draft policy.
 * - `sibling_saved`     — sibling rule converted a draft-side deny into an allow.
 * - `peer_policy`       — deny came from another persisted policy at the SAME
 *                         scope as the draft (same Type and ParentID). The
 *                         public-server reclassifies system_permission entries
 *                         to peer_policy when the blamed policy is at the
 *                         editing scope so the picker can show its name + the
 *                         failing rule's expression.
 * - `channel_policy`    — deny came from a higher-scoped channel/parent policy.
 *                         Treated as opaque (no expression exposed).
 * - `system_permission` — deny came from a TRULY higher-scoped permission
 *                         policy. Treated as opaque.
 * - `no_applicable_policy` — synthetic vacuous-allow marker emitted when the
 *                         whole draft policy doesn't apply to a candidate user
 *                         (e.g. a system_user user added to a system_admin
 *                         policy).
 * - `no_applicable_rule` — synthetic vacuous-allow marker emitted under the
 *                         "this rule only" view when the rule the author is
 *                         editing is silent on a candidate user. Distinct
 *                         from no_applicable_policy because the policy as a
 *                         whole may still grant the verdict via a sibling
 *                         rule — only THIS rule didn't.
 */
export const POLICY_SIMULATION_BLAME_SOURCES = {
    THIS_RULE: 'this_rule',
    SIBLING_RULE: 'sibling_rule',
    CHANNEL_POLICY: 'channel_policy',
    SYSTEM_PERMISSION: 'system_permission',
    PEER_POLICY: 'peer_policy',
    NO_APPLICABLE_POLICY: 'no_applicable_policy',
    NO_APPLICABLE_RULE: 'no_applicable_rule',
    SIBLING_SAVED: 'sibling_saved',
} as const;

export type PolicySimulationBlameSource =
    typeof POLICY_SIMULATION_BLAME_SOURCES[keyof typeof POLICY_SIMULATION_BLAME_SOURCES];

/**
 * Per-blame verdict. Most entries carry the deny that produced the
 * overall decision; the simulator additionally emits informational
 * entries with `outcome: 'allow'` so the picker can show
 * "your draft policy allowed this user" alongside any peer policies'
 * deny attribution. Empty / undefined is treated as deny for
 * backward compatibility with simulator builds that pre-date the field.
 */
export const POLICY_SIMULATION_BLAME_OUTCOMES = {
    DENY: 'deny',
    ALLOW: 'allow',
} as const;

export type PolicySimulationBlameOutcome =
    typeof POLICY_SIMULATION_BLAME_OUTCOMES[keyof typeof POLICY_SIMULATION_BLAME_OUTCOMES];

export type PolicySimulationBlame = {
    source: PolicySimulationBlameSource;

    /** Per-blame verdict. Defaults to `deny` when omitted (backward
     *  compatibility with older simulators that only emitted denying
     *  attribution). Allow entries are informational — they let the
     *  picker render "your draft policy allows this user" sections
     *  alongside any peer-policy denies in multi-policy contexts. */
    outcome?: PolicySimulationBlameOutcome;

    policy_id?: string;
    policy_name?: string;
    rule_name?: string;
    role?: string;

    /** CEL text of the contributing rule. Only populated for blame
     *  entries at the draft's own scope (this_rule, sibling_rule,
     *  sibling_saved, peer_policy). Truly upper-scoped sources omit
     *  this so the picker can't leak the expression of a policy
     *  outside the editing scope. */
    expression?: string;

    /** Per-node evaluation trace for the contributing rule, mirroring
     *  the Go cel_utils.EvaluationNode struct. Same scope-privacy
     *  rule as `expression`: only populated for draft-side and
     *  peer-policy blame. The picker renders this as a structured
     *  AND/OR/NOT tree showing exactly which sub-expression(s)
     *  produced the deny — when absent the modal falls back to the
     *  flat expression text. */
    evaluation_tree?: PolicySimulationEvaluationNode;

    /** When the contribution is the OR-fold of multiple authored
     *  rules sharing the same `(role, action)` pair (the engine's
     *  JoinExpressions merge), this lists every contributing rule —
     *  in policy order, matching JoinExpressions' input order — so
     *  the picker can render numbered per-rule sections that line up
     *  1:1 with the merged expression's branches. The merged AST
     *  shape `or(or(a,b), c)` is ambiguous between
     *  "two rules, where rule1 is `a||b`" and "three single-clause
     *  rules" so we can't recover the mapping client-side; the
     *  simulator computes it server-side and surfaces it here.
     *
     *  Only populated for same-scope blame (this_rule / sibling_rule
     *  / sibling_saved / peer_policy). Truly upper-scoped sources
     *  intentionally omit this so the picker can't enumerate the
     *  rules of an out-of-scope policy. Single-rule contributions
     *  also omit it — the simpler "Rule: <name>" header is enough
     *  when no merging is happening. */
    merged_rules?: PolicySimulationMergedRule[];
};

/**
 * One contributing rule's metadata + standalone evaluation tree
 * inside a `PolicySimulationBlame.merged_rules` list. The tree mirrors
 * just this rule's expression (not the merged whole) so the picker
 * can render per-rule outcome chips and per-rule trace breakdowns
 * alongside the merged tree. Same scope-privacy rule as
 * `PolicySimulationBlame.expression`.
 */
export type PolicySimulationMergedRule = {

    /** Author-supplied rule name (matches AccessControlPolicy.Rules[i].name). */
    name: string;

    /** CEL text of just this rule, before JoinExpressions wraps it. */
    expression?: string;

    /** Standalone per-node evaluation breakdown of `expression`
     *  evaluated against the same activation as the merged tree, so
     *  the per-rule and merged views never disagree on actual
     *  attribute values. */
    evaluation_tree?: PolicySimulationEvaluationNode;
};

/**
 * Classifier for nodes in PolicySimulationEvaluationNode trees.
 *
 * - `and` / `or` / `not`     — boolean compounds; carry `children`.
 * - `compare`                — binary operator leaf (==, !=, <, in, ...).
 * - `function`               — receiver-style function leaf (.startsWith,
 *                              .endsWith, .contains).
 * - `other`                  — any shape we don't decompose (bare
 *                              attribute reference, ternary, ...). The
 *                              outcome is still meaningful but
 *                              attribute / actual / expected may be
 *                              absent.
 */
export const POLICY_SIMULATION_EVALUATION_NODE_KIND = {
    AND: 'and',
    OR: 'or',
    NOT: 'not',
    COMPARE: 'compare',
    FUNCTION: 'function',
    OTHER: 'other',
} as const;

export type PolicySimulationEvaluationNodeKind =
    typeof POLICY_SIMULATION_EVALUATION_NODE_KIND[keyof typeof POLICY_SIMULATION_EVALUATION_NODE_KIND];

/**
 * Three-way outcome for an evaluation node, mirroring the Go
 * cel_utils.EvaluationOutcome. Errors (missing attributes, type
 * mismatches) propagate up compound nodes only when no concrete
 * short-circuit applies (any false → false in AND, any true → true
 * in OR).
 */
export const POLICY_SIMULATION_EVALUATION_OUTCOME = {
    TRUE: 'true',
    FALSE: 'false',
    ERROR: 'error',
} as const;

export type PolicySimulationEvaluationOutcome =
    typeof POLICY_SIMULATION_EVALUATION_OUTCOME[keyof typeof POLICY_SIMULATION_EVALUATION_OUTCOME];

/**
 * Per-node entry in a PolicySimulationBlame.evaluation_tree. The
 * structure mirrors the boolean shape of the failing rule's CEL
 * expression — every conjunct/disjunct/negation gets its own node
 * with an Outcome, and leaves carry the attribute path + the user's
 * actual value alongside the expected literal.
 *
 * JSON shape matches the Go struct verbatim; new optional fields can
 * be added without breaking existing renderers.
 */
export type PolicySimulationEvaluationNode = {
    kind: PolicySimulationEvaluationNodeKind;

    /** Textual form of THIS subtree, suitable for rendering a snippet
     *  without rebuilding text from the AST. */
    expression: string;

    outcome: PolicySimulationEvaluationOutcome;

    /** Human-readable evaluation-time error (e.g. missing attribute,
     *  type mismatch). Populated only when `outcome === 'error'`. */
    error?: string;

    /** Operator string for leaf nodes: `==`, `!=`, `<`, `<=`, `>`,
     *  `>=`, `in`, `startsWith`, `endsWith`, `contains`. Empty for
     *  compound and `other` nodes. */
    operator?: string;

    /** User-attribute path on a leaf comparison
     *  (e.g. `user.attributes.region`). Empty when the leaf does not
     *  reference an attribute or when both sides are non-attribute
     *  expressions. */
    attribute?: string;

    /** Display-formatted user value for `attribute`. Empty when the
     *  attribute is missing — `outcome` will be `error` in that case. */
    actual_value?: string;

    /** Display-formatted literal the leaf compared against. Empty
     *  when the other side is itself an attribute reference. */
    expected_value?: string;

    /** Operands of a compound node, walked in expression order. Empty
     *  for leaf and `other` nodes. */
    children?: PolicySimulationEvaluationNode[];
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

    /** Session-attribute snapshot the simulator used when evaluating
     *  this session (network_status, device_managed, ip_range, etc.).
     *  Surfaced in the per-row "Decision details" view so the author
     *  can read the deny like an evaluation trace. Optional. */
    attributes?: Record<string, string>;
};

export type PolicySimulationUserResult = {
    user: UserProfile;
    decisions?: Record<string, PolicySimulationActionDecision>;

    /** Optional per-session breakdown. When populated the picker renders
     *  a Recent activity expand row revealing one decision chip per
     *  session. Empty/undefined falls back to a single user-level chip. */
    sessions?: PolicySimulationSession[];

    /** User profile attribute snapshot the simulator used when
     *  evaluating this user (department, region, clearance, etc.).
     *  Surfaced in the per-row "Decision details" view so the author
     *  can read the deny like an evaluation trace. Optional. */
    attributes?: Record<string, string>;
};

export type PolicySimulationResponse = {
    results: PolicySimulationUserResult[];
    total: number;
};

/**
 * Scope for the simulate-by-users evaluation:
 *  - 'all'       — co-evaluate every contributing program (the entire
 *                  draft policy, persisted system permission policies,
 *                  parent policies). Mirrors the PEP's behaviour at
 *                  request time.
 *  - 'this_rule' — evaluate ONLY the rule the author is editing. Sibling
 *                  rules in the same policy and any other policies are
 *                  excluded so the picker can answer "what does this
 *                  rule alone do?" without other rules shadowing it.
 *                  Parent inheritance is still honoured.
 */
export type PolicyEvaluationScope = 'all' | 'this_rule';

/**
 * Per-user payload for the picker-driven /cel/simulate_users endpoint. The
 * server resolves the user's profile attributes from CPA storage and then
 * layers session context on top: the requesting admin's resolved session
 * snapshot (the same user_agent_* / ip_address bag the live PDP evaluates
 * against) is applied as a baseline, then `session_overrides` overrides
 * individual keys. Leaving overrides empty means "evaluate against the
 * session as the server resolves it" — matching what the user would hit
 * on a live request.
 */
export type PolicySimulationUserOverride = {
    user_id: string;

    /**
     * Retained for API backward compatibility — the server now always
     * layers the requesting admin's resolved session snapshot under
     * `session_overrides`, so this flag is effectively a no-op. New
     * clients should leave it unset.
     */
    use_active_session?: boolean;

    /**
     * Replaces individual `session.*` attributes for this user only.
     * Values can be strings, booleans, or numbers — the server-side
     * model is `map[string]any` and CEL rules expect untyped values
     * (e.g. `user.session.device_managed == true` requires `true` as
     * a boolean, not the string `"true"`). A `Record<string, string>`
     * type would force callers to stringify booleans/numbers and
     * silently break those comparisons.
     */
    session_overrides?: Record<string, unknown>;
};

/**
 * Request body for /cel/simulate_users. Used by the picker-based
 * "Simulate access" UX where the author hand-picks specific users to
 * dry-run a draft policy against.
 */
export type PolicySimulationByUsersParams = {
    policy: AccessControlPolicy;
    actions: string[];
    rule_name?: string;
    channel_id?: string;
    team_id?: string;
    users: PolicySimulationUserOverride[];

    /** Evaluation scope. Defaults to 'this_rule' on the server when
     *  omitted. The picker UI exposes this as an "Evaluate against:
     *  All policies / This rule only" toggle. */
    evaluation_scope?: PolicyEvaluationScope;
};
