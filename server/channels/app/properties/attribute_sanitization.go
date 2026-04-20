// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

var ErrSanitization = errors.New("value sanitization failed")

// AttributeSanitizationHook normalizes property values before they are
// validated or stored. It trims whitespace from string values, filters
// empty strings from array values, and re-marshals the result. The hook
// runs before the validation hook so that validators see clean data.
//
// The hook only applies to groups whose IDs are in managedGroupIDs.
type AttributeSanitizationHook struct {
	BasePropertyHook
	propertyService *PropertyService
	managedGroupIDs map[string]struct{}
}

var _ PropertyHook = (*AttributeSanitizationHook)(nil)

// NewAttributeSanitizationHook creates a hook that sanitizes property
// values for the given property groups.
func NewAttributeSanitizationHook(ps *PropertyService, managedGroupIDs ...string) *AttributeSanitizationHook {
	ids := make(map[string]struct{}, len(managedGroupIDs))
	for _, id := range managedGroupIDs {
		ids[id] = struct{}{}
	}
	return &AttributeSanitizationHook{
		propertyService: ps,
		managedGroupIDs: ids,
	}
}

func (h *AttributeSanitizationHook) isGroupManaged(groupID string) bool {
	_, ok := h.managedGroupIDs[groupID]
	return ok
}

// sanitizeValueForField normalizes a single property value based on the
// field type. String-typed fields get trimmed; array-typed fields get
// each element trimmed with empty entries removed.
func sanitizeValueForField(field *model.PropertyField, value *model.PropertyValue) error {
	if value.Value == nil {
		return nil
	}

	switch field.Type {
	case model.PropertyFieldTypeText,
		model.PropertyFieldTypeDate,
		model.PropertyFieldTypeSelect,
		model.PropertyFieldTypeUser:

		var str string
		if err := json.Unmarshal(value.Value, &str); err != nil {
			return fmt.Errorf("expected string value for field type %s: %s: %w", field.Type, err.Error(), ErrSanitization)
		}

		trimmed := strings.TrimSpace(str)
		sanitized, err := json.Marshal(trimmed)
		if err != nil {
			return fmt.Errorf("failed to marshal sanitized string value: %s: %w", err.Error(), ErrSanitization)
		}
		value.Value = sanitized

	case model.PropertyFieldTypeMultiselect,
		model.PropertyFieldTypeMultiuser:

		var values []string
		if err := json.Unmarshal(value.Value, &values); err != nil {
			return fmt.Errorf("expected string array value for field type %s: %s: %w", field.Type, err.Error(), ErrSanitization)
		}

		filtered := make([]string, 0, len(values))
		for _, v := range values {
			trimmed := strings.TrimSpace(v)
			if trimmed != "" {
				filtered = append(filtered, trimmed)
			}
		}

		sanitized, err := json.Marshal(filtered)
		if err != nil {
			return fmt.Errorf("failed to marshal sanitized array value: %s: %w", err.Error(), ErrSanitization)
		}
		value.Value = sanitized
	}

	return nil
}

func (h *AttributeSanitizationHook) sanitizeValues(values []*model.PropertyValue) error {
	if len(values) == 0 {
		return nil
	}

	groupID := values[0].GroupID
	if !h.isGroupManaged(groupID) {
		return nil
	}

	// Collect unique field IDs
	fieldIDSet := make(map[string]struct{})
	for _, v := range values {
		fieldIDSet[v.FieldID] = struct{}{}
	}
	fieldIDs := make([]string, 0, len(fieldIDSet))
	for id := range fieldIDSet {
		fieldIDs = append(fieldIDs, id)
	}

	fields, err := h.propertyService.getPropertyFields(groupID, fieldIDs)
	if err != nil {
		return fmt.Errorf("failed to fetch fields for sanitization: %w", err)
	}

	fieldMap := make(map[string]*model.PropertyField, len(fields))
	for _, f := range fields {
		fieldMap[f.ID] = f
	}

	for _, value := range values {
		field, ok := fieldMap[value.FieldID]
		if !ok {
			return fmt.Errorf("field %s not found", value.FieldID)
		}
		if err := sanitizeValueForField(field, value); err != nil {
			return fmt.Errorf("field %s: %w", value.FieldID, err)
		}
	}

	return nil
}

func (h *AttributeSanitizationHook) PreCreatePropertyValue(_ request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	if err := h.sanitizeValues([]*model.PropertyValue{value}); err != nil {
		return nil, err
	}
	return value, nil
}

func (h *AttributeSanitizationHook) PreCreatePropertyValues(_ request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if err := h.sanitizeValues(values); err != nil {
		return nil, err
	}
	return values, nil
}

func (h *AttributeSanitizationHook) PreUpdatePropertyValue(_ request.CTX, _ string, value *model.PropertyValue) (*model.PropertyValue, error) {
	if err := h.sanitizeValues([]*model.PropertyValue{value}); err != nil {
		return nil, err
	}
	return value, nil
}

func (h *AttributeSanitizationHook) PreUpdatePropertyValues(_ request.CTX, _ string, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if err := h.sanitizeValues(values); err != nil {
		return nil, err
	}
	return values, nil
}

func (h *AttributeSanitizationHook) PreUpsertPropertyValue(_ request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	if err := h.sanitizeValues([]*model.PropertyValue{value}); err != nil {
		return nil, err
	}
	return value, nil
}

func (h *AttributeSanitizationHook) PreUpsertPropertyValues(_ request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if err := h.sanitizeValues(values); err != nil {
		return nil, err
	}
	return values, nil
}
