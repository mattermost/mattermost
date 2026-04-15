// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// AttributeValidationHook validates property field attributes and values for
// specific property groups. It enforces that:
//   - visibility is one of hidden/when_set/always
//   - sort_order is numeric
//   - text field values conform to value_type constraints (email, url, phone)
//
// The hook only applies to groups whose IDs are in managedGroupIDs.
type AttributeValidationHook struct {
	BasePropertyHook
	propertyService *PropertyService
	managedGroupIDs map[string]struct{}
}

var _ PropertyHook = (*AttributeValidationHook)(nil)

// NewAttributeValidationHook creates a hook that validates field attributes and
// values for the given property groups.
func NewAttributeValidationHook(ps *PropertyService, managedGroupIDs ...string) *AttributeValidationHook {
	ids := make(map[string]struct{}, len(managedGroupIDs))
	for _, id := range managedGroupIDs {
		ids[id] = struct{}{}
	}
	return &AttributeValidationHook{
		propertyService: ps,
		managedGroupIDs: ids,
	}
}

func (h *AttributeValidationHook) isGroupManaged(groupID string) bool {
	_, ok := h.managedGroupIDs[groupID]
	return ok
}

func (h *AttributeValidationHook) validateFieldAttrs(field *model.PropertyField) error {
	if err := model.ValidatePropertyFieldVisibility(field); err != nil {
		return err
	}
	if err := model.ValidatePropertyFieldSortOrder(field); err != nil {
		return err
	}
	return nil
}

func (h *AttributeValidationHook) PreCreatePropertyField(_ request.CTX, field *model.PropertyField) (*model.PropertyField, error) {
	if !h.isGroupManaged(field.GroupID) {
		return field, nil
	}

	if err := h.validateFieldAttrs(field); err != nil {
		return nil, fmt.Errorf("PreCreatePropertyField: %w", err)
	}

	return field, nil
}

func (h *AttributeValidationHook) PreUpdatePropertyField(_ request.CTX, groupID string, field *model.PropertyField) (*model.PropertyField, error) {
	if !h.isGroupManaged(groupID) {
		return field, nil
	}

	if err := h.validateFieldAttrs(field); err != nil {
		return nil, fmt.Errorf("PreUpdatePropertyField: %w", err)
	}

	return field, nil
}

func (h *AttributeValidationHook) PreUpdatePropertyFields(_ request.CTX, groupID string, fields []*model.PropertyField) ([]*model.PropertyField, error) {
	if !h.isGroupManaged(groupID) {
		return fields, nil
	}

	for _, field := range fields {
		if err := h.validateFieldAttrs(field); err != nil {
			return nil, fmt.Errorf("PreUpdatePropertyFields: field %s: %w", field.ID, err)
		}
	}

	return fields, nil
}

// extractOptionIDs extracts the set of valid option IDs from a
// select or multiselect PropertyField's attrs. Returns nil if the
// field has no options.
func extractOptionIDs(field *model.PropertyField) (map[string]struct{}, error) {
	if field.Attrs == nil {
		return nil, nil
	}

	rawOptions, ok := field.Attrs[model.PropertyFieldAttributeOptions]
	if !ok || rawOptions == nil {
		return nil, nil
	}

	data, err := json.Marshal(rawOptions)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal options: %w", err)
	}

	var options []struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(data, &options); err != nil {
		return nil, fmt.Errorf("invalid options format: %w", err)
	}

	ids := make(map[string]struct{}, len(options))
	for _, opt := range options {
		if opt.ID != "" {
			ids[opt.ID] = struct{}{}
		}
	}
	return ids, nil
}

