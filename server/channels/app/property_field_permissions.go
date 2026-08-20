// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

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
