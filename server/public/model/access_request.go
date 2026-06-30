// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// AccessControlSubjectScope* enumerates the supported scopes for ScopedRole.
const (
	AccessControlSubjectScopeSystem  = "system"
	AccessControlSubjectScopeChannel = "channel"
)

// ScopedRole pairs a role identifier with the scope it applies to. A subject
// may carry multiple ScopedRoles (e.g. one for the system, one for a channel)
// so the PDP can select the appropriate role when matching against a v0.4
// channel resource policy rule whose Role field is a channel-scoped role.
type ScopedRole struct {
	// Scope is one of AccessControlSubjectScope* constants.
	Scope string `json:"scope"`
	// Role is the role identifier within that scope (e.g. "system_user",
	// "channel_admin").
	Role string `json:"role"`
}

// Subject represents the user or a virtual entity for which the Authorization
// API is called.
type Subject struct {
	// ID is the unique identifier of the Subject.
	// it can be a user ID, bot ID, etc and it is scoped to the Type.
	ID string `json:"id"`
	// Type specifies the type of the Subject, eg. user, bot, etc.
	Type string `json:"type"`
	// Role is the system role of the subject (e.g. "system_user", "system_guest", "system_admin").
	// This is separate from custom profile attributes since it's a first-class system concept.
	//
	// Deprecated: prefer ScopedRoles which can express both system and
	// channel-scoped roles. Role is still populated for backward
	// compatibility and acts as the system-scope fallback inside
	// RoleForScope: a system-scope lookup returns Role whenever
	// ScopedRoles has no entry whose Scope is system — including
	// when the slice is empty AND when it contains only
	// channel-scoped entries. Populating ScopedRoles with non-system
	// entries does NOT suppress this fallback.
	Role string `json:"role"`
	// ScopedRoles carries roles paired with the scope they apply to (system
	// or channel). The PDP uses this slice to match a rule's scoped Role
	// (e.g. v0.4 channel resource policy rules) against the subject.
	ScopedRoles []ScopedRole `json:"scoped_roles,omitempty"`
	// Attributes are the key-value pairs assicuated with the subject.
	// An attribute may be single-valued or multi-valued and can be a primitive type
	// (string, boolean, number) or a complex type like a JSON object or array.
	Attributes map[string]any `json:"attributes"`
	// Session carries environmental / per-session attributes that policy
	// authors reference as `user.session.<key>` (e.g. user.session.network_status,
	// user.session.client_type, user.session.device_managed, user.session.ip_range,
	// user.session.platform, user.session.device_id).
	//
	// Session lives under the Subject — not as a sibling top-level CEL
	// variable — because every value here is keyed to the requesting
	// principal: the network the user is currently on, the client they're
	// using, whether their device is MDM-managed, etc. Modeling it as part
	// of the Subject keeps the Subject the single source of truth for
	// "everything we know about the requester at decision time" and
	// matches OpenID AuthZen's subject.properties / subject.session shape.
	//
	// The simulator populates this map from the picker's session-attribute
	// overrides and the requesting admin's active-session snapshot. The
	// live PDP populates it from rctx.Session() once the production wiring
	// for environmental telemetry lands; until then SavePolicy rejects
	// rules that reference user.session.* (see access_control.administration
	// in the enterprise repo) so authors cannot ship a control whose
	// production behaviour silently diverges from the simulator preview.
	Session map[string]any `json:"session,omitempty"`
	// Email is the subject's email address (model.User.Email), exposed to
	// CEL policies as user.email. Populated by BuildAccessControlSubject.
	Email string `json:"email,omitempty"`
	// EmailVerified mirrors model.User.EmailVerified, exposed as user.verified.
	EmailVerified bool `json:"email_verified,omitempty"`
	// IsBot mirrors model.User.IsBot (derived from the Bots table on the
	// cached user read), exposed as user.isbot.
	IsBot bool `json:"is_bot,omitempty"`
	// CreateAt mirrors model.User.CreateAt (epoch ms), exposed as user.createat.
	CreateAt int64 `json:"create_at,omitempty"`
}

