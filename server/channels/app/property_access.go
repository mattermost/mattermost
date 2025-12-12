// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"maps"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app/properties"
)

// PropertyAccessService is a decorator around PropertyService that enforces
// access control based on caller identity. All property operations go through
// this service to ensure consistent access control enforcement.
//
// Currently, this service acts as a simple pass-through to PropertyService.
// Access control logic will be added in subsequent commits.
type PropertyAccessService struct {
	propertyService *properties.PropertyService
}

// NewPropertyAccessService creates a new PropertyAccessService wrapping the given PropertyService.
func NewPropertyAccessService(ps *properties.PropertyService) *PropertyAccessService {
	return &PropertyAccessService{
		propertyService: ps,
	}
}

// Property Group Methods

// RegisterPropertyGroup registers a new property group.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) RegisterPropertyGroup(callerID string, name string) (*model.PropertyGroup, error) {
	return pas.propertyService.RegisterPropertyGroup(name)
}

// GetPropertyGroup retrieves a property group by name.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) GetPropertyGroup(callerID string, name string) (*model.PropertyGroup, error) {
	return pas.propertyService.GetPropertyGroup(name)
}

// Property Field Methods

// CreatePropertyField creates a new property field.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) CreatePropertyField(callerID string, field *model.PropertyField) (*model.PropertyField, error) {
	return pas.propertyService.CreatePropertyField(field)
}

// GetPropertyField retrieves a property field by group and field ID.
// callerID identifies the caller (pluginID, userID, or empty string for system).
// Field options are filtered based on the caller's access permissions.
func (pas *PropertyAccessService) GetPropertyField(callerID string, groupID, id string) (*model.PropertyField, error) {
	field, err := pas.propertyService.GetPropertyField(groupID, id)
	if err != nil {
		return nil, err
	}

	return pas.applyFieldReadAccessControl(field, callerID), nil
}

// GetPropertyFields retrieves multiple property fields by their IDs.
// callerID identifies the caller (pluginID, userID, or empty string for system).
// Field options are filtered based on the caller's access permissions.
func (pas *PropertyAccessService) GetPropertyFields(callerID string, groupID string, ids []string) ([]*model.PropertyField, error) {
	fields, err := pas.propertyService.GetPropertyFields(groupID, ids)
	if err != nil {
		return nil, err
	}

	return pas.applyFieldReadAccessControlToList(fields, callerID), nil
}

// GetPropertyFieldByName retrieves a property field by name.
// callerID identifies the caller (pluginID, userID, or empty string for system).
// Field options are filtered based on the caller's access permissions.
func (pas *PropertyAccessService) GetPropertyFieldByName(callerID string, groupID, targetID, name string) (*model.PropertyField, error) {
	field, err := pas.propertyService.GetPropertyFieldByName(groupID, targetID, name)
	if err != nil {
		return nil, err
	}

	return pas.applyFieldReadAccessControl(field, callerID), nil
}

// CountActivePropertyFieldsForGroup counts active property fields for a group.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) CountActivePropertyFieldsForGroup(callerID string, groupID string) (int64, error) {
	return pas.propertyService.CountActivePropertyFieldsForGroup(groupID)
}

// CountAllPropertyFieldsForGroup counts all property fields (including deleted) for a group.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) CountAllPropertyFieldsForGroup(callerID string, groupID string) (int64, error) {
	return pas.propertyService.CountAllPropertyFieldsForGroup(groupID)
}

// CountActivePropertyFieldsForTarget counts active property fields for a specific target.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) CountActivePropertyFieldsForTarget(callerID string, groupID, targetType, targetID string) (int64, error) {
	return pas.propertyService.CountActivePropertyFieldsForTarget(groupID, targetType, targetID)
}

// CountAllPropertyFieldsForTarget counts all property fields (including deleted) for a specific target.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) CountAllPropertyFieldsForTarget(callerID string, groupID, targetType, targetID string) (int64, error) {
	return pas.propertyService.CountAllPropertyFieldsForTarget(groupID, targetType, targetID)
}

