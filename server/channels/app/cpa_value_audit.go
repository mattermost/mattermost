// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/properties"
)

// auditCPAValueChange emits one audit record for a successful CPA value change.
// It is the ValueAuditSink registered on PropertyValueAuditHook for the CPA
// group. Logged at the content audit level (data change).
func (a *App) auditCPAValueChange(rctx request.CTX, e properties.ValueAuditEvent) {
	rec := a.buildCPAValueAuditRecord(rctx, e)
	a.LogAuditRecWithLevel(rctx, rec, LevelContent, nil)
}

// buildCPAValueAuditRecord assembles the record auditCPAValueChange logs,
// split out so a test can inspect the meta it built without a logging
// backend to intercept.
func (a *App) buildCPAValueAuditRecord(rctx request.CTX, e properties.ValueAuditEvent) *model.AuditRecord {
	callerID, _ := CallerIDFromRequestContext(rctx)
	scope := model.PropertyRequestOptionsFromContext(rctx.Context()).ActingAsScope

	rec := a.MakeAuditRecord(rctx, model.AuditEventCPAValueChange, model.AuditStatusSuccess)
	rec.AddMeta("caller_id", callerID)
	rec.AddMeta("acting_as_scope", scope)
	rec.AddMeta("group", model.AccessControlPropertyGroupName)
	rec.AddMeta("action", e.Action)
	rec.AddMeta("target_type", e.TargetType)
	rec.AddMeta("target_id", e.TargetID)
	if e.FieldID != "" {
		rec.AddMeta("field_id", e.FieldID)
	}
	if e.ValueID != "" {
		rec.AddMeta("value_id", e.ValueID)
	}
	switch e.Action {
	case properties.ValueAuditActionDeleteForTarget, properties.ValueAuditActionDeleteForField:
		// Bulk deletes have no per-value payload, and delete_for_target
		// carries no field ID to derive a basis from.
	default:
		if e.Prev != nil && len(e.Prev.Value) > 0 {
			rec.AddMeta("prior_value", string(e.Prev.Value))
		}
		if e.Current != nil && len(e.Current.Value) > 0 {
			rec.AddMeta("new_value", string(e.Current.Value))
		}
		a.addCPAValueAuditBasis(rctx, rec, e, callerID)
	}

	return rec
}

// addCPAValueAuditBasis records which rule allowed the write: the caller
// identity is already on rec, so this fills in the matching grant or
// satisfied restrictions tier that made it a value.write. A field lookup
// that fails must not drop the record it's called from — it just logs the
// lookup error and leaves rec with no basis meta, since the write already
// happened and this is a post-hook, not a gate.
func (a *App) addCPAValueAuditBasis(rctx request.CTX, rec *model.AuditRecord, e properties.ValueAuditEvent, callerID string) {
	field, appErr := a.GetPropertyField(rctx, "", e.FieldID)
	if appErr != nil {
		rctx.Logger().Error("Failed to look up property field for value audit basis",
			mlog.Err(appErr),
			mlog.String("field_id", e.FieldID),
		)
		return
	}

	basis := a.PropertyPermissionBasisFor(rctx, field, model.PropertyActionValueWrite, e.TargetID)

	// A caller writing their own value on a masked user-object field widens
	// what they can subsequently read, so that write is called out
	// specifically. A machine caller's ID is a manifest ID, so it never
	// equals e.TargetID (a user ID) here — not a coincidence that this never
	// fires for one, just that the two ID spaces never collide.
	basis.HoldingsChange = field.Permissions != nil && field.Permissions.Masking != nil &&
		field.ObjectType == model.PropertyFieldObjectTypeUser && e.TargetID == callerID

	if basis.Tier != "" {
		rec.AddMeta("basis_tier", basis.Tier)
	}
	if basis.GrantID != "" {
		rec.AddMeta("basis_grant_id", basis.GrantID)
	}
	if basis.GrantScope != "" {
		rec.AddMeta("basis_grant_scope", basis.GrantScope)
	}
	if basis.GrantWildcard {
		rec.AddMeta("basis_grant_wildcard", true)
	}
	if basis.Legacy {
		rec.AddMeta("basis_legacy", true)
	}
	if basis.Unrestricted {
		rec.AddMeta("basis_unrestricted", true)
	}
	if basis.HoldingsChange {
		rec.AddMeta("basis_holdings_change", true)
	}
}