// RoleForScope returns the role assigned to this subject within the given
// scope. It first walks ScopedRoles for a matching Scope; for the system
// scope it falls back to the legacy Role field whenever no system-scoped
// entry exists in ScopedRoles (including when the slice is empty or
// contains only channel-scoped entries).
func (s *Subject) RoleForScope(scope string) string {
	for _, sr := range s.ScopedRoles {
		if sr.Scope == scope {
			return sr.Role
		}
	}
	if scope == AccessControlSubjectScopeSystem {
		return s.Role
	}
	return ""
}

// RolesForScope returns every role assigned to this subject within the
// given scope, preserving the order they appear in ScopedRoles. Unlike
// RoleForScope it does NOT fall back to the legacy Role field — callers
// that need legacy single-role fallback should keep using RoleForScope.
//
// The current PDP only ever populates one entry per scope, so this
// helper returns at most a single-element slice today. It exists to
// give multi-role-per-scope consumers (a future capability — Mattermost
// users can carry multiple system roles like "system_user system_admin")
// a stable accessor that won't change shape when the underlying
// invariant is relaxed.
//
// Returns nil when no entry matches the scope.
func (s *Subject) RolesForScope(scope string) []string {
	var roles []string
	for _, sr := range s.ScopedRoles {
		if sr.Scope == scope {
			roles = append(roles, sr.Role)
		}
	}
	return roles
}

// SetScopedRole upserts a single role for the given scope, preserving
// the per-scope uniqueness invariant the PDP currently relies on. If an
// entry for the scope already exists, its role is replaced (keeping its
// position in ScopedRoles); any later duplicates with the same scope
// are removed. If no entry exists, a new one is appended.
//
// Passing an empty role removes every entry for the scope. This mirrors
// the convention used by the channel-scope hot path in
// attachChannelScopedRole, where an empty channel role lookup means "no
// channel role applies — drop any stale entry from the cached subject."
//
// Passing an empty scope is a no-op (defensive — the PDP never
// constructs scope="" entries).
//
// SetScopedRole always allocates a fresh ScopedRoles backing array, so
// it is safe to call on a Subject whose ScopedRoles slice is aliased
// with another Subject (e.g. the per-user cached Subject reused across
// many channels in attachChannelScopedRole).
func (s *Subject) SetScopedRole(scope, role string) {
	if scope == "" {
		return
	}
	updated := false
	out := make([]ScopedRole, 0, len(s.ScopedRoles)+1)
	for _, sr := range s.ScopedRoles {
		if sr.Scope != scope {
			out = append(out, sr)
			continue
		}
		if role == "" || updated {
			continue
		}
		out = append(out, ScopedRole{Scope: scope, Role: role})
		updated = true
	}
	if !updated && role != "" {
		out = append(out, ScopedRole{Scope: scope, Role: role})
	}
	s.ScopedRoles = out
}

type SubjectSearchOptions struct {
	Term   string `json:"term"`
	TeamID string `json:"team_id"`
	// Query and Args should be generated within the Access Control Service
	// and passed here wrt database driver
	Query         string        `json:"query"`
	Args          []any         `json:"args"`
	Limit         int           `json:"limit"`
	Cursor        SubjectCursor `json:"cursor"`
	AllowInactive bool          `json:"allow_inactive"`
	IgnoreCount   bool          `json:"ignore_count"`
	// ExcludeChannelMembers is used to exclude members from the search results
	// specifically used when syncing channel members
	ExcludeChannelMembers string `json:"exclude_members"`
	// SubjectID is used to filter search results to a specific user ID
	// This is particularly useful for validation queries where we only need to check
	// if a specific user matches an expression, rather than fetching all matching users
	SubjectID string `json:"subject_id"`
	// ExcludeNativeAttributes strips native user-attribute predicates (user.email,
	// user.verified, user.isbot, user.createat[.youngerThanDays]) from the expression
	// before building SQL, so self-inclusion validation checks only the CPA parts.
	ExcludeNativeAttributes bool `json:"exclude_native_attributes,omitempty"`
}