// SearchPropertyFields searches for property fields based on the given options.
// callerID identifies the caller (pluginID, userID, or empty string for system).
// Field options are filtered based on the caller's access permissions.
func (pas *PropertyAccessService) SearchPropertyFields(callerID string, groupID string, opts model.PropertyFieldSearchOpts) ([]*model.PropertyField, error) {
	fields, err := pas.propertyService.SearchPropertyFields(groupID, opts)
	if err != nil {
		return nil, err
	}

	return pas.applyFieldReadAccessControlToList(fields, callerID), nil
}

// UpdatePropertyField updates a property field.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) UpdatePropertyField(callerID string, groupID string, field *model.PropertyField) (*model.PropertyField, error) {
	return pas.propertyService.UpdatePropertyField(groupID, field)
}

// UpdatePropertyFields updates multiple property fields.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) UpdatePropertyFields(callerID string, groupID string, fields []*model.PropertyField) ([]*model.PropertyField, error) {
	return pas.propertyService.UpdatePropertyFields(groupID, fields)
}

// DeletePropertyField deletes a property field and all its values.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) DeletePropertyField(callerID string, groupID, id string) error {
	return pas.propertyService.DeletePropertyField(groupID, id)
}

// Property Value Methods

// CreatePropertyValue creates a new property value.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) CreatePropertyValue(callerID string, value *model.PropertyValue) (*model.PropertyValue, error) {
	return pas.propertyService.CreatePropertyValue(value)
}

// CreatePropertyValues creates multiple property values.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) CreatePropertyValues(callerID string, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	return pas.propertyService.CreatePropertyValues(values)
}

// GetPropertyValue retrieves a property value by ID.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) GetPropertyValue(callerID string, groupID, id string) (*model.PropertyValue, error) {
	return pas.propertyService.GetPropertyValue(groupID, id)
}

// GetPropertyValues retrieves multiple property values by their IDs.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) GetPropertyValues(callerID string, groupID string, ids []string) ([]*model.PropertyValue, error) {
	return pas.propertyService.GetPropertyValues(groupID, ids)
}

// SearchPropertyValues searches for property values based on the given options.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) SearchPropertyValues(callerID string, groupID string, opts model.PropertyValueSearchOpts) ([]*model.PropertyValue, error) {
	return pas.propertyService.SearchPropertyValues(groupID, opts)
}

// UpdatePropertyValue updates a property value.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) UpdatePropertyValue(callerID string, groupID string, value *model.PropertyValue) (*model.PropertyValue, error) {
	return pas.propertyService.UpdatePropertyValue(groupID, value)
}

// UpdatePropertyValues updates multiple property values.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) UpdatePropertyValues(callerID string, groupID string, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	return pas.propertyService.UpdatePropertyValues(groupID, values)
}

// UpsertPropertyValue creates or updates a property value.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) UpsertPropertyValue(callerID string, value *model.PropertyValue) (*model.PropertyValue, error) {
	return pas.propertyService.UpsertPropertyValue(value)
}

// UpsertPropertyValues creates or updates multiple property values.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) UpsertPropertyValues(callerID string, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	return pas.propertyService.UpsertPropertyValues(values)
}

// DeletePropertyValue deletes a property value.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) DeletePropertyValue(callerID string, groupID, id string) error {
	return pas.propertyService.DeletePropertyValue(groupID, id)
}

// DeletePropertyValuesForTarget deletes all property values for a specific target.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) DeletePropertyValuesForTarget(callerID string, groupID string, targetType string, targetID string) error {
	return pas.propertyService.DeletePropertyValuesForTarget(groupID, targetType, targetID)
}

// DeletePropertyValuesForField deletes all property values for a specific field.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) DeletePropertyValuesForField(callerID string, groupID, fieldID string) error {
	return pas.propertyService.DeletePropertyValuesForField(groupID, fieldID)
}

// Access Control Helper Methods

// getSourcePluginID extracts the source_plugin_id from a PropertyField's attrs.
// Returns empty string if not set.
func (pas *PropertyAccessService) getSourcePluginID(field *model.PropertyField) string {
	if field.Attrs == nil {
		return ""
	}
	sourcePluginID, _ := field.Attrs[model.CustomProfileAttributesPropertyAttrsSourcePluginID].(string)
	return sourcePluginID
}

