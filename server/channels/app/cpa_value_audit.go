// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/properties"
)

// auditCPAValueChange emits one audit record for a successful CPA value change.
// It is the ValueAuditSink registered on PropertyValueAuditHook for the CPA
// group. Logged at the content audit level (data change).
func (a *App) auditCPAValueChange(rctx request.CTX, e properties.ValueAuditEvent) {
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
		// Bulk deletes have no per-value payload.
	default:
		if e.Prev != nil && len(e.Prev.Value) > 0 {
			rec.AddMeta("prior_value", string(e.Prev.Value))
		}
		if e.Current != nil && len(e.Current.Value) > 0 {
			rec.AddMeta("new_value", string(e.Current.Value))
		}
	}

	a.LogAuditRecWithLevel(rctx, rec, LevelContent, nil)
}
