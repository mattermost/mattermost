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

var (
	ErrInvalidFieldAttrs = errors.New("invalid field attrs")
	ErrInvalidValue      = errors.New("invalid property value")
	ErrAdminRequired     = errors.New("admin privileges required")
)

// PermissionChecker checks whether a user has a specific permission.
// This avoids a circular dependency between the properties and app packages.
type PermissionChecker func(userID string, permission *model.Permission) bool

// AttributeValidationHook validates property field attributes and values for
// specific property groups. It enforces that:
//   - visibility is one of hidden/when_set/always
//   - sort_order is numeric
//   - text field values conform to value_type constraints (email, url, phone)
//   - managed="admin" can only be set by users with PermissionManageSystem
//   - PermissionValues is kept in sync with the managed attribute
//
// The hook only applies to groups whose IDs are in managedGroupIDs.
type AttributeValidationHook struct {
	BasePropertyHook
	propertyService   *PropertyService
	managedGroupIDs   map[string]struct{}
	permissionChecker PermissionChecker
}

var _ PropertyHook = (*AttributeValidationHook)(nil)

// NewAttributeValidationHook creates a hook that validates field attributes and
// values for the given property groups.
func NewAttributeValidationHook(ps *PropertyService, permChecker PermissionChecker, managedGroupIDs ...string) *AttributeValidationHook {
	ids := make(map[string]struct{}, len(managedGroupIDs))
	for _, id := range managedGroupIDs {
		ids[id] = struct{}{}
	}
	return &AttributeValidationHook{
		propertyService:   ps,
		managedGroupIDs:   ids,
		permissionChecker: permChecker,
	}
}

func (h *AttributeValidationHook) isGroupManaged(groupID string) bool {
	_, ok := h.managedGroupIDs[groupID]
	return ok
}

func (h *AttributeValidationHook) validateFieldAttrs(field *model.PropertyField) error {
	if err := model.ValidatePropertyFieldVisibility(field); err != nil {
		return fmt.Errorf("%s: %w", err.Error(), ErrInvalidFieldAttrs)
	}
	if err := model.ValidatePropertyFieldSortOrder(field); err != nil {
		return fmt.Errorf("%s: %w", err.Error(), ErrInvalidFieldAttrs)
	}
	return nil
}

// enforceGroupPermissions sets the permission levels required for fields in
// managed groups and validates the managed-flag authorization:
//   - PermissionField and PermissionOptions are always set to sysadmin so
//     that only admins can modify field definitions and options.
//   - PermissionValues is set to sysadmin when managed="admin", and to
//     member otherwise, so that regular users can write their own values
//     on non-admin-managed fields.
//   - Setting managed="admin" requires PermissionManageSystem. Callers
//     without an identifiable caller ID (e.g. internal callers with no
//     session on rctx) are treated as non-admin and rejected.
func (h *AttributeValidationHook) enforceGroupPermissions(rctx request.CTX, field *model.PropertyField) (*model.PropertyField, error) {
	managed, _ := field.Attrs[model.CustomProfileAttributesPropertyAttrsManaged].(string)
	sysadmin := model.PermissionLevelSysadmin
	member := model.PermissionLevelMember

	if managed == "admin" {
		// Verify the caller has admin privileges. Default-deny if the
		// permission checker isn't wired up or if the caller is
		// unidentifiable — we never silently promote to sysadmin.
		if h.permissionChecker == nil {
			return nil, fmt.Errorf("missing permission to set managed=admin: no permission checker configured: %w", ErrAdminRequired)
		}
		callerID := h.propertyService.extractCallerID(rctx)
		if callerID == "" || !h.permissionChecker(callerID, model.PermissionManageSystem) {
			return nil, fmt.Errorf("missing permission to set managed=admin: only system admins can set managed=admin: %w", ErrAdminRequired)
		}
		field.PermissionValues = &sysadmin
	} else {
		field.PermissionValues = &member
	}

	// Fields in managed groups always require sysadmin for field/options edits.
	field.PermissionField = &sysadmin
	field.PermissionOptions = &sysadmin

	return field, nil
}

func (h *AttributeValidationHook) PreCreatePropertyField(rctx request.CTX, field *model.PropertyField) (*model.PropertyField, error) {
	if !h.isGroupManaged(field.GroupID) {
		return field, nil
	}

	if err := h.validateFieldAttrs(field); err != nil {
		return nil, err
	}

	return h.enforceGroupPermissions(rctx, field)
}

func (h *AttributeValidationHook) PreUpdatePropertyField(rctx request.CTX, groupID string, field *model.PropertyField) (*model.PropertyField, error) {
	if !h.isGroupManaged(groupID) {
		return field, nil
	}

	if err := h.validateFieldAttrs(field); err != nil {
		return nil, err
	}

	return h.enforceGroupPermissions(rctx, field)
}

func (h *AttributeValidationHook) PreUpdatePropertyFields(rctx request.CTX, groupID string, fields []*model.PropertyField) ([]*model.PropertyField, error) {
	if !h.isGroupManaged(groupID) {
		return fields, nil
	}

	for i, field := range fields {
		if err := h.validateFieldAttrs(field); err != nil {
			return nil, fmt.Errorf("field %s: %w", field.ID, err)
		}

		updated, err := h.enforceGroupPermissions(rctx, field)
		if err != nil {
			return nil, fmt.Errorf("field %s: %w", field.ID, err)
		}
		fields[i] = updated
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
			return fmt.Errorf("field %s: %s: %w", value.FieldID, err.Error(), ErrInvalidValue)
		}
	}

	return nil
}

func (h *AttributeValidationHook) PreUpsertPropertyValue(_ request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	if err := h.validateValues([]*model.PropertyValue{value}); err != nil {
		return nil, err
	}
	return value, nil
}

func (h *AttributeValidationHook) PreUpsertPropertyValues(_ request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if err := h.validateValues(values); err != nil {
		return nil, err
	}
	return values, nil
}

func (h *AttributeValidationHook) PreCreatePropertyValue(_ request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	if err := h.validateValues([]*model.PropertyValue{value}); err != nil {
		return nil, err
	}
	return value, nil
}

func (h *AttributeValidationHook) PreCreatePropertyValues(_ request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if err := h.validateValues(values); err != nil {
		return nil, err
	}
	return values, nil
}

func (h *AttributeValidationHook) PreUpdatePropertyValue(_ request.CTX, _ string, value *model.PropertyValue) (*model.PropertyValue, error) {
	if err := h.validateValues([]*model.PropertyValue{value}); err != nil {
		return nil, err
	}
	return value, nil
}

func (h *AttributeValidationHook) PreUpdatePropertyValues(_ request.CTX, _ string, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if err := h.validateValues(values); err != nil {
		return nil, err
	}
	return values, nil
}