// getAccessMode extracts the access_mode from a PropertyField's attrs.
// Returns "public" if not set (default).
func (pas *PropertyAccessService) getAccessMode(field *model.PropertyField) string {
	if field.Attrs == nil {
		return model.CustomProfileAttributesAccessModePublic
	}
	accessMode, ok := field.Attrs[model.CustomProfileAttributesPropertyAttrsAccessMode].(string)
	if !ok || accessMode == "" {
		return model.CustomProfileAttributesAccessModePublic
	}
	return accessMode
}

// isProtectedField checks if a PropertyField is protected from modifications.
// Returns false if not set (default).
func (pas *PropertyAccessService) isProtectedField(field *model.PropertyField) bool {
	if field.Attrs == nil {
		return false
	}
	protected, ok := field.Attrs[model.CustomProfileAttributesPropertyAttrsProtected].(bool)
	return ok && protected
}

// checkUnrestrictedFieldReadAccess checks if the given caller can read a PropertyField without restrictions.
// Returns nil if the caller has unrestricted read access (public field or source plugin for source_only).
// Returns an error if access requires filtering or should be denied entirely.
func (pas *PropertyAccessService) checkUnrestrictedFieldReadAccess(field *model.PropertyField, callerID string) error {
	accessMode := pas.getAccessMode(field)

	// Public fields are readable by everyone without restrictions
	if accessMode == model.CustomProfileAttributesAccessModePublic {
		return nil
	}

	// For source_only mode, only the source plugin has unrestricted access
	if accessMode == model.CustomProfileAttributesAccessModeSourceOnly {
		sourcePluginID := pas.getSourcePluginID(field)
		if sourcePluginID != "" && sourcePluginID == callerID {
			return nil
		}
	}

	// All other cases require filtering or access denial
	return fmt.Errorf("field %s has access_mode=%s and requires filtering", field.ID, accessMode)
}

// checkFieldWriteAccess checks if the given caller can modify a PropertyField.
// Returns nil if modification is allowed, or an error if denied.
func (pas *PropertyAccessService) checkFieldWriteAccess(field *model.PropertyField, callerID string) error {
	// Check if field is protected
	if !pas.isProtectedField(field) {
		return nil
	}

	// Protected fields can only be modified by the source plugin
	sourcePluginID := pas.getSourcePluginID(field)
	if sourcePluginID == "" {
		// Protected field with no source plugin - allow modification
		return nil
	}

	if sourcePluginID != callerID {
		return fmt.Errorf("field %s is protected and can only be modified by source plugin '%s'", field.ID, sourcePluginID)
	}

	return nil
}

// getCallerValuesForField retrieves all property values for the caller on a specific field.
// This is used internally for shared_only filtering.
// Returns an empty slice if callerID is empty or if there are no values.
func (pas *PropertyAccessService) getCallerValuesForField(groupID, fieldID, callerID string) ([]*model.PropertyValue, error) {
	if callerID == "" {
		return []*model.PropertyValue{}, nil
	}

	allValues := []*model.PropertyValue{}
	var cursor model.PropertyValueSearchCursor
	pageSize := 100

	for {
		opts := model.PropertyValueSearchOpts{
			FieldID:   fieldID,
			TargetIDs: []string{callerID},
			PerPage:   pageSize,
		}

		if !cursor.IsEmpty() {
			opts.Cursor = cursor
		}

		values, err := pas.propertyService.SearchPropertyValues(groupID, opts)
		if err != nil {
			return nil, fmt.Errorf("failed to get caller values for field: %w", err)
		}

		allValues = append(allValues, values...)

		// If we got fewer results than the page size, we're done
		if len(values) < pageSize {
			break
		}

		// Update cursor for next page
		lastValue := values[len(values)-1]
		cursor = model.PropertyValueSearchCursor{
			PropertyValueID: lastValue.ID,
			CreateAt:        lastValue.CreateAt,
		}
	}

	return allValues, nil
}

