// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// PropertyPermissionBasis records how a property field permission decision
// was reached, so a value or definition write can log the basis it was
// allowed on (§10): the caller identity, and either the matching grant or the
// satisfied restrictions tier.
type PropertyPermissionBasis struct {
	Action     string
	CallerType string
	CallerID   string

	// Tier is the satisfied restrictions tier, empty when a grant allowed it
	// instead.
	Tier model.PermissionLevel

	// GrantID, GrantScope, and GrantWildcard are set when a grant allowed the
	// action. GrantWildcard is grant.ID == "*".
	GrantID       string
	GrantScope    string
	GrantWildcard bool

	// Legacy is true when the field carried no Permissions, so the legacy
	// columns decided instead of the new engine.
	Legacy bool

	// Unrestricted is true when a local-mode session bypassed the check.
	Unrestricted bool

	Allowed bool
}

// decidePropertyFieldPermission answers whether userID may perform action on
// field, unioning the human restrictions ladder with any grant naming the
// caller: the most permissive result across both, since the model is
// grant-only and has no deny. A field with no Permissions falls back to the
// legacy columns, the cutover shim that keeps the tree working while
// existing data is converted.
func (a *App) decidePropertyFieldPermission(rctx request.CTX, userID string, field *model.PropertyField, action, valueTargetID string) PropertyPermissionBasis {
	basis := PropertyPermissionBasis{
		Action:     action,
		CallerType: model.PropertyOwnerTypeUser,
		CallerID:   userID,
	}
	if field == nil || userID == "" {
		return basis
	}

	if field.Permissions == nil {
		basis.Legacy = true
		basis.Allowed = a.legacyPropertyFieldPermission(rctx, userID, field, action, valueTargetID)
		return basis
	}

	if tier, ok := a.propertyRestrictionsAllow(rctx, userID, field, action, valueTargetID); ok {
		basis.Tier = tier
		basis.Allowed = true
		return basis
	}

	if grant := a.propertyGrantForHuman(rctx, userID, field, action); grant != nil {
		basis.GrantID = grant.ID
		basis.GrantWildcard = grant.ID == "*"
		basis.Allowed = true
		return basis
	}

	return basis
}

// propertyGrantForHuman matches a human caller against field's grants: an
// unscoped user grant naming their ID, or a role grant naming a role they
// hold. Machine grants (plugin/service) are never matched here — a session
// user is not a plugin, and matching one would let a user borrow an
// integration's access. A human carries no acting-as scope, so grants are
// matched with an empty scope; a scoped grant will not match.
//
// A grant does not lift the object-level check: hasTargetAccess runs first at
// the API layer, so a role grant naming a compliance officer only reaches
// objects they can already access.
func (a *App) propertyGrantForHuman(rctx request.CTX, userID string, field *model.PropertyField, action string) *model.Grant {
	permissions := field.Permissions
	if grant := permissions.MatchingGrant(model.PropertyOwnerTypeUser, userID, "", action); grant != nil {
		return grant
	}

	// Only look up the caller's roles when the field actually carries a role
	// grant, so the ordinary field pays no store read.
	hasRoleGrant := false
	for _, g := range permissions.Grants {
		if g.Type == model.PropertyOwnerTypeRole {
			hasRoleGrant = true
			break
		}
	}
	if !hasRoleGrant {
		return nil
	}

	user, appErr := a.GetUser(userID)
	if appErr != nil {
		// Fail closed: a lookup error matches no role grant rather than
		// erroring into an allow.
		return nil
	}
	for _, role := range user.GetRoles() {
		if grant := permissions.MatchingGrant(model.PropertyOwnerTypeRole, role, "", action); grant != nil {
			return grant
		}
	}
	return nil
}

// legacyPropertyFieldPermission is the pre-Permissions behaviour, expressed
// per action so callers can ask by action either way. It exists to be
// deleted once every field is converted.
func (a *App) legacyPropertyFieldPermission(rctx request.CTX, userID string, field *model.PropertyField, action, valueTargetID string) bool {
	switch action {
	case model.PropertyActionFieldWrite:
		if field.Protected {
			return false
		}
		if field.PermissionField == nil {
			return false
		}
		return a.hasPropertyFieldPermissionLevel(rctx, userID, field, *field.PermissionField)
	case model.PropertyActionOptionWrite:
		if field.PermissionOptions == nil {
			return false
		}
		return a.hasPropertyFieldPermissionLevel(rctx, userID, field, *field.PermissionOptions)
	case model.PropertyActionValueWrite:
		if field.PermissionValues == nil {
			return false
		}
		return a.hasPropertyFieldValuePermissionLevel(rctx, userID, field, valueTargetID, *field.PermissionValues)
	case model.PropertyActionOptionRead, model.PropertyActionValueRead:
		// Legacy reads are not gated by any permission column: they are
		// gated by the access_mode attr, enforced in the property hook's
		// read filter, which keeps running untouched for these fields.
		return true
	default:
		return false
	}
}

// propertyRestrictionsAllow evaluates the human restrictions ladder for action
// against field's Permissions. It returns the tier that was satisfied and
// whether it was, so a caller recording an audit basis does not have to look
// the tier up a second time.
func (a *App) propertyRestrictionsAllow(rctx request.CTX, userID string, field *model.PropertyField, action, valueTargetID string) (model.PermissionLevel, bool) {
	if field == nil || userID == "" {
		return model.PermissionLevelNone, false
	}

	// field.Permissions is itself optional, so its Restrictions can't be read
	// through it directly without a nil check first.
	var restrictions *model.Restrictions
	if field.Permissions != nil {
		restrictions = field.Permissions.Restrictions
	}
	tier := restrictions.TierFor(action)
	if tier == model.PermissionLevelNone {
		return model.PermissionLevelNone, false
	}

	var satisfied bool
	if model.PropertyActionMeasuredAgainstValueObject(action) {
		satisfied = a.hasPropertyFieldValuePermissionLevel(rctx, userID, field, valueTargetID, tier)
	} else {
		satisfied = a.hasPropertyFieldPermissionLevel(rctx, userID, field, tier)
	}
	if !satisfied {
		return model.PermissionLevelNone, false
	}
	return tier, true
}
