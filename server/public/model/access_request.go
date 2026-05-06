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
	// channel-scoped roles. Role is still populated for backward compatibility
	// and is treated as a system-scoped role when ScopedRoles is empty.
	Role string `json:"role"`
	// ScopedRoles carries roles paired with the scope they apply to (system
	// or channel). The PDP uses this slice to match a rule's scoped Role
	// (e.g. v0.4 channel resource policy rules) against the subject.
	ScopedRoles []ScopedRole `json:"scoped_roles,omitempty"`
	// Attributes are the key-value pairs assicuated with the subject.
	// An attribute may be single-valued or multi-valued and can be a primitive type
	// (string, boolean, number) or a complex type like a JSON object or array.
	Attributes map[string]any `json:"attributes"`
}

// RoleForScope returns the role assigned to this subject within the given
// scope. It first checks ScopedRoles; for the system scope it falls back to
// the legacy Role field when ScopedRoles is empty.
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
	// higher-scoped, persisted system permission policy.
	PolicySimulationBlameSourceSystemPermission = "system_permission"
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
)

// PolicySimulationParams is the request body for the cel/simulate endpoint.
//
// When Actions is empty the simulation falls back to expression-only mode:
// the response carries Total + Results without per-action Decisions, mirroring
// the legacy /cel/test result so the editor can render a "no permission
// selected" preview.
type PolicySimulationParams struct {
	// Policy is the draft policy as the author currently has it in the editor.
	// It is NOT persisted by the simulate endpoint; it is compiled in-memory
	// for evaluation only.
	Policy *AccessControlPolicy `json:"policy"`
	// Actions is the set of permission actions to simulate (e.g.
	// upload_file_attachment, download_file_attachment). When empty the
	// simulator falls back to expression-only matching using the rule's
	// expression — useful while the author has not yet selected a permission.
	Actions []string `json:"actions,omitempty"`
	// RuleName identifies which rule in Policy.Rules the author is editing
	// (used for blame attribution). Optional. When set, denies originating
	// from this rule are tagged source=this_rule; other denies in the same
	// draft are tagged source=sibling_rule.
	RuleName string `json:"rule_name,omitempty"`
	// ChannelID provides resource context for delegated channel admins and
	// for resource-lane evaluation when Policy.Type == "channel".
	ChannelID string `json:"channel_id,omitempty"`
	// TeamID provides team context for team-level delegated admins.
	TeamID string `json:"team_id,omitempty"`
	// Term is a prefix filter on candidate user names/usernames (same
	// semantics as QueryExpressionParams.Term).
	Term string `json:"term"`
	// Limit caps the number of users returned in this page.
	Limit int `json:"limit"`
	// After is the pagination cursor: the user ID of the last result in the
	// previous page.
	After string `json:"after"`
}

// PolicySimulationBlame attributes a deny decision back to the rule or policy
// that caused it.
type PolicySimulationBlame struct {
	// Source is one of the PolicySimulationBlameSource* constants.
	Source string `json:"source"`
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
}

// PolicySimulationResponse is the body returned by cel/simulate.
type PolicySimulationResponse struct {
	Results []PolicySimulationUserResult `json:"results"`
	Total   int64                        `json:"total"`
	// ExpressionOnly is true when the request omitted Actions and the
	// simulator fell back to a single-expression match. In that mode
	// Decisions is nil for every result and the consumer should render the
	// "no permission selected" UX.
	ExpressionOnly bool `json:"expression_only,omitempty"`
}

// PolicySimulationUserOverride captures the per-user inputs the picker UI
// sends to /access_control_policies/cel/simulate_users. The simulator
// resolves each user's profile attributes from CPA storage and then layers
// session context on top: first the active-session snapshot (when
// UseActiveSession is set), then the explicit SessionOverrides map.
type PolicySimulationUserOverride struct {
	// UserID identifies the user to simulate against.
	UserID string `json:"user_id"`
	// UseActiveSession injects the requesting admin's session.* attributes
	// (network_status, client_type, device_managed, ip_range, platform,
	// device_id) into this user's evaluation context. When the live PDP
	// does not yet populate session.* on the request context this is a
	// no-op; the API surface is forward-compatible.
	UseActiveSession bool `json:"use_active_session,omitempty"`
	// SessionOverrides replaces individual session.* attributes for this
	// user only. Applied on top of the active-session snapshot when both
	// are set, so a future "configure" panel can shadow specific values
	// without discarding the rest of the active session.
	SessionOverrides map[string]string `json:"session_overrides,omitempty"`
}

// PolicyEvaluationScope* constants enumerate the supported evaluation
// scopes for /cel/simulate_users.
const (
	// PolicyEvaluationScopeThisPolicy evaluates only the draft policy
	// passed in the request. This is the authoring-time view: it surfaces
	// only the rules the author is editing right now, with sibling/system
	// blame attribution where relevant. Default when the request omits
	// EvaluationScope (preserves pre-existing behaviour).
	PolicyEvaluationScopeThisPolicy = "this_policy"
	// PolicyEvaluationScopeAll co-evaluates the draft alongside any other
	// persisted permission policies that govern the same channel/scope
	// (parent policies, system permission policies). This mirrors the PEP's
	// at-request-time semantics so the picker can preview the effective
	// decision the user would actually experience.
	PolicyEvaluationScopeAll = "all"
)

// PolicySimulationByUsersParams is the request body for
// /access_control_policies/cel/simulate_users.
//
// Unlike PolicySimulationParams (which searches for matching users) this
// variant takes an explicit user list. Useful for the picker-based
// "Simulate access" UX where the author hand-selects who they want to
// dry-run.
type PolicySimulationByUsersParams struct {
	// Policy is the draft policy as it currently sits in the editor. Not
	// persisted; compiled in-memory only.
	Policy *AccessControlPolicy `json:"policy"`
	// Actions is the set of permission actions to simulate. Required for
	// the per-user simulator (no expression-only fallback here — a picker
	// only makes sense once an action is in scope).
	Actions []string `json:"actions"`
	// RuleName identifies which rule in Policy.Rules the author is editing
	// (used for blame attribution). Same semantics as PolicySimulationParams.
	RuleName string `json:"rule_name,omitempty"`
	// ChannelID and TeamID provide context for delegated admin auth and
	// channel-scope evaluation.
	ChannelID string `json:"channel_id,omitempty"`
	TeamID    string `json:"team_id,omitempty"`
	// Users is the explicit set of users to evaluate, with per-user
	// session-attribute overrides.
	Users []PolicySimulationUserOverride `json:"users"`
	// EvaluationScope selects whether the simulator considers only the
	// draft Policy (this_policy) or co-evaluates other persisted policies
	// that govern the same scope (all). Empty defaults to this_policy on
	// the server to preserve pre-existing behaviour for older clients.
	EvaluationScope string `json:"evaluation_scope,omitempty"`
}
