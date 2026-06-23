// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"slices"
	"strings"

	"github.com/pkg/errors"
	"golang.org/x/mod/semver"
)

const (
	AccessControlPolicyTypeParent     = "parent"
	AccessControlPolicyTypeChannel    = "channel"
	AccessControlPolicyTypePermission = "permission"
	AccessControlPolicyTypeTeam       = "team"

	MaxPolicyNameLength = 128

	AccessControlPolicyVersionV0_1 = "v0.1"
	AccessControlPolicyVersionV0_2 = "v0.2"
	AccessControlPolicyVersionV0_3 = "v0.3"
	AccessControlPolicyVersionV0_4 = "v0.4"

	AccessControlPolicyActionMembership             = "membership"
	AccessControlPolicyActionUploadFileAttachment   = "upload_file_attachment"
	AccessControlPolicyActionDownloadFileAttachment = "download_file_attachment"

	AccessControlPolicyScopeTeam = "team"
)

var allowedActionsV0_3 = map[string]bool{
	AccessControlPolicyActionMembership:             true,
	AccessControlPolicyActionUploadFileAttachment:   true,
	AccessControlPolicyActionDownloadFileAttachment: true,
}

// allowedChannelRolesV0_4 is the set of channel-scoped roles that may appear
// on a v0.4 channel resource policy rule.
var allowedChannelRolesV0_4 = map[string]bool{
	ChannelGuestRoleId: true,
	ChannelUserRoleId:  true,
	ChannelAdminRoleId: true,
}

// allowedPermissionActionsV0_4 is the set of non-membership actions that may
// appear on a v0.4 channel resource policy rule. These rules govern per-action
// behavior (file upload/download) and must carry a channel-scoped role.
var allowedPermissionActionsV0_4 = map[string]bool{
	AccessControlPolicyActionUploadFileAttachment:   true,
	AccessControlPolicyActionDownloadFileAttachment: true,
}

// IsPermissionAction reports whether the given action is a non-membership
// permission action governed by a v0.4 channel rule.
func IsPermissionAction(action string) bool {
	return allowedPermissionActionsV0_4[action]
}

// HasPermissionRuleAction reports whether ANY rule on this policy
// carries a non-membership permission action (file upload/download).
// Used by the API4 layer to gate channel-scope policies behind the
// ChannelPermissionPolicies feature flag: if a channel policy
// includes a permission rule and the flag is off, the request is
// rejected before reaching the PAP. Returns false for a nil/empty
// policy so callers can use it as a guard without nil checks.
func (p *AccessControlPolicy) HasPermissionRuleAction() bool {
	if p == nil {
		return false
	}
	for i := range p.Rules {
		if slices.ContainsFunc(p.Rules[i].Actions, IsPermissionAction) {
			return true
		}
	}
	return false
}

// AccessControlAttribute represents a user attribute with its name and possible values
type AccessControlAttribute struct {
	Attribute PropertyField `json:"attribute"`
	Values    []string      `json:"values"`
}

type AccessControlPolicyTestResponse struct {
	Users []*User `json:"users"`
	Total int64   `json:"total"`
}

type GetAccessControlPolicyOptions struct {
	Type     string                    `json:"type"`
	ParentID string                    `json:"parent_id"`
	Cursor   AccessControlPolicyCursor `json:"cursor"`
	Limit    int                       `json:"limit"`
}

type AccessControlPolicySearch struct {
	Term            string                    `json:"term"`
	Type            string                    `json:"type"`
	ParentID        string                    `json:"parent_id"`
	IDs             []string                  `json:"ids"`
	Cursor          AccessControlPolicyCursor `json:"cursor"`
	Limit           int                       `json:"limit"`
	IncludeChildren bool                      `json:"include_children"`
	Active          bool                      `json:"active"`
	TeamID          string                    `json:"team_id"`
	Scope           string                    `json:"scope,omitempty"`
	ScopeID         string                    `json:"scope_id,omitempty"`
	Actions         []string                  `json:"actions"`
}

type AccessControlPolicyCursor struct {
	ID string `json:"id"`
}

type AccessControlPoliciesWithCount struct {
	Policies []*AccessControlPolicy `json:"policies"`
	Total    int64                  `json:"total"`
}