// validateValueAgainstField checks a property value against field-type
// constraints:
//   - text: max length, value_type format (email, url, phone)
//   - select: option ID must exist in the field's options
//   - multiselect: all option IDs must exist
//   - user: value must be a valid Mattermost ID
//   - multiuser: all values must be valid Mattermost IDs
func (h *AttributeValidationHook) validateValueAgainstField(field *model.PropertyField, value *model.PropertyValue) error {
	switch field.Type {
	case model.PropertyFieldTypeText:
		var str string
		if err := json.Unmarshal(value.Value, &str); err != nil {
			return fmt.Errorf("expected string value: %w", err)
		}
		if len(strings.TrimSpace(str)) > model.PropertyFieldValueTypeTextMaxLength {
			return fmt.Errorf("text value exceeds maximum length of %d characters", model.PropertyFieldValueTypeTextMaxLength)
		}

		valueType := model.GetPropertyFieldValueType(field)
		if valueType == "" {
			return nil
		}
		return model.ValidatePropertyValueForValueType(valueType, value.Value)

	case model.PropertyFieldTypeSelect:
		var str string
		if err := json.Unmarshal(value.Value, &str); err != nil {
			return fmt.Errorf("expected string value for select field: %w", err)
		}
		if str == "" {
			return nil
		}
		optionIDs, err := extractOptionIDs(field)
		if err != nil {
			return fmt.Errorf("failed to extract options: %w", err)
		}
		if _, ok := optionIDs[str]; !ok {
			return fmt.Errorf("option %q does not exist", str)
		}

	case model.PropertyFieldTypeMultiselect:
		var values []string
		if err := json.Unmarshal(value.Value, &values); err != nil {
			return fmt.Errorf("expected string array value for multiselect field: %w", err)
		}
		optionIDs, err := extractOptionIDs(field)
		if err != nil {
			return fmt.Errorf("failed to extract options: %w", err)
		}
		for _, v := range values {
			if _, ok := optionIDs[v]; !ok {
				return fmt.Errorf("option %q does not exist", v)
			}
		}

	case model.PropertyFieldTypeUser:
		var str string
		if err := json.Unmarshal(value.Value, &str); err != nil {
			return fmt.Errorf("expected string value for user field: %w", err)
		}
		if str != "" && !model.IsValidId(str) {
			return fmt.Errorf("invalid user id")
		}

	case model.PropertyFieldTypeMultiuser:
		var values []string
		if err := json.Unmarshal(value.Value, &values); err != nil {
			return fmt.Errorf("expected string array value for multiuser field: %w", err)
		}
		for _, v := range values {
			if !model.IsValidId(v) {
				return fmt.Errorf("invalid user id: %s", v)
			}
		}
	}

	return nil
}

func (h *AttributeValidationHook) validateValues(values []*model.PropertyValue) error {
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
		return fmt.Errorf("failed to fetch fields for validation: %w", err)
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
		if err := h.validateValueAgainstField(field, value); err != nil {
			return fmt.Errorf("field %s: %w", value.FieldID, err)
		}
	}

	return nil
}

func (h *AttributeValidationHook) PreUpsertPropertyValue(_ request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	if err := h.validateValues([]*model.PropertyValue{value}); err != nil {
		return nil, fmt.Errorf("PreUpsertPropertyValue: %w", err)
	}
	return value, nil
}

func (h *AttributeValidationHook) PreUpsertPropertyValues(_ request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if err := h.validateValues(values); err != nil {
		return nil, fmt.Errorf("PreUpsertPropertyValues: %w", err)
	}
	return values, nil
}

func (h *AttributeValidationHook) PreCreatePropertyValue(_ request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	if err := h.validateValues([]*model.PropertyValue{value}); err != nil {
		return nil, fmt.Errorf("PreCreatePropertyValue: %w", err)
	}
	return value, nil
}

func (h *AttributeValidationHook) PreCreatePropertyValues(_ request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if err := h.validateValues(values); err != nil {
		return nil, fmt.Errorf("PreCreatePropertyValues: %w", err)
	}
	return values, nil
}

func (h *AttributeValidationHook) PreUpdatePropertyValue(_ request.CTX, _ string, value *model.PropertyValue) (*model.PropertyValue, error) {
	if err := h.validateValues([]*model.PropertyValue{value}); err != nil {
		return nil, fmt.Errorf("PreUpdatePropertyValue: %w", err)
	}
	return value, nil
}

func (h *AttributeValidationHook) PreUpdatePropertyValues(_ request.CTX, _ string, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if err := h.validateValues(values); err != nil {
		return nil, fmt.Errorf("PreUpdatePropertyValues: %w", err)
	}
	return values, nil
}