// extractOptionIDsFromValue parses a JSON value and extracts option IDs into a set.
// For select fields: returns a set with one option ID
// For multiselect fields: returns a set with multiple option IDs
// Returns nil if value is empty, or an error if field type is not select/multiselect.
func (pas *PropertyAccessService) extractOptionIDsFromValue(fieldType model.PropertyFieldType, value []byte) (map[string]struct{}, error) {
	if len(value) == 0 {
		return nil, nil
	}

	optionIDs := make(map[string]struct{})

	switch fieldType {
	case model.PropertyFieldTypeSelect:
		var optionID string
		if err := json.Unmarshal(value, &optionID); err != nil {
			return nil, err
		}
		if optionID != "" {
			optionIDs[optionID] = struct{}{}
		}

	case model.PropertyFieldTypeMultiselect:
		var ids []string
		if err := json.Unmarshal(value, &ids); err != nil {
			return nil, err
		}
		for _, id := range ids {
			if id != "" {
				optionIDs[id] = struct{}{}
			}
		}

	default:
		return nil, fmt.Errorf("extractOptionIDsFromValue only supports select and multiselect field types, got: %s", fieldType)
	}

	return optionIDs, nil
}

// copyPropertyField creates a deep copy of a PropertyField, including its Attrs map.
func (pas *PropertyAccessService) copyPropertyField(field *model.PropertyField) *model.PropertyField {
	copied := *field
	copied.Attrs = make(model.StringInterface)
	maps.Copy(copied.Attrs, field.Attrs)
	return &copied
}

// getCallerOptionIDsForField retrieves the caller's values for a field and extracts all option IDs.
// This is used for shared_only filtering to determine which options the caller has.
// Returns an empty set if callerID is empty, if there are no values, or on error.
func (pas *PropertyAccessService) getCallerOptionIDsForField(groupID, fieldID, callerID string, fieldType model.PropertyFieldType) (map[string]struct{}, error) {
	callerValues, err := pas.getCallerValuesForField(groupID, fieldID, callerID)
	if err != nil {
		return make(map[string]struct{}), err
	}

	if len(callerValues) == 0 {
		return make(map[string]struct{}), nil
	}

	// Extract option IDs from caller's values
	callerOptionIDs := make(map[string]struct{})
	for _, val := range callerValues {
		optionIDs, err := pas.extractOptionIDsFromValue(fieldType, val.Value)
		if err == nil && optionIDs != nil {
			for optionID := range optionIDs {
				callerOptionIDs[optionID] = struct{}{}
			}
		}
	}

	return callerOptionIDs, nil
}

// filterSharedOnlyFieldOptions filters a field's options to only include those the caller has values for.
// Returns a new PropertyField with filtered options in the attrs.
// If the caller has no values, returns a field with empty options.
func (pas *PropertyAccessService) filterSharedOnlyFieldOptions(field *model.PropertyField, callerID string) *model.PropertyField {
	// Only applies to select and multiselect fields
	if field.Type != model.PropertyFieldTypeSelect && field.Type != model.PropertyFieldTypeMultiselect {
		return field
	}

	// Get caller's option IDs for this field
	callerOptionIDs, err := pas.getCallerOptionIDsForField(field.GroupID, field.ID, callerID, field.Type)
	if err != nil || len(callerOptionIDs) == 0 {
		// If no values or error, return field with empty options
		filteredField := pas.copyPropertyField(field)
		filteredField.Attrs[model.PropertyFieldAttributeOptions] = []any{}
		return filteredField
	}

	// Get current options from field attrs
	optionsArr, ok := field.Attrs[model.PropertyFieldAttributeOptions]
	if !ok {
		return field
	}

	// Convert to slice of maps (generic option representation)
	optionsSlice, ok := optionsArr.([]any)
	if !ok {
		return field
	}

	// Filter options
	filteredOptions := []any{}
	for _, opt := range optionsSlice {
		optMap, ok := opt.(map[string]any)
		if !ok {
			continue
		}
		optID, ok := optMap["id"].(string)
		if !ok {
			continue
		}
		if _, exists := callerOptionIDs[optID]; exists {
			filteredOptions = append(filteredOptions, opt)
		}
	}

	// Create a new field with filtered options
	filteredField := pas.copyPropertyField(field)
	filteredField.Attrs[model.PropertyFieldAttributeOptions] = filteredOptions
	return filteredField
}