type AccessControlPolicy struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Type     string `json:"type"`
	Active   bool   `json:"active"`
	CreateAt int64  `json:"create_at"`

	Revision int    `json:"revision"`
	Version  string `json:"version"`

	Roles   []string                  `json:"roles"`
	Imports []string                  `json:"imports"`
	Rules   []AccessControlPolicyRule `json:"rules"`

	Scope   string `json:"scope,omitempty"`    // "" (system) or "team"
	ScopeID string `json:"scope_id,omitempty"` // team ID when scope="team"

	Props map[string]any `json:"props"` // add auto-sync property here, also maybe the attributes being used in the expression
}

type AccessControlPolicyRule struct {
	Actions    []string `json:"actions"`
	Expression string   `json:"expression"`
	// Name is an admin-facing label for the rule. Required for v0.4 permission
	// rules and must be unique within the same policy.
	Name string `json:"name,omitempty"`
	// Role is the channel-scoped role this rule applies to (channel_guest,
	// channel_user, channel_admin) for v0.4 permission rules. Membership rules
	// must leave this empty.
	Role string `json:"role,omitempty"`
}

type CELExpressionError struct {
	Line    int    `json:"line"`
	Column  int    `json:"column"`
	Message string `json:"message"`
}

type AccessControlQueryResult struct {
	MatchedSubjectIDs []string `json:"matched_subject_ids"`
}

// AccessControlPolicyActiveUpdate represents a single policy's active status update.
type AccessControlPolicyActiveUpdate struct {
	ID     string `json:"id"`
	Active bool   `json:"active"`
}

// AccessControlPolicyActiveUpdateRequest is used in the API to update active status for multiple policies.
type AccessControlPolicyActiveUpdateRequest struct {
	Entries []AccessControlPolicyActiveUpdate `json:"entries"`
	TeamID  string                            `json:"team_id,omitempty"`
}

func (r *AccessControlPolicyActiveUpdateRequest) Auditable() map[string]any {
	entries := make([]map[string]any, 0, len(r.Entries))
	for _, entry := range r.Entries {
		entries = append(entries, map[string]any{
			"id":     entry.ID,
			"active": entry.Active,
		})
	}
	result := map[string]any{
		"entries": entries,
	}
	if r.TeamID != "" {
		result["team_id"] = r.TeamID
	}
	return result
}

func (p *AccessControlPolicy) IsValid() *AppError {
	if p.Scope != "" || p.ScopeID != "" {
		if appErr := p.validateScope(); appErr != nil {
			return appErr
		}
	}

	switch p.Version {
	case AccessControlPolicyVersionV0_1:
		return p.accessPolicyVersionV0_1()
	case AccessControlPolicyVersionV0_2:
		return p.accessPolicyVersionV0_2()
	case AccessControlPolicyVersionV0_3:
		return p.accessPolicyVersionV0_3()
	case AccessControlPolicyVersionV0_4:
		return p.accessPolicyVersionV0_4()
	default:
		return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.version.app_error", nil, "", 400)
	}
}

func (p *AccessControlPolicy) validateScope() *AppError {
	switch p.Scope {
	case "":
		if p.ScopeID != "" {
			return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.scope_id_without_scope.app_error", nil, "", 400)
		}
	case AccessControlPolicyScopeTeam:
		if !IsValidId(p.ScopeID) {
			return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.scope_id.app_error", nil, "", 400)
		}
	default:
		return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.scope.app_error", nil, "", 400)
	}
	return nil
}

func (p *AccessControlPolicy) accessPolicyVersionV0_1() *AppError {
	if !slices.Contains([]string{AccessControlPolicyTypeParent, AccessControlPolicyTypeChannel}, p.Type) {
		return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.type.app_error", nil, "", 400)
	}

	if !IsValidId(p.ID) {
		return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.id.app_error", nil, "", 400)
	}

	if p.Type == AccessControlPolicyTypeParent && (p.Name == "" || len(p.Name) > MaxPolicyNameLength) {
		return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.name.app_error", nil, "", 400)
	}

	if p.Revision < 0 {
		return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.revision.app_error", nil, "", 400)
	}

	if !semver.IsValid(p.Version) {
		return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.version.app_error", nil, "", 400)
	}

	switch p.Type {
	case AccessControlPolicyTypeParent:
		if len(p.Rules) == 0 {
			return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.rules.app_error", nil, "", 400)
		}

		if len(p.Imports) > 0 {
			return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.imports.app_error", nil, "", 400)
		}
	case AccessControlPolicyTypeChannel:
		if len(p.Rules) == 0 && len(p.Imports) == 0 {
			return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.rules_imports.app_error", nil, "", 400)
		}

		if len(p.Rules) == 0 {
			return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.rules.app_error", nil, "", 400)
		}

		if len(p.Imports) > 1 {
			return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.imports.app_error", nil, "", 400)
		}
	}

	return nil
}

