// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"net/http"
	"reflect"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// SessionAttributesHook keeps the seeded session_attributes schema fixed: fields
// can't be created or deleted through the public API, and updates are limited to
// the tunable Attrs (enabled, ttl_seconds, grace_period_seconds). The fields are
// not Protected (that is reserved for plugin-owned fields), so this hook is the
// enforcement instead.
type SessionAttributesHook struct {
	BasePropertyHook
	propertyService *PropertyService
	groupID         string
}

var _ PropertyHook = (*SessionAttributesHook)(nil)

func NewSessionAttributesHook(ps *PropertyService, groupID string) *SessionAttributesHook {
	return &SessionAttributesHook{propertyService: ps, groupID: groupID}
}

func (h *SessionAttributesHook) manages(groupID string) bool {
	return groupID == h.groupID
}

func isSystemCaller(rctx request.CTX) bool {
	return rctx == nil
}

func (h *SessionAttributesHook) PreCreatePropertyField(rctx request.CTX, field *model.PropertyField) (*model.PropertyField, error) {
	if field.GroupID != h.groupID || isSystemCaller(rctx) {
		return field, nil
	}
	return nil, h.immutableErr("created")
}

func (h *SessionAttributesHook) PreDeletePropertyField(rctx request.CTX, groupID string, _ string) error {
	if !h.manages(groupID) || isSystemCaller(rctx) {
		return nil
	}
	return h.immutableErr("deleted")
}

func (h *SessionAttributesHook) PreUpdatePropertyField(rctx request.CTX, groupID string, field *model.PropertyField) (*model.PropertyField, error) {
	if !h.manages(groupID) || isSystemCaller(rctx) {
		return field, nil
	}
	if err := h.validateUpdate(field); err != nil {
		return nil, err
	}
	return field, nil
}

func (h *SessionAttributesHook) PreUpdatePropertyFields(rctx request.CTX, groupID string, fields []*model.PropertyField) ([]*model.PropertyField, error) {
	if !h.manages(groupID) || isSystemCaller(rctx) {
		return fields, nil
	}
	for _, field := range fields {
		if err := h.validateUpdate(field); err != nil {
			return nil, err
		}
	}
	return fields, nil
}

func (h *SessionAttributesHook) validateUpdate(incoming *model.PropertyField) error {
	existing, err := h.propertyService.getPropertyFieldFromMaster(h.groupID, incoming.ID)
	if err != nil {
		return err
	}
	if sessionAttributeIdentityChanged(existing, incoming) || !sessionAttributeAttrsEditAllowed(existing.Attrs, incoming.Attrs) {
		return h.immutableErr("changed")
	}
	return nil
}

func (h *SessionAttributesHook) immutableErr(verb string) *model.AppError {
	return model.NewAppError("SessionAttributesHook", "app.session_attributes.field_immutable.app_error",
		nil, "session attribute field "+verb, http.StatusForbidden)
}

func sessionAttributeIdentityChanged(existing, incoming *model.PropertyField) bool {
	if existing.Name != incoming.Name ||
		existing.Type != incoming.Type ||
		existing.TargetID != incoming.TargetID ||
		existing.TargetType != incoming.TargetType ||
		existing.ObjectType != incoming.ObjectType {
		return true
	}
	if (existing.LinkedFieldID == nil) != (incoming.LinkedFieldID == nil) {
		return true
	}
	return existing.LinkedFieldID != nil && *existing.LinkedFieldID != *incoming.LinkedFieldID
}

func sessionAttributeAttrsEditAllowed(existing, incoming model.StringInterface) bool {
	tunable := map[string]bool{
		model.SAAttrEnabled:            true,
		model.SAAttrTTLSeconds:         true,
		model.SAAttrGracePeriodSeconds: true,
	}
	for key, existingValue := range existing {
		if tunable[key] {
			continue
		}
		incomingValue, ok := incoming[key]
		if !ok || !reflect.DeepEqual(existingValue, incomingValue) {
			return false
		}
	}
	for key := range incoming {
		if !tunable[key] {
			if _, ok := existing[key]; !ok {
				return false
			}
		}
	}
	return true
}
