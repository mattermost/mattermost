// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
)

// DefaultPropertyFieldPermissionLevel returns the permission level that
// nil-fill / non-admin-pin should use for this field. Templates and system
// fields default to sysadmin (templates define the schema linked fields
// inherit; system fields attach to the Mattermost instance and only an
// administrator should write them). Other object types default to member.
func DefaultPropertyFieldPermissionLevel(field *model.PropertyField) model.PermissionLevel {
	if field.ObjectType == model.PropertyFieldObjectTypeTemplate ||
		field.ObjectType == model.PropertyFieldObjectTypeSystem {
		return model.PermissionLevelSysadmin
	}
	return model.PermissionLevelMember
}

// CanonicalizeSystemObjectField forces a system-object field to its only
// valid shape: TargetType="system", TargetID="", and all three Permission*
// pinned to sysadmin. A system field's TargetType makes member-level scope
// checks resolve to "any authenticated user" (see hasPropertyFieldScopeAccess
// in app/authorization.go), so honouring a member-level permission would
// expose the field's definition, options, and values to every logged-in user.
//
// Idempotent. Safe to call from both the API handler (before scope check)
// and from inside App.CreatePropertyField (defense in depth, covers
// plugin/internal callers).
func CanonicalizeSystemObjectField(field *model.PropertyField) {
	if field == nil || field.ObjectType != model.PropertyFieldObjectTypeSystem {
		return
	}
	field.TargetType = string(model.PropertyFieldTargetLevelSystem)
	field.TargetID = ""
	sysadmin := model.PermissionLevelSysadmin
	field.PermissionField = &sysadmin
	field.PermissionValues = &sysadmin
	field.PermissionOptions = &sysadmin
}