func (p *AccessControlPolicy) accessPolicyVersionV0_2() *AppError {
	if !slices.Contains([]string{AccessControlPolicyTypeParent, AccessControlPolicyTypeChannel}, p.Type) {
		return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.type.app_error", nil, "", 400)
	}

	if !IsValidId(p.ID) {
		return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.id.app_error", nil, "", 400)
	}

	if p.Type == AccessControlPolicyTypeParent && (p.Name == "" || len(p.Name) > MaxPolicyNameLength) {
		return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.name.app_error", nil, "", 400)
	}

	if p.Revision < 0 {
		return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.revision.app_error", nil, "", 400)
	}

	if !semver.IsValid(p.Version) {
		return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.version.app_error", nil, "", 400)
	}

	switch p.Type {
	case AccessControlPolicyTypeParent:
		if len(p.Rules) == 0 {
			return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.rules.app_error", nil, "", 400)
		}

		if len(p.Imports) > 0 {
			return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.imports.app_error", nil, "", 400)
		}
	case AccessControlPolicyTypeChannel:
		if len(p.Rules) == 0 && len(p.Imports) == 0 {
			return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.rules_imports.app_error", nil, "", 400)
		}
	}

	return nil
}

func (p *AccessControlPolicy) accessPolicyVersionV0_3() *AppError {
	if !slices.Contains([]string{AccessControlPolicyTypeParent, AccessControlPolicyTypeChannel, AccessControlPolicyTypePermission, AccessControlPolicyTypeTeam}, p.Type) {
		return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.type.app_error", nil, "", 400)
	}

	if !IsValidId(p.ID) {
		return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.id.app_error", nil, "", 400)
	}

	if (p.Type == AccessControlPolicyTypeParent || p.Type == AccessControlPolicyTypePermission) && (p.Name == "" || len(p.Name) > MaxPolicyNameLength) {
		return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.name.app_error", nil, "", 400)
	}

	if p.Revision < 0 {
		return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.revision.app_error", nil, "", 400)
	}

	if !semver.IsValid(p.Version) {
		return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.version.app_error", nil, "", 400)
	}

	switch p.Type {
	case AccessControlPolicyTypeParent:
		if len(p.Rules) == 0 {
			return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.rules.app_error", nil, "", 400)
		}

		if len(p.Imports) > 0 {
			return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.imports.app_error", nil, "", 400)
		}
	case AccessControlPolicyTypeChannel:
		if len(p.Rules) == 0 && len(p.Imports) == 0 {
			return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.rules_imports.app_error", nil, "", 400)
		}
	case AccessControlPolicyTypeTeam:
		if len(p.Rules) == 0 && len(p.Imports) == 0 {
			return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.rules_imports.app_error", nil, "", 400)
		}
	case AccessControlPolicyTypePermission:
		if len(p.Rules) == 0 && len(p.Imports) == 0 {
			return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.rules_imports.app_error", nil, "", 400)
		}

		// Permissions are only allowed to be applied to a single role as of v0.3
		// role hierarchy is resolved at the PDP
		if len(p.Roles) != 1 {
			return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.roles.app_error", nil, "", 400)
		}
		for _, role := range p.Roles {
			if strings.TrimSpace(role) == "" {
				return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.roles.app_error", nil, "", 400)
			}
		}

		if len(p.Imports) > 0 {
			return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.imports.app_error", nil, "", 400)
		}
	}

	for _, rule := range p.Rules {
		if len(rule.Actions) == 0 {
			return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.actions.app_error", nil, "actions must not be empty", 400)
		}
		for _, action := range rule.Actions {
			if !allowedActionsV0_3[action] {
				return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.actions.app_error", nil, fmt.Sprintf("unrecognized action: %s", action), 400)
			}
		}
		if slices.Contains(rule.Actions, AccessControlPolicyActionMembership) && strings.Contains(rule.Expression, "user.session") {
			return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.session_attribute_on_membership.app_error", nil, "", 400)
		}
	}

	return nil
}