type SubjectCursor struct {
	TargetID string `json:"target_id"`
}

// Resource is the target of an access request.
type Resource struct {
	// ID is the unique identifier of the Resource.
	// It can be a channel ID, post ID, etc and it is scoped to the Type.
	ID string `json:"id"`
	// Type specifies the type of the Resource, eg. channel, post, etc.
	Type string `json:"type"`
}

// AccessRequest represents the input to the Policy Decision Point (PDP).
// It contains the Subject, Resource, Action and optional Context attributes.
type AccessRequest struct {
	Subject  Subject        `json:"subject"`
	Resource Resource       `json:"resource"`
	Action   string         `json:"action"`
	Context  map[string]any `json:"context,omitempty"`
}

// The PDP evaluates the request and returns an AccessDecision.
// The Decision field is a boolean indicating whether the request is allowed or not.
type AccessDecision struct {
	Decision bool           `json:"decision"`
	Context  map[string]any `json:"context,omitempty"`
}

type QueryExpressionParams struct {
	Expression string `json:"expression"`
	Term       string `json:"term"`
	Limit      int    `json:"limit"`
	After      string `json:"after"`
	ChannelId  string `json:"channelId,omitempty"`
	TeamId     string `json:"teamId,omitempty"`
}

// PolicySimulationBlameSource enumerates where a deny originated when running
// the test (simulate) workflow against a draft policy.
const (
	// PolicySimulationBlameSourceThisRule means the deny came from the rule
	// that the author is currently editing.
	PolicySimulationBlameSourceThisRule = "this_rule"
	// PolicySimulationBlameSourceSiblingRule means the deny came from another
	// rule inside the same draft policy (same channel, different role/action
	// or different rule on the same role/action that resolves to deny).
	PolicySimulationBlameSourceSiblingRule = "sibling_rule"
	// PolicySimulationBlameSourceChannelPolicy means the deny came from a
	// resource-policy rule that is not the one being edited but contributes
	// to the same effective decision (e.g. an inherited parent policy).
	PolicySimulationBlameSourceChannelPolicy = "channel_policy"
	// PolicySimulationBlameSourceSystemPermission means the deny came from a
	// truly higher-scoped, persisted permission policy. Distinct from
	// PolicySimulationBlameSourcePeerPolicy (same-scope) — the simulator
	// emits both as system_permission, but the public-server reclassifies
	// peer-scope blame entries before the response leaves the server. The
	// expression of an upper-scoped policy is intentionally not exposed
	// to the simulate UI to preserve scope privacy.
	PolicySimulationBlameSourceSystemPermission = "system_permission"
	// PolicySimulationBlameSourcePeerPolicy means the deny came from another
	// persisted policy at the SAME scope as the draft (same Type and same
	// ParentID). It's carved out of system_permission by the public-server
	// post-processing so the picker can show the peer's name + the failing
	// rule's CEL expression instead of an opaque "upper-scoped policy"
	// chip — at the editing scope, peers are visible to the author.
	PolicySimulationBlameSourcePeerPolicy = "peer_policy"
	// PolicySimulationBlameSourceNoApplicablePolicy is a synthetic blame
	// source emitted by the simulator when the draft policy does not apply
	// to a candidate user (e.g. a system_user user is added to test a
	// system_admin policy). The decision is recorded as ALLOW (vacuously,
	// because the policy is silent on this user) and the picker renders a
	// "Policy doesn't apply" pill from this entry. Never produced by
	// production evaluation — simulation-only.
	PolicySimulationBlameSourceNoApplicablePolicy = "no_applicable_policy"
	// PolicySimulationBlameSourceSiblingSaved is attached to an ALLOW
	// decision when the rule the author is editing alone would have DENIED
	// the subject, but a sibling rule (same role + action, OR-combined at
	// compile time) flipped the bucket back to ALLOW. Useful so the
	// picker can surface "this rule alone wouldn't have allowed them — a
	// sibling did". Simulation-only.
	PolicySimulationBlameSourceSiblingSaved = "sibling_saved"
	// PolicySimulationBlameSourceNoApplicableRule is the synthetic blame
	// source the "this rule only" post-process emits when the rule the
	// author is editing is silent on the subject — either a sibling
	// rule's OR-bucket saved an otherwise-denied user, or the deny
	// originated entirely outside the editing rule (upper-scoped policy,
	// peer policy, etc.). The decision is normalized to a vacuous ALLOW
	// like no_applicable_policy and the picker renders a neutral
	// "This rule doesn't apply" pill from this entry instead of the
	// misleading "Allowed · another rule" / plain "Allowed" chips that
	// the sibling_saved / orphaned-deny branches used to surface.
	// Simulation-only and only emitted under the "this_rule"
	// EvaluationScope (the "All policies" view keeps the original
	// sibling_saved chip because at that scope the other rule IS
	// relevant context for the verdict).
	PolicySimulationBlameSourceNoApplicableRule = "no_applicable_rule"
)

