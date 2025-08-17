// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"encoding/json"

	"github.com/mattermost/mattermost/server/public/model"
)

// MakeAuditRecord creates a new audit record with basic information for plugin use.
// This function creates a minimal audit record that can be populated with additional data.
// Use this when you don't have access to request context or want to manually populate fields.
func MakeAuditRecord(event string, initialStatus string) *model.AuditRecord {
	return &model.AuditRecord{
		EventName: event,
		Status:    initialStatus,
		Meta:      make(map[string]any),
		Actor: model.AuditEventActor{
			UserId:        "",
			SessionId:     "",
			Client:        "",
			IpAddress:     "",
			XForwardedFor: "",
		},
		EventData: model.AuditEventData{
			Parameters:  map[string]any{},
			PriorState:  make(map[string]any),
			ResultState: make(map[string]any),
			ObjectType:  "",
		},
	}
}

// MakeAuditRecordWithContext creates a new audit record populated with plugin context information.
// This is the recommended way for plugins to create audit records when they have request context.
// The Context should come from plugin hook parameters or HTTP request handlers.
func MakeAuditRecordWithContext(event string, initialStatus string, ctx *Context, userId, apiPath string) *model.AuditRecord {
	rec := MakeAuditRecord(event, initialStatus)
	rec.AddMeta(model.AuditKeyAPIPath, apiPath)
	rec.Actor.UserId = userId
	rec.Actor.SessionId = ctx.SessionId
	rec.Actor.Client = ctx.UserAgent
	rec.Actor.IpAddress = ctx.IPAddress
	return rec
}

func makeAuditRecordGobSafe(record model.AuditRecord) model.AuditRecord {
	record.EventData.Parameters = makeMapGobSafe(record.EventData.Parameters)
	record.EventData.PriorState = makeMapGobSafe(record.EventData.PriorState)
	record.EventData.ResultState = makeMapGobSafe(record.EventData.ResultState)
	record.Meta = makeMapGobSafe(record.Meta)
	return record
}

// makeMapGobSafe converts map data to a gob-safe representation via JSON round-trip.
// This eliminates problematic types like nil pointers in interfaces that cause gob
// encoding to fail when sending audit data over RPC via the plugin API.
func makeMapGobSafe(m map[string]any) map[string]any {
	jsonBytes, err := json.Marshal(m)
	if err != nil {
		return map[string]any{"error": "failed to serialize audit data"}
	}
	var gobSafe map[string]any
	if err := json.Unmarshal(jsonBytes, &gobSafe); err != nil {
		return map[string]any{"error": "failed to deserialize audit data"}
	}
	return gobSafe
}
