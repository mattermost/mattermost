// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"slices"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// ShapePropertyFieldForCaller returns a per-caller reduced copy of field's
// Permissions, leaving the stored field untouched. serveV3 false means the
// caller's group is still on the v2 payload, which has no place for
// Permissions at all.
func (a *App) ShapePropertyFieldForCaller(rctx request.CTX, session model.Session, field *model.PropertyField, serveV3 bool) *model.PropertyField {
	if field == nil || field.Permissions == nil {
		return field
	}

	copied := *field

	if !serveV3 {
		copied.Permissions = nil
		return &copied
	}

	if a.SessionPropertyFieldEditBasis(rctx, session, field).Allowed {
		return &copied
	}

	permissions := *field.Permissions
	filtered := false

	grants := make([]model.Grant, 0, len(permissions.Grants))
	roles := a.propertyCallerRoles(session.UserId)
	for _, grant := range permissions.Grants {
		switch grant.Type {
		case model.PropertyOwnerTypeUser:
			if grant.ID == session.UserId {
				grants = append(grants, grant)
				continue
			}
		case model.PropertyOwnerTypeRole:
			if slices.Contains(roles, grant.ID) {
				grants = append(grants, grant)
				continue
			}
		}
		filtered = true
	}
	permissions.Grants = grants

	if permissions.Masking != nil {
		if permissions.Masking.MaskByFieldID != "" || len(permissions.Masking.Except) > 0 {
			filtered = true
		}
		permissions.Masking = &model.Masking{}
	}

	permissions.Filtered = filtered
	copied.Permissions = &permissions
	return &copied
}

// ShapePropertyFieldsForCaller applies ShapePropertyFieldForCaller to every
// field in the slice.
func (a *App) ShapePropertyFieldsForCaller(rctx request.CTX, session model.Session, fields []*model.PropertyField, serveV3 bool) []*model.PropertyField {
	shaped := make([]*model.PropertyField, len(fields))
	for i, field := range fields {
		shaped[i] = a.ShapePropertyFieldForCaller(rctx, session, field, serveV3)
	}
	return shaped
}