// PolicySimulationBlameOutcome enumerates the per-blame verdict the
// simulator records for a contributing policy. Most blame entries
// carry the deny that produced the overall decision (PolicySimulationBlameOutcomeDeny);
// the simulator additionally emits informational entries with PolicySimulationBlameOutcomeAllow
// so the picker can show "your draft policy allowed this user" in
// multi-policy contexts where a peer policy is the denier.
const (
	PolicySimulationBlameOutcomeDeny  = "deny"
	PolicySimulationBlameOutcomeAllow = "allow"
)

// PolicySimulationBlame attributes a deny decision back to the rule or policy
// that caused it. Some entries are informational (Outcome="allow") rather
// than deniers — those exist so the picker can surface the editing draft's
// evaluation alongside any peer policies' deny attribution; consumers that
// only care about deny attribution should filter to Outcome=="" or
// Outcome==PolicySimulationBlameOutcomeDeny (empty Outcome is treated as
// deny for backward compatibility with simulator builds that pre-date the
// field).
type PolicySimulationBlame struct {
	// Source is one of the PolicySimulationBlameSource* constants.
	Source string `json:"source"`
	// Outcome is one of the PolicySimulationBlameOutcome* constants.
	// Defaults to "deny" semantically when empty (backward compat with
	// older simulators) — every blame entry shipped before this field
	// existed was a denier. The picker uses Outcome to differentiate
	// the editing draft's "I allowed" informational entry from the
	// peer policies that actually caused the deny so each can render
	// with the right indicator.
	Outcome string `json:"outcome,omitempty"`
	// PolicyID is the ID of the contributing policy (for system permission
	// or channel policy sources). Empty when the deny originated from the
	// draft itself (no persisted ID exists yet).
	PolicyID string `json:"policy_id,omitempty"`
	// PolicyName is the human-readable name of the contributing policy.
	PolicyName string `json:"policy_name,omitempty"`
	// RuleName is the name of the contributing rule (v0.4 permission rules
	// always carry a unique name within their policy).
	RuleName string `json:"rule_name,omitempty"`
	// Role is the scoped role (system_* or channel_*) of the contributing
	// rule or policy. Useful for explaining hierarchy fallbacks.
	Role string `json:"role,omitempty"`
	// Expression is the CEL text of the contributing rule. Only populated
	// for blame entries at the draft's own scope (this_rule, sibling_rule,
	// sibling_saved, peer_policy). Truly upper-scoped sources
	// (system_permission, channel_policy) deliberately omit this field so
	// the simulate UI can't leak the expression of a policy outside the
	// editing scope.
	Expression string `json:"expression,omitempty"`
	// EvaluationTree is the per-node evaluation breakdown of the
	// contributing rule, mirroring the boolean shape of the CEL
	// expression's AST. Same scope-privacy rule as Expression: only
	// populated for draft-side / peer-policy blame; truly upper-scoped
	// sources omit it. The simulate UI renders it as a structured
	// AND/OR/NOT tree showing exactly which sub-expression(s) produced
	// the deny.
	EvaluationTree *PolicySimulationEvaluationNode `json:"evaluation_tree,omitempty"`
	// MergedRules lists every authored rule that was OR-folded into
	// `Expression` for this contribution (see engine.JoinExpressions).
	// Populated only when the contributing scope has more than one
	// rule sharing the same (role, action) — single-rule
	// contributions leave this empty so the simulate UI can keep the
	// simpler "Rule: <name>" header. Order mirrors the policy's rule
	// order, which is also the order JoinExpressions used when
	// constructing the merged expression — so a UI can number rules
	// consistently with the merged tree's branches.
	//
	// Same scope-privacy rule as Expression: populated only for
	// same-scope blame (this_rule / sibling_rule / sibling_saved /
	// peer_policy). Truly upper-scoped sources never carry this so
	// the picker can't enumerate the rules of an out-of-scope policy.
	MergedRules []PolicySimulationMergedRule `json:"merged_rules,omitempty"`
}