// accessPolicyVersionV0_4 validates a v0.4 policy. v0.4 extends v0.3 by
// allowing channel resource policies to carry channel-role-scoped permission
// rules (upload/download file attachments) alongside membership rules.
//
// Constraints layered on top of v0.3:
//   - Permission action rules MUST carry a non-empty Name (unique within the
//     policy) and a Role in {channel_guest, channel_user, channel_admin}.
//   - Membership rules MUST NOT carry a Role and MUST be alone in their rule
//     entry (cannot be combined with permission actions).
//   - Permission action rules are only allowed on `channel` policy types.
//     `parent` and system `permission` policy types remain membership-only at
//     v0.4 (multi-action support there is a follow-up iteration).
func (p *AccessControlPolicy) accessPolicyVersionV0_4() *AppError {
	if !slices.Contains([]string{AccessControlPolicyTypeParent, AccessControlPolicyTypeChannel, AccessControlPolicyTypePermission, AccessControlPolicyTypeTeam}, p.Type) {
		return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.type.app_error", nil, "", 400)
	}

	if !IsValidId(p.ID) {
		return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.id.app_error", nil, "", 400)
	}

	if (p.Type == AccessControlPolicyTypeParent || p.Type == AccessControlPolicyTypePermission) && (p.Name == "" || len(p.Name) > MaxPolicyNameLength) {
		return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.name.app_error", nil, "", 400)
	}

	if p.Revision < 0 {
		return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.revision.app_error", nil, "", 400)
	}

	if !semver.IsValid(p.Version) {
		return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.version.app_error", nil, "", 400)
	}

	switch p.Type {
	case AccessControlPolicyTypeParent:
		if len(p.Rules) == 0 {
			return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.rules.app_error", nil, "", 400)
		}
		if len(p.Imports) > 0 {
			return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.imports.app_error", nil, "", 400)
		}
	case AccessControlPolicyTypeChannel:
		if len(p.Rules) == 0 && len(p.Imports) == 0 {
			return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.rules_imports.app_error", nil, "", 400)
		}
	case AccessControlPolicyTypeTeam:
		if len(p.Rules) == 0 && len(p.Imports) == 0 {
			return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.rules_imports.app_error", nil, "", 400)
		}
	case AccessControlPolicyTypePermission:
		if len(p.Rules) == 0 && len(p.Imports) == 0 {
			return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.rules_imports.app_error", nil, "", 400)
		}
		if len(p.Roles) != 1 {
			return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.roles.app_error", nil, "", 400)
		}
		for _, role := range p.Roles {
			if strings.TrimSpace(role) == "" {
				return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.roles.app_error", nil, "", 400)
			}
		}
		if len(p.Imports) > 0 {
			return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.imports.app_error", nil, "", 400)
		}
	}

	seenNames := make(map[string]struct{})
	for _, rule := range p.Rules {
		if len(rule.Actions) == 0 {
			return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.actions.app_error", nil, "actions must not be empty", 400)
		}

		hasMembership := false
		hasPermission := false
		for _, action := range rule.Actions {
			if !allowedActionsV0_3[action] {
				return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.actions.app_error", nil, fmt.Sprintf("unrecognized action: %s", action), 400)
			}
			if action == AccessControlPolicyActionMembership {
				hasMembership = true
			}
			if allowedPermissionActionsV0_4[action] {
				hasPermission = true
			}
		}

		// Membership cannot be combined with permission actions in the same rule.
		if hasMembership && hasPermission {
			return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.actions.membership_combined.app_error", nil, "membership cannot be combined with other actions in the same rule", 400)
		}

		// Permission rules are only allowed on channel-type policies in v0.4.
		if hasPermission && p.Type != AccessControlPolicyTypeChannel {
			return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.actions.permission_type.app_error", nil, "permission action rules are only allowed on channel policies", 400)
		}

		// Permission rules require a Name (unique within policy) and a Role.
		// Normalise once: TrimSpace lets the empty-/length-/uniqueness
		// checks share the same view of the name, so authoring errors
		// like "Uploads" vs "Uploads " are caught as duplicates instead
		// of slipping through and forming two visually identical rules.
		if hasPermission {
			n := strings.TrimSpace(rule.Name)
			if n == "" || len(n) > MaxPolicyNameLength {
				return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.rule_name.app_error", nil, "permission rules require a non-empty name within the policy max length", 400)
			}
			if !allowedChannelRolesV0_4[rule.Role] {
				return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.rule_role.app_error", nil, fmt.Sprintf("invalid channel role: %q", rule.Role), 400)
			}
			if _, exists := seenNames[n]; exists {
				return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.rule_name_unique.app_error", nil, fmt.Sprintf("duplicate rule name: %q", n), 400)
			}
			seenNames[n] = struct{}{}
		}

		// Membership rules must not carry a role.
		if hasMembership && rule.Role != "" {
			return NewAppError("AccessControlPolicy.IsValid", "model.access_policy.is_valid.rule_role.app_error", nil, "membership rules must not have a role", 400)
		}
	}

	return nil
}

