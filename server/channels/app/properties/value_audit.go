// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// Value audit actions, recorded as the "action" meta on the audit record
// emitted by a group's ValueAuditSink. Exported so group-specific sinks can
// branch on the action type.
const (
	ValueAuditActionCreate          = "create"
	ValueAuditActionUpdate          = "update"
	ValueAuditActionUpsert          = "upsert"
	ValueAuditActionDelete          = "delete"
	ValueAuditActionDeleteForTarget = "delete_for_target"
	ValueAuditActionDeleteForField  = "delete_for_field"
)

// ValueAuditEvent describes one successful property value change passed to a
// group's ValueAuditSink. Prev and Current are nil for bulk-delete actions
// (delete_for_target, delete_for_field). Each group decides which fields to
// include in its audit record.
type ValueAuditEvent struct {
	Action     string
	TargetType string
	TargetID   string
	FieldID    string
	ValueID    string
	Prev       *model.PropertyValue
	Current    *model.PropertyValue
}

// ValueAuditSink emits one audit record for a successful property value change.
// Each property group registers its own sink so the properties package stays
// independent of the audit subsystem.
type ValueAuditSink func(rctx request.CTX, e ValueAuditEvent)

// PropertyValueAuditHook audits value writes for registered property groups.
// Every write path funnels through the generic value write path, so auditing
// lives here rather than in each API handler. Post-hooks run after the store
// write. Groups without a registered sink are not audited.
type PropertyValueAuditHook struct {
	BasePropertyHook
	sinks map[string]ValueAuditSink
}

var _ PropertyHook = (*PropertyValueAuditHook)(nil)

// NewPropertyValueAuditHook creates a value audit hook. Call RegisterGroup to
// opt groups in with a sink callback.
func NewPropertyValueAuditHook() *PropertyValueAuditHook {
	return &PropertyValueAuditHook{
		sinks: make(map[string]ValueAuditSink),
	}
}

// RegisterGroup registers an audit sink for the given property group ID.
func (h *PropertyValueAuditHook) RegisterGroup(groupID string, sink ValueAuditSink) {
	h.sinks[groupID] = sink
}

func (h *PropertyValueAuditHook) sinkFor(groupID string) ValueAuditSink {
	return h.sinks[groupID]
}

func (h *PropertyValueAuditHook) emit(rctx request.CTX, groupID string, e ValueAuditEvent) {
	sink := h.sinkFor(groupID)
	if sink == nil {
		return
	}
	sink(rctx, e)
}

// auditWrite emits an audit record for a successful write.
func (h *PropertyValueAuditHook) auditWrite(rctx request.CTX, action string, value *model.PropertyValue) {
	if value == nil {
		return
	}
	h.emit(rctx, value.GroupID, ValueAuditEvent{
		Action:     action,
		TargetType: value.TargetType,
		TargetID:   value.TargetID,
		FieldID:    value.FieldID,
		Current:    value,
	})
}

// auditCreate emits a create audit record. A create always introduces a new
// value (a conflicting create fails), so there is no no-op to suppress.
func (h *PropertyValueAuditHook) auditCreate(rctx request.CTX, value *model.PropertyValue) {
	if value == nil {
		return
	}
	h.emit(rctx, value.GroupID, ValueAuditEvent{
		Action:     ValueAuditActionCreate,
		TargetType: value.TargetType,
		TargetID:   value.TargetID,
		FieldID:    value.FieldID,
		Current:    value,
	})
}

func (h *PropertyValueAuditHook) PostCreatePropertyValue(rctx request.CTX, value *model.PropertyValue) error {
	h.auditCreate(rctx, value)
	return nil
}

func (h *PropertyValueAuditHook) PostCreatePropertyValues(rctx request.CTX, values []*model.PropertyValue) error {
	for _, v := range values {
		h.auditCreate(rctx, v)
	}
	return nil
}

func (h *PropertyValueAuditHook) PostUpdatePropertyValue(rctx request.CTX, value *model.PropertyValue) error {
	h.auditWrite(rctx, ValueAuditActionUpdate, value)
	return nil
}

func (h *PropertyValueAuditHook) PostUpdatePropertyValues(rctx request.CTX, values []*model.PropertyValue) error {
	for _, v := range values {
		h.auditWrite(rctx, ValueAuditActionUpdate, v)
	}
	return nil
}

func (h *PropertyValueAuditHook) PostUpsertPropertyValue(rctx request.CTX, value *model.PropertyValue) error {
	h.auditWrite(rctx, ValueAuditActionUpsert, value)
	return nil
}

func (h *PropertyValueAuditHook) PostUpsertPropertyValues(rctx request.CTX, values []*model.PropertyValue) error {
	for _, v := range values {
		h.auditWrite(rctx, ValueAuditActionUpsert, v)
	}
	return nil
}

func (h *PropertyValueAuditHook) PostDeletePropertyValue(rctx request.CTX, groupID, valueID string, deleted *model.PropertyValue) error {
	event := ValueAuditEvent{
		Action:  ValueAuditActionDelete,
		ValueID: valueID,
	}
	emitGroupID := groupID
	if deleted != nil {
		event.TargetType = deleted.TargetType
		event.TargetID = deleted.TargetID
		event.FieldID = deleted.FieldID
		event.Prev = deleted
		emitGroupID = deleted.GroupID
	}

	h.emit(rctx, emitGroupID, event)
	return nil
}

func (h *PropertyValueAuditHook) PostDeletePropertyValuesForTarget(rctx request.CTX, groupID, targetType, targetID string) error {
	h.emit(rctx, groupID, ValueAuditEvent{
		Action:     ValueAuditActionDeleteForTarget,
		TargetType: targetType,
		TargetID:   targetID,
	})
	return nil
}

func (h *PropertyValueAuditHook) PostDeletePropertyValuesForField(rctx request.CTX, groupID, fieldID string) error {
	h.emit(rctx, groupID, ValueAuditEvent{
		Action:  ValueAuditActionDeleteForField,
		FieldID: fieldID,
	})
	return nil
}