// PolicySimulationMergedRule is one entry in a blame's MergedRules:
// the name + expression + standalone evaluation tree of a single rule
// that was OR-folded into the blame's merged expression. A standalone
// tree (computed against the same activation as the merged tree) lets
// the UI render a per-rule breakdown numbered 1..N alongside the
// merged tree, so authors can map specific branches back to the rule
// they came from. The standalone tree carries the same scope-privacy
// rule as the surrounding blame's Expression; truly upper-scoped
// blame never carries MergedRules at all.
type PolicySimulationMergedRule struct {
	// Name of the contributing rule (matches AccessControlPolicy.Rules[i].Name).
	Name string `json:"name"`
	// Expression is the rule's CEL text, before JoinExpressions wraps
	// it in parens for the OR-fold. Useful when the UI wants to show
	// the contributing rule on its own without reparsing.
	Expression string `json:"expression,omitempty"`
	// EvaluationTree is the standalone per-node evaluation breakdown
	// of just this rule's expression (not the merged whole). The
	// outcome on the root reflects whether THIS rule alone matched
	// for the subject, which is what the picker needs to render
	// "rule 1: TRUE / rule 2: FALSE" per-rule chips above each tree.
	EvaluationTree *PolicySimulationEvaluationNode `json:"evaluation_tree,omitempty"`
}

// Kind values for PolicySimulationEvaluationNode.Kind. Compound kinds
// carry children; leaf kinds carry attribute / actual / expected
// metadata. PolicySimulationEvaluationKindOther is the catch-all for
// shapes the simulator doesn't decompose (bare attribute reference,
// ternary, unknown call).
const (
	PolicySimulationEvaluationKindAnd      = "and"
	PolicySimulationEvaluationKindOr       = "or"
	PolicySimulationEvaluationKindNot      = "not"
	PolicySimulationEvaluationKindCompare  = "compare"
	PolicySimulationEvaluationKindFunction = "function"
	PolicySimulationEvaluationKindOther    = "other"
)

// Outcome values for PolicySimulationEvaluationNode.Outcome. Mirrors
// the three-way truth result of CEL evaluation — a clean true/false,
// or an error condition (missing attribute, type mismatch).
const (
	PolicySimulationEvaluationOutcomeTrue  = "true"
	PolicySimulationEvaluationOutcomeFalse = "false"
	PolicySimulationEvaluationOutcomeError = "error"
)