// filterSharedOnlyValue computes the intersection of caller and target values for shared_only fields.
// Returns the filtered value or nil if there's no intersection.
// For single-select: returns value only if both have the same value.
// For multi-select: returns the intersection of arrays.
func (pas *PropertyAccessService) filterSharedOnlyValue(field *model.PropertyField, value *model.PropertyValue, callerID string) *model.PropertyValue {
	// Only applies to select and multiselect fields
	if field.Type != model.PropertyFieldTypeSelect && field.Type != model.PropertyFieldTypeMultiselect {
		return value
	}

	// Get caller's option IDs for this field
	callerOptionIDs, err := pas.getCallerOptionIDsForField(field.GroupID, field.ID, callerID, field.Type)
	if err != nil || len(callerOptionIDs) == 0 {
		// No intersection possible
		return nil
	}

	// Extract option IDs from target value
	targetOptionIDs, err := pas.extractOptionIDsFromValue(field.Type, value.Value)
	if err != nil || targetOptionIDs == nil || len(targetOptionIDs) == 0 {
		return nil
	}

	// Find intersection
	intersection := []string{}
	for targetID := range targetOptionIDs {
		if _, exists := callerOptionIDs[targetID]; exists {
			intersection = append(intersection, targetID)
		}
	}

	// If no intersection, return nil
	if len(intersection) == 0 {
		return nil
	}

	// Create filtered value based on field type
	filteredValue := *value

	switch field.Type {
	case model.PropertyFieldTypeSelect:
		// For single-select, return the single matching value
		jsonValue, err := json.Marshal(intersection[0])
		if err != nil {
			return nil
		}
		filteredValue.Value = jsonValue
		return &filteredValue

	case model.PropertyFieldTypeMultiselect:
		// For multi-select, return the array of matching values
		jsonValue, err := json.Marshal(intersection)
		if err != nil {
			return nil
		}
		filteredValue.Value = jsonValue
		return &filteredValue

	default:
		// Should never reach here due to check at function start
		return nil
	}
}

// applyFieldReadAccessControl applies read access control to a single field.
// Returns the field with options filtered based on the caller's access permissions.
// - Public fields: returned as-is
// - Source-only fields: returned with empty options if caller is not the source plugin
// - Shared-only fields: returned with options filtered using filterSharedOnlyFieldOptions
// - Unknown access modes: treated as source-only (secure default)
func (pas *PropertyAccessService) applyFieldReadAccessControl(field *model.PropertyField, callerID string) *model.PropertyField {
	// Check if caller has unrestricted access (public field or source plugin for source_only)
	if err := pas.checkUnrestrictedFieldReadAccess(field, callerID); err == nil {
		// Unrestricted access - return as-is
		return field
	}

	// Access requires filtering
	accessMode := pas.getAccessMode(field)

	// Shared-only fields: use existing helper to filter options
	if accessMode == model.CustomProfileAttributesAccessModeSharedOnly {
		return pas.filterSharedOnlyFieldOptions(field, callerID)
	}

	// Source-only or unknown: return with empty options (secure default)
	filteredField := pas.copyPropertyField(field)
	if field.Type == model.PropertyFieldTypeSelect || field.Type == model.PropertyFieldTypeMultiselect {
		filteredField.Attrs[model.PropertyFieldAttributeOptions] = []any{}
	}
	return filteredField
}

// applyFieldReadAccessControlToList applies read access control to a list of fields.
// Returns a new list with each field's options filtered based on the caller's access permissions.
func (pas *PropertyAccessService) applyFieldReadAccessControlToList(fields []*model.PropertyField, callerID string) []*model.PropertyField {
	if len(fields) == 0 {
		return fields
	}

	filtered := make([]*model.PropertyField, 0, len(fields))
	for _, field := range fields {
		filtered = append(filtered, pas.applyFieldReadAccessControl(field, callerID))
	}

	return filtered
}