func (p *AccessControlPolicy) Inherit(parent *AccessControlPolicy) *AppError {
	rules := make([]AccessControlPolicyRule, len(p.Rules))

	switch p.Version {
	case AccessControlPolicyVersionV0_1:
		p.Imports = []string{parent.ID}
		for i, rule := range p.Rules {
			actions := make([]string, len(rule.Actions))
			copy(actions, rule.Actions)
			rules[i] = AccessControlPolicyRule{
				Actions:    actions,
				Expression: fmt.Sprintf("policies.id_%s", p.ID),
			}
		}
	case AccessControlPolicyVersionV0_2:
		if slices.Contains(p.Imports, parent.ID) {
			return NewAppError("AccessControlPolicy.Inherit", "model.access_policy.inherit.already_imported.app_error", nil, "", 400)
		}
		p.Imports = append(p.Imports, parent.ID)
	case AccessControlPolicyVersionV0_3:
		if p.Type == AccessControlPolicyTypePermission || parent.Type == AccessControlPolicyTypePermission {
			return NewAppError("AccessControlPolicy.Inherit", "model.access_policy.inherit.permission.app_error", nil, "", 400)
		}
		if parent.Type != AccessControlPolicyTypeParent {
			return NewAppError("AccessControlPolicy.Inherit", "model.access_policy.inherit.parent_type.app_error", nil, "imports must target a parent-type policy", 400)
		}
		if parent.Version != AccessControlPolicyVersionV0_3 {
			return NewAppError("AccessControlPolicy.Inherit", "model.access_policy.inherit.version.app_error", nil, "", 400)
		}
		if slices.Contains(p.Imports, parent.ID) {
			return NewAppError("AccessControlPolicy.Inherit", "model.access_policy.inherit.already_imported.app_error", nil, "", 400)
		}
		p.Imports = append(p.Imports, parent.ID)
	case AccessControlPolicyVersionV0_4:
		if p.Type == AccessControlPolicyTypePermission || parent.Type == AccessControlPolicyTypePermission {
			return NewAppError("AccessControlPolicy.Inherit", "model.access_policy.inherit.permission.app_error", nil, "", 400)
		}
		// v0.4 channel policies may import v0.3 or v0.4 parent policies.
		// Parents themselves remain membership-only at v0.4 (validator enforces).
		if parent.Version != AccessControlPolicyVersionV0_3 && parent.Version != AccessControlPolicyVersionV0_4 {
			return NewAppError("AccessControlPolicy.Inherit", "model.access_policy.inherit.version.app_error", nil, "", 400)
		}
		// v0.4 inherit is strictly child-channel → parent-membership.
		// A channel→channel or permission→channel import has no
		// well-defined semantics in the v0.4 model (parents are the
		// only carriers of reusable membership rules), so reject the
		// import rather than silently appending a peer policy's ID
		// into Imports where the loader would later treat it as a
		// membership parent.
		if parent.Type != AccessControlPolicyTypeParent {
			return NewAppError("AccessControlPolicy.Inherit", "model.access_policy.inherit.parent_type.app_error", nil, "v0.4 imports must target a membership parent policy", 400)
		}
		if slices.Contains(p.Imports, parent.ID) {
			return NewAppError("AccessControlPolicy.Inherit", "model.access_policy.inherit.already_imported.app_error", nil, "", 400)
		}
		// Stage Imports on a probe copy so a post-merge IsValid failure
		// leaves the receiver untouched (transactional contract).
		newImports := append(slices.Clone(p.Imports), parent.ID)
		probe := *p
		probe.Imports = newImports
		if appErr := probe.IsValid(); appErr != nil {
			return appErr
		}
		p.Imports = newImports
		return nil
	default:
		return NewAppError("AccessControlPolicy.Inherit", "model.access_policy.inherit.version.app_error", nil, "", 400)
	}

	if appErr := p.IsValid(); appErr != nil {
		return appErr
	}

	return nil
}

func (c *AccessControlPolicyCursor) IsEmpty() bool {
	return c.ID == ""
}

func (c *AccessControlPolicyCursor) IsValid() error {
	if c.IsEmpty() {
		return nil
	}

	if !IsValidId(c.ID) {
		return errors.New("cursor id is invalid")
	}

	return nil
}

func (p *AccessControlPolicy) Auditable() map[string]any {
	return map[string]any{
		"id":       p.ID,
		"type":     p.Type,
		"revision": p.Revision,
	}
}