// PolicySimulationEvaluationNode is a single node in the evaluation
// tree returned by the simulate-by-users endpoint when the simulator
// is asked to explain a deny. The tree mirrors the boolean shape of
// the failing rule's CEL expression — short-circuit branches are
// walked regardless of their parent's outcome so the consumer can
// render the state of every clause, not just the first one that
// decided the verdict.
type PolicySimulationEvaluationNode struct {
	// Kind classifies the node (compound vs leaf vs other). One of the
	// PolicySimulationEvaluationKind* constants above.
	Kind string `json:"kind"`
	// Expression is the textual form of THIS subtree, suitable for the
	// UI to render a snippet without rebuilding text from the AST.
	Expression string `json:"expression"`
	// Outcome is the per-node verdict. One of the
	// PolicySimulationEvaluationOutcome* constants.
	Outcome string `json:"outcome"`
	// Error is a human-readable description of an evaluation-time
	// failure. Populated only when Outcome == "error".
	Error string `json:"error,omitempty"`
	// Operator names the leaf operation: "==", "!=", "<", ">", ">=",
	// "<=", "in", "startsWith", "endsWith", "contains". Empty for
	// compound and other nodes.
	Operator string `json:"operator,omitempty"`
	// Attribute is the user-attribute path the leaf references when
	// it could be unambiguously identified
	// (e.g. user.attributes.region). Empty when the leaf does not
	// reference an attribute or when both sides are non-attribute
	// expressions.
	Attribute string `json:"attribute,omitempty"`
	// ActualValue is a display-formatted rendering of the user's
	// value for Attribute. Empty when the attribute is missing — a
	// missing attribute is also reflected in Outcome="error".
	ActualValue string `json:"actual_value,omitempty"`
	// ExpectedValue is a display-formatted rendering of the literal
	// (or list of literals) the leaf compared against. Empty when the
	// other side is itself an attribute reference.
	ExpectedValue string `json:"expected_value,omitempty"`
	// Children are the operands of a compound node, walked in
	// expression order. Empty for leaf and other nodes.
	Children []PolicySimulationEvaluationNode `json:"children,omitempty"`
}

// PolicySimulationActionDecision is the per-action verdict for a single user.
type PolicySimulationActionDecision struct {
	Decision bool                    `json:"decision"`
	Blame    []PolicySimulationBlame `json:"blame,omitempty"`
}

// PolicySimulationSession is the per-session breakdown entry for the
// simulate-by-users response. Populated when the caller requests per-session
// evaluation (typically a system admin: their active sessions are individually
// evaluated so the picker can show why two sessions of the same user come
// back with different verdicts). Channel admins receive at most a single
// synthetic session populated with default values that they can override
// through the per-row session-attribute editor.
type PolicySimulationSession struct {
	// ID is the persistent session identifier. Empty for synthetic sessions.
	ID string `json:"id,omitempty"`
	// Device is a human-readable device/client label (e.g. "MacBook Pro").
	Device string `json:"device,omitempty"`
	// Network classifies the connection (e.g. "WiFi", "VPN", "Mobile").
	Network string `json:"network,omitempty"`
	// LastActiveAt is the last-active timestamp in milliseconds since epoch.
	LastActiveAt int64 `json:"last_active_at,omitempty"`
	// Decisions maps action name → verdict for THIS session specifically,
	// using the session's own session.* attributes (the user's profile
	// attributes are constant across sessions).
	Decisions map[string]PolicySimulationActionDecision `json:"decisions,omitempty"`
	// Attributes is the session-attribute snapshot the simulator used when
	// evaluating this session (network_status, device_managed, ip_range,
	// etc.). Surfaced to the picker's "Decision details" view so the
	// author can read the deny like an evaluation trace. Optional — omitted
	// when the simulator hasn't populated it.
	Attributes map[string]string `json:"attributes,omitempty"`
}

// PolicySimulationUserResult is one row in the simulation response.
type PolicySimulationUserResult struct {
	User *User `json:"user"`
	// Decisions maps action name → verdict. Always populated when the
	// simulation request had non-empty Actions; nil when ExpressionOnly is
	// true (fallback mode). When Sessions is populated, this represents the
	// "headline" decision (e.g. from the most-recently-active session) so
	// the picker can render a single chip without consulting Sessions.
	Decisions map[string]PolicySimulationActionDecision `json:"decisions,omitempty"`
	// Sessions is the optional per-session breakdown. Empty/nil falls back
	// to the user-level Decisions only.
	Sessions []PolicySimulationSession `json:"sessions,omitempty"`
	// Attributes is the user profile attribute snapshot the simulator used
	// when evaluating this user (department, region, clearance, etc.).
	// Surfaced to the picker's "Decision details" view so the author can
	// read the deny as an evaluation trace. Optional — omitted when the
	// simulator hasn't populated it.
	Attributes map[string]string `json:"attributes,omitempty"`
}

