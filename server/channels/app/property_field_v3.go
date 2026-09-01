// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"slices"
	"sync"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// ShapePropertyFieldForCaller returns a per-caller reduced copy of field's
// Permissions, leaving the stored field untouched. serveV3 false means the
// caller's group is still on the v2 payload, which has no place for
// Permissions at all.
func (a *App) ShapePropertyFieldForCaller(rctx request.CTX, session model.Session, field *model.PropertyField, serveV3 bool) *model.PropertyField {
	roles := sync.OnceValue(func() []string { return a.propertyCallerRoles(session.UserId) })
	return a.shapePropertyFieldForCaller(rctx, session, field, serveV3, make(map[string]*model.PropertyField), roles)
}

// ShapePropertyFieldsForCaller applies ShapePropertyFieldForCaller to every
// field in the slice, resolving each linked field's masking template at most
// once no matter how many of the fields link to it, and the caller's roles at
// most once no matter how many fields need them.
func (a *App) ShapePropertyFieldsForCaller(rctx request.CTX, session model.Session, fields []*model.PropertyField, serveV3 bool) []*model.PropertyField {
	templates := make(map[string]*model.PropertyField)
	roles := sync.OnceValue(func() []string { return a.propertyCallerRoles(session.UserId) })
	shaped := make([]*model.PropertyField, len(fields))
	for i, field := range fields {
		shaped[i] = a.shapePropertyFieldForCaller(rctx, session, field, serveV3, templates, roles)
	}
	return shaped
}

func (a *App) shapePropertyFieldForCaller(rctx request.CTX, session model.Session, field *model.PropertyField, serveV3 bool, templates map[string]*model.PropertyField, roles func() []string) *model.PropertyField {
	if field == nil || field.Permissions == nil {
		return field
	}

	copied := *field

	if !serveV3 {
		copied.Permissions = nil
		return &copied
	}

	isLinked := field.LinkedFieldID != nil && *field.LinkedFieldID != ""
	canEdit := a.SessionPropertyFieldEditBasis(rctx, session, field).Allowed

	permissions := *field.Permissions
	filtered := false

	// A caller who may edit an unlinked field sees masking in full; every
	// other arm gets presence only. A linked field's masking is never
	// editable, so a field.write holder still only sees whether it is
	// masked, never mask_by_field_id or except -- those belong to the
	// template's administrator.
	if !canEdit || isLinked {
		if isLinked {
			permissions.Masking, filtered = a.linkedFieldMaskingPresence(rctx, field, templates)
		} else {
			permissions.Masking, filtered = maskingPresence(permissions.Masking)
		}
	}

	if !canEdit {
		grants := make([]model.Grant, 0, len(permissions.Grants))
		for _, grant := range permissions.Grants {
			switch grant.Type {
			case model.PropertyOwnerTypeUser:
				if grant.ID == session.UserId {
					grants = append(grants, grant)
					continue
				}
			case model.PropertyOwnerTypeRole:
				if slices.Contains(roles(), grant.ID) {
					grants = append(grants, grant)
					continue
				}
			}
			filtered = true
		}
		permissions.Grants = grants
	}

	// A shorter grants array is fine; a different shape per caller is not --
	// nil for an editor and [] for everyone else is exactly the branch a
	// client checking permissions.grants.length would have to take.
	if permissions.Grants == nil {
		permissions.Grants = []model.Grant{}
	}
	permissions.Filtered = filtered
	copied.Permissions = &permissions
	return &copied
}

// maskingPresence returns the presence-only form of a field's own masking --
// an empty *model.Masking when masked, nil when not -- and whether its
// mask_by_field_id or except carried anything worth calling out as filtered.
func maskingPresence(masking *model.Masking) (*model.Masking, bool) {
	if masking == nil {
		return nil, false
	}
	filtered := masking.MaskByFieldID != "" || len(masking.Except) > 0
	return &model.Masking{}, filtered
}

// linkedFieldMaskingPresence resolves the presence-only masking a linked
// field reports, which is its template's -- a linked field may not declare
// masking of its own. A template read that fails is reported as masked with
// contents withheld rather than as unmasked: the wrong direction here is
// telling a caller a masked field is not.
func (a *App) linkedFieldMaskingPresence(rctx request.CTX, field *model.PropertyField, templates map[string]*model.PropertyField) (*model.Masking, bool) {
	template, err := a.linkedFieldTemplate(rctx, field, templates)
	if err != nil {
		rctx.Logger().Error("Failed to resolve linked field's masking template", mlog.String("field_id", field.ID), mlog.Err(err))
		return &model.Masking{}, true
	}
	if template.Permissions == nil {
		return nil, false
	}
	return maskingPresence(template.Permissions.Masking)
}

// linkedFieldTemplate returns field's linked template, reading it once per
// template ID for the lifetime of templates rather than once per field.
func (a *App) linkedFieldTemplate(rctx request.CTX, field *model.PropertyField, templates map[string]*model.PropertyField) (*model.PropertyField, error) {
	templateID := *field.LinkedFieldID
	if template, ok := templates[templateID]; ok {
		return template, nil
	}
	template, appErr := a.GetPropertyField(rctx, field.GroupID, templateID)
	if appErr != nil {
		return nil, appErr
	}
	templates[templateID] = template
	return template, nil
}