// PolicySimulationResponse is the body returned by cel/simulate_users.
type PolicySimulationResponse struct {
	Results []PolicySimulationUserResult `json:"results"`
	Total   int64                        `json:"total"`
}

// PolicySimulationUserOverride captures the per-user inputs the picker UI
// sends to /access_control_policies/cel/simulate_users. The simulator
// resolves each user's profile attributes from CPA storage and then layers
// session context on top: the requesting admin's resolved session
// attributes (the same user_agent_* / ip_address bag the live PDP reads
// via App.GetSessionAttributes) are applied as a baseline, then the
// explicit SessionOverrides map overrides individual keys.
type PolicySimulationUserOverride struct {
	// UserID identifies the user to simulate against.
	UserID string `json:"user_id"`
	// UseActiveSession is retained for API backward compatibility. The
	// simulator now always layers the requesting admin's resolved session
	// snapshot under SessionOverrides — leaving overrides empty means
	// "evaluate against the session as the server resolves it" — so this
	// flag is effectively a no-op. New clients should leave it unset.
	UseActiveSession bool `json:"use_active_session,omitempty"`
	// SessionOverrides replaces individual session.* attributes for this
	// user only. Applied on top of the active-session snapshot when both
	// are set, so a future "configure" panel can shadow specific values
	// without discarding the rest of the active session.
	//
	// Mirrors the shape of Subject.Session (map[string]any) so the picker
	// can carry mixed-typed session attributes (e.g. boolean
	// device_managed alongside string network_status) without coercing
	// everything through string. Nested maps / slices flow through to the
	// CEL evaluator unchanged.
	SessionOverrides map[string]any `json:"session_overrides,omitempty"`
}

// PolicyEvaluationScope* constants enumerate the supported evaluation
// scopes for /cel/simulate_users.
const (
	// PolicyEvaluationScopeThisRule evaluates ONLY the rule the author is
	// editing — sibling rules in the same policy, system permission
	// policies, imported parent policies, and any other peer policies are
	// excluded. This is the authoring-time "what does this rule alone do?"
	// view: useful for iterating on a single rule's expression without
	// other rules shadowing or compensating for it. Default when the
	// request omits EvaluationScope.
	PolicyEvaluationScopeThisRule = "this_rule"
	// PolicyEvaluationScopeAll co-evaluates every contributing program —
	// the entire draft policy (all rules), persisted system permission
	// policies, parent policies — exactly as the live PDP would at
	// request time. This is the "what verdict will the user actually
	// experience?" view.
	PolicyEvaluationScopeAll = "all"
)

// PolicySimulationByUsersParams is the request body for
// /access_control_policies/cel/simulate_users.
//
// The picker-based "Simulate access" UX hand-selects users to dry-run a
// draft policy against. Each user is run through the same dual-lane PDP
// path the live request would take and the response carries per-user,
// per-action ALLOW/DENY decisions plus blame attribution.
type PolicySimulationByUsersParams struct {
	// Policy is the draft policy as it currently sits in the editor. Not
	// persisted; compiled in-memory only.
	Policy *AccessControlPolicy `json:"policy"`
	// Actions is the set of permission actions to simulate. Required —
	// a picker UX only makes sense once an action is in scope.
	Actions []string `json:"actions"`
	// RuleName identifies which rule in Policy.Rules the author is
	// editing (used for blame attribution). Optional. When set, denies
	// originating from this rule are tagged source=this_rule; other
	// denies in the same draft are tagged source=sibling_rule.
	RuleName string `json:"rule_name,omitempty"`
	// ChannelID and TeamID provide context for delegated admin auth and
	// channel-scope evaluation.
	ChannelID string `json:"channel_id,omitempty"`
	TeamID    string `json:"team_id,omitempty"`
	// Users is the explicit set of users to evaluate, with per-user
	// session-attribute overrides.
	Users []PolicySimulationUserOverride `json:"users"`
	// EvaluationScope selects whether the simulator considers only the
	// rule under simulation (this_rule) or co-evaluates every contributing
	// program (all). Empty defaults to this_rule on the server.
	EvaluationScope string `json:"evaluation_scope,omitempty"`
}
