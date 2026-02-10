// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

// This file implements access control for property fields and values using three key mechanisms:
//
// 1. Protected Fields (protected attribute):
//    - Protected fields can only be modified by their source plugin (identified by source_plugin_id)
//    - Non-protected fields can be modified by any caller with appropriate access
//
// 2. Access Mode (access_mode attribute):
//    - Controls read access to field metadata (like options) and values
//    - Three modes:
//      * Public (empty string, default): Everyone can read all data
//      * Source-only: Only the source plugin can read full field options and values; others see empty options and no values
//      * Shared-only: Callers can only see field options and values they share with the target
//                     (Example: If Alice selected Apples and Bananas, and Bob selected Bananas and Oranges,
//                      then Alice querying Bob's values would only see Bananas)

import (
	"encoding/json"
	"fmt"
	"maps"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app/properties"
)

const (
	// propertyAccessPaginationPageSize is the default page size for pagination when fetching property values
	propertyAccessPaginationPageSize = 100
	// propertyAccessMaxPaginationIterations is the maximum number of pagination iterations before returning an error
	propertyAccessMaxPaginationIterations = 10
	// anonymousCallerId can be used for calls to the service that aren't tied to a specific entity
	// These calls will not be able to access any data that has access control restrictions.
	anonymousCallerId = ""
)

// PluginChecker is a function type that checks if a plugin is installed.
// Returns true if the plugin exists and is installed, false otherwise.
type PluginChecker func(pluginID string) bool

// PropertyAccessService is a decorator around PropertyService that enforces
// access control based on caller identity. All property operations go through
// this service to ensure consistent access control enforcement.
type PropertyAccessService struct {
	propertyService *properties.PropertyService
	pluginChecker   PluginChecker
}

// NewPropertyAccessService creates a new PropertyAccessService wrapping the given PropertyService.
// The pluginChecker function is used to verify plugin installation status when checking access
// to protected fields. Pass nil if plugin checking is not needed (e.g., in tests).
func NewPropertyAccessService(ps *properties.PropertyService, pluginChecker PluginChecker) *PropertyAccessService {
	return &PropertyAccessService{
		propertyService: ps,
		pluginChecker:   pluginChecker,
	}
}

func (pas *PropertyAccessService) setPluginCheckerForTests(pluginChecker PluginChecker) {
	pas.pluginChecker = pluginChecker
}

// Property Group Methods

// RegisterPropertyGroup registers a new property group.
func (pas *PropertyAccessService) RegisterPropertyGroup(name string) (*model.PropertyGroup, error) {
	return pas.propertyService.RegisterPropertyGroup(name)
}

// GetPropertyGroup retrieves a property group by name.
func (pas *PropertyAccessService) GetPropertyGroup(name string) (*model.PropertyGroup, error) {
	return pas.propertyService.GetPropertyGroup(name)
}

// Property Field Methods

// CreatePropertyField creates a new property field.
// This method rejects any attempt to set source_plugin_id - only plugins can set this via CreatePropertyFieldForPlugin.
func (pas *PropertyAccessService) CreatePropertyField(callerID string, field *model.PropertyField) (*model.PropertyField, error) {
	if hasRestrictions, err := pas.groupHasAccessRestrictions(field.GroupID); err != nil {
		return nil, fmt.Errorf("CreatePropertyField: cannot determine access restrictions: %w", err)
	} else if !hasRestrictions {
		return pas.propertyService.CreatePropertyField(field)
	}

	// Reject if source_plugin_id is set to a non-empty value - only plugins can set this via CreatePropertyFieldForPlugin
	if pas.getSourcePluginID(field) != "" {
		return nil, fmt.Errorf("CreatePropertyField: source_plugin_id cannot be set directly, it is only set automatically for plugin-created fields")
	}

	// Reject if protected is set - only plugins can set this via CreatePropertyFieldForPlugin
	if model.IsPropertyFieldProtected(field) {
		return nil, fmt.Errorf("CreatePropertyField: protected can only be set by plugins")
	}

	// Validate access mode
	if err := model.ValidatePropertyFieldAccessMode(field); err != nil {
		return nil, fmt.Errorf("CreatePropertyField: %w", err)
	}

	result, err := pas.propertyService.CreatePropertyField(field)
	if err != nil {
		return nil, fmt.Errorf("CreatePropertyField: %w", err)
	}
	return result, nil
}

// CreatePropertyFieldForPlugin creates a new property field on behalf of a plugin.
// This method automatically sets the source_plugin_id to the provided pluginID.
// Only use this method when creating fields through the Plugin API.
func (pas *PropertyAccessService) CreatePropertyFieldForPlugin(pluginID string, field *model.PropertyField) (*model.PropertyField, error) {
	if hasRestrictions, err := pas.groupHasAccessRestrictions(field.GroupID); err != nil {
		return nil, fmt.Errorf("CreatePropertyFieldForPlugin: cannot determine access restrictions: %w", err)
	} else if !hasRestrictions {
		return pas.propertyService.CreatePropertyField(field)
	}

	if pluginID == "" {
		return nil, fmt.Errorf("CreatePropertyFieldForPlugin: pluginID is required")
	}

	// Initialize attrs if needed
	if field.Attrs == nil {
		field.Attrs = make(model.StringInterface)
	}

	// Automatically set source_plugin_id
	field.Attrs[model.PropertyAttrsSourcePluginID] = pluginID

	// Validate access mode
	if err := model.ValidatePropertyFieldAccessMode(field); err != nil {
		return nil, fmt.Errorf("CreatePropertyFieldForPlugin: %w", err)
	}

	result, err := pas.propertyService.CreatePropertyField(field)
	if err != nil {
		return nil, fmt.Errorf("CreatePropertyFieldForPlugin: %w", err)
	}
	return result, nil
}

// GetPropertyField retrieves a property field by group and field ID.
// Field details are filtered based on the caller's access permissions.
func (pas *PropertyAccessService) GetPropertyField(callerID string, groupID, id string) (*model.PropertyField, error) {
	if hasRestrictions, err := pas.groupHasAccessRestrictions(groupID); err != nil {
		return nil, fmt.Errorf("GetPropertyField: cannot determine access restrictions: %w", err)
	} else if !hasRestrictions {
		return pas.propertyService.GetPropertyField(groupID, id)
	}

	field, err := pas.propertyService.GetPropertyField(groupID, id)
	if err != nil {
		return nil, fmt.Errorf("GetPropertyField: %w", err)
	}

	return pas.applyFieldReadAccessControl(field, callerID), nil
}

// GetPropertyFields retrieves multiple property fields by their IDs.
// Field details are filtered based on the caller's access permissions.
func (pas *PropertyAccessService) GetPropertyFields(callerID string, groupID string, ids []string) ([]*model.PropertyField, error) {
	if hasRestrictions, err := pas.groupHasAccessRestrictions(groupID); err != nil {
		return nil, fmt.Errorf("GetPropertyFields: cannot determine access restrictions: %w", err)
	} else if !hasRestrictions {
		return pas.propertyService.GetPropertyFields(groupID, ids)
	}

	fields, err := pas.propertyService.GetPropertyFields(groupID, ids)
	if err != nil {
		return nil, fmt.Errorf("GetPropertyFields: %w", err)
	}

	return pas.applyFieldReadAccessControlToList(fields, callerID), nil
}

// GetPropertyFieldByName retrieves a property field by name.
// Field details are filtered based on the caller's access permissions.
func (pas *PropertyAccessService) GetPropertyFieldByName(callerID string, groupID, targetID, name string) (*model.PropertyField, error) {
	if hasRestrictions, err := pas.groupHasAccessRestrictions(groupID); err != nil {
		return nil, fmt.Errorf("GetPropertyFieldByName: cannot determine access restrictions: %w", err)
	} else if !hasRestrictions {
		return pas.propertyService.GetPropertyFieldByName(groupID, targetID, name)
	}

	field, err := pas.propertyService.GetPropertyFieldByName(groupID, targetID, name)
	if err != nil {
		return nil, fmt.Errorf("GetPropertyFieldByName: %w", err)
	}

	return pas.applyFieldReadAccessControl(field, callerID), nil
}

// CountActivePropertyFieldsForGroup counts active property fields for a group.
func (pas *PropertyAccessService) CountActivePropertyFieldsForGroup(groupID string) (int64, error) {
	return pas.propertyService.CountActivePropertyFieldsForGroup(groupID)
}

// CountAllPropertyFieldsForGroup counts all property fields (including deleted) for a group.
func (pas *PropertyAccessService) CountAllPropertyFieldsForGroup(groupID string) (int64, error) {
	return pas.propertyService.CountAllPropertyFieldsForGroup(groupID)
}

// CountActivePropertyFieldsForTarget counts active property fields for a specific target.
func (pas *PropertyAccessService) CountActivePropertyFieldsForTarget(groupID, targetType, targetID string) (int64, error) {
	return pas.propertyService.CountActivePropertyFieldsForTarget(groupID, targetType, targetID)
}

// CountAllPropertyFieldsForTarget counts all property fields (including deleted) for a specific target.
func (pas *PropertyAccessService) CountAllPropertyFieldsForTarget(groupID, targetType, targetID string) (int64, error) {
	return pas.propertyService.CountAllPropertyFieldsForTarget(groupID, targetType, targetID)
}

// SearchPropertyFields searches for property fields based on the given options.
// Field details are filtered based on the caller's access permissions.
func (pas *PropertyAccessService) SearchPropertyFields(callerID string, groupID string, opts model.PropertyFieldSearchOpts) ([]*model.PropertyField, error) {
	if hasRestrictions, err := pas.groupHasAccessRestrictions(groupID); err != nil {
		return nil, fmt.Errorf("SearchPropertyFields: cannot determine access restrictions: %w", err)
	} else if !hasRestrictions {
		return pas.propertyService.SearchPropertyFields(groupID, opts)
	}

	fields, err := pas.propertyService.SearchPropertyFields(groupID, opts)
	if err != nil {
		return nil, fmt.Errorf("SearchPropertyFields: %w", err)
	}

	return pas.applyFieldReadAccessControlToList(fields, callerID), nil
}

// UpdatePropertyField updates a property field.
// Checks write access and ensures source_plugin_id is not changed.
func (pas *PropertyAccessService) UpdatePropertyField(callerID string, groupID string, field *model.PropertyField) (*model.PropertyField, error) {
	if hasRestrictions, err := pas.groupHasAccessRestrictions(groupID); err != nil {
		return nil, fmt.Errorf("UpdatePropertyField: cannot determine access restrictions: %w", err)
	} else if !hasRestrictions {
		return pas.propertyService.UpdatePropertyField(groupID, field)
	}

	// Get existing field to check access
	existingField, existsErr := pas.propertyService.GetPropertyField(groupID, field.ID)
	if existsErr != nil {
		return nil, fmt.Errorf("UpdatePropertyField: %w", existsErr)
	}

	// Check write access
	if err := pas.checkFieldWriteAccess(existingField, callerID); err != nil {
		return nil, fmt.Errorf("UpdatePropertyField: %w", err)
	}

	// Ensure source_plugin_id hasn't changed
	if err := pas.ensureSourcePluginIDUnchanged(existingField, field); err != nil {
		return nil, fmt.Errorf("UpdatePropertyField: %w", err)
	}

	// Validate access mode
	if err := model.ValidatePropertyFieldAccessMode(field); err != nil {
		return nil, fmt.Errorf("UpdatePropertyField: %w", err)
	}

	result, err := pas.propertyService.UpdatePropertyField(groupID, field)
	if err != nil {
		return nil, fmt.Errorf("UpdatePropertyField: %w", err)
	}
	return result, nil
}

// UpdatePropertyFields updates multiple property fields.
// Checks write access for all fields atomically before updating any.
func (pas *PropertyAccessService) UpdatePropertyFields(callerID string, groupID string, fields []*model.PropertyField) ([]*model.PropertyField, error) {
	if hasRestrictions, err := pas.groupHasAccessRestrictions(groupID); err != nil {
		return nil, fmt.Errorf("UpdatePropertyFields: cannot determine access restrictions: %w", err)
	} else if !hasRestrictions {
		return pas.propertyService.UpdatePropertyFields(groupID, fields)
	}

	if len(fields) == 0 {
		return fields, nil
	}

	// Get field IDs
	fieldIDs := make([]string, len(fields))
	for i, field := range fields {
		fieldIDs[i] = field.ID
	}

	// Fetch existing fields
	existingFields, existsErr := pas.propertyService.GetPropertyFields(groupID, fieldIDs)
	if existsErr != nil {
		return nil, fmt.Errorf("UpdatePropertyFields: %w", existsErr)
	}

	// Build map for easy lookup
	existingFieldMap := make(map[string]*model.PropertyField, len(existingFields))
	for _, field := range existingFields {
		existingFieldMap[field.ID] = field
	}

	// Check write access for all fields before updating any
	for _, field := range fields {
		existingField, exists := existingFieldMap[field.ID]
		if !exists {
			return nil, fmt.Errorf("field %s not found", field.ID)
		}

		// Check write access
		if err := pas.checkFieldWriteAccess(existingField, callerID); err != nil {
			return nil, fmt.Errorf("UpdatePropertyFields: field %s: %w", field.ID, err)
		}

		// Ensure source_plugin_id hasn't changed
		if err := pas.ensureSourcePluginIDUnchanged(existingField, field); err != nil {
			return nil, fmt.Errorf("UpdatePropertyFields: field %s: %w", field.ID, err)
		}

		// Validate access mode
		if err := model.ValidatePropertyFieldAccessMode(field); err != nil {
			return nil, fmt.Errorf("UpdatePropertyFields: field %s: %w", field.ID, err)
		}
	}

	// All checks passed - proceed with update
	result, err := pas.propertyService.UpdatePropertyFields(groupID, fields)
	if err != nil {
		return nil, fmt.Errorf("UpdatePropertyFields: %w", err)
	}
	return result, nil
}

// DeletePropertyField deletes a property field and all its values.
// Checks delete access before allowing deletion.
func (pas *PropertyAccessService) DeletePropertyField(callerID string, groupID, id string) error {
	if hasRestrictions, err := pas.groupHasAccessRestrictions(groupID); err != nil {
		return fmt.Errorf("DeletePropertyField: cannot determine access restrictions: %w", err)
	} else if !hasRestrictions {
		return pas.propertyService.DeletePropertyField(groupID, id)
	}

	// Get existing field to check access
	existingField, err := pas.propertyService.GetPropertyField(groupID, id)
	if err != nil {
		return fmt.Errorf("DeletePropertyField: %w", err)
	}

	// Check delete access
	if err := pas.checkFieldDeleteAccess(existingField, callerID); err != nil {
		return fmt.Errorf("DeletePropertyField: %w", err)
	}

	if err := pas.propertyService.DeletePropertyField(groupID, id); err != nil {
		return fmt.Errorf("DeletePropertyField: %w", err)
	}
	return nil
}

// Property Value Methods

// CreatePropertyValue creates a new property value.
// Checks write access before allowing the creation.
func (pas *PropertyAccessService) CreatePropertyValue(callerID string, value *model.PropertyValue) (*model.PropertyValue, error) {
	if hasRestrictions, err := pas.groupHasAccessRestrictions(value.GroupID); err != nil {
		return nil, fmt.Errorf("CreatePropertyValue: cannot determine access restrictions: %w", err)
	} else if !hasRestrictions {
		return pas.propertyService.CreatePropertyValue(value)
	}

	// Get the associated field to check access
	field, err := pas.propertyService.GetPropertyField(value.GroupID, value.FieldID)
	if err != nil {
		return nil, fmt.Errorf("CreatePropertyValue: %w", err)
	}

	// Check write access
	if err = pas.checkFieldWriteAccess(field, callerID); err != nil {
		return nil, fmt.Errorf("CreatePropertyValue: %w", err)
	}

	result, err := pas.propertyService.CreatePropertyValue(value)
	if err != nil {
		return nil, fmt.Errorf("CreatePropertyValue: %w", err)
	}
	return result, nil
}

// CreatePropertyValues creates multiple property values.
// Checks write access for all fields atomically before creating any values.
func (pas *PropertyAccessService) CreatePropertyValues(callerID string, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	shouldApplyAccessControl := false
	for _, value := range values {
		if hasRestrictions, err := pas.groupHasAccessRestrictions(value.GroupID); err != nil {
			return nil, fmt.Errorf("CreatePropertyValues: cannot determine access restrictions: %w", err)
		} else if hasRestrictions {
			shouldApplyAccessControl = true
			break
		}
	}
	if !shouldApplyAccessControl {
		return pas.propertyService.CreatePropertyValues(values)
	}

	fieldMap, err := pas.getFieldsForValues(values)
	if err != nil {
		return nil, fmt.Errorf("CreatePropertyValues: %w", err)
	}

	// Check write access for all fields before creating any values
	for _, value := range values {
		field, exists := fieldMap[value.FieldID]
		if !exists {
			return nil, fmt.Errorf("CreatePropertyValues: field %s not found", value.FieldID)
		}

		if err = pas.checkFieldWriteAccess(field, callerID); err != nil {
			return nil, fmt.Errorf("CreatePropertyValues: field %s: %w", value.FieldID, err)
		}
	}

	// All checks passed - proceed with creation
	result, err := pas.propertyService.CreatePropertyValues(values)
	if err != nil {
		return nil, fmt.Errorf("CreatePropertyValues: %w", err)
	}
	return result, nil
}

// GetPropertyValue retrieves a property value by ID.
// Returns (nil, nil) if the value exists but the caller doesn't have access.
func (pas *PropertyAccessService) GetPropertyValue(callerID string, groupID, id string) (*model.PropertyValue, error) {
	if hasRestrictions, err := pas.groupHasAccessRestrictions(groupID); err != nil {
		return nil, fmt.Errorf("GetPropertyValue: cannot determine access restrictions: %w", err)
	} else if !hasRestrictions {
		return pas.propertyService.GetPropertyValue(groupID, id)
	}

	value, err := pas.propertyService.GetPropertyValue(groupID, id)
	if err != nil {
		return nil, fmt.Errorf("GetPropertyValue: %w", err)
	}

	// Apply access control filtering
	filtered, err := pas.applyValueReadAccessControl([]*model.PropertyValue{value}, callerID)
	if err != nil {
		return nil, fmt.Errorf("GetPropertyValue: %w", err)
	}

	// If the value was filtered out, return nil
	if len(filtered) == 0 {
		return nil, nil
	}

	return filtered[0], nil
}

// GetPropertyValues retrieves multiple property values by their IDs.
// Values the caller doesn't have access to are silently filtered out.
func (pas *PropertyAccessService) GetPropertyValues(callerID string, groupID string, ids []string) ([]*model.PropertyValue, error) {
	if hasRestrictions, err := pas.groupHasAccessRestrictions(groupID); err != nil {
		return nil, fmt.Errorf("GetPropertyValues: cannot determine access restrictions: %w", err)
	} else if !hasRestrictions {
		return pas.propertyService.GetPropertyValues(groupID, ids)
	}

	values, err := pas.propertyService.GetPropertyValues(groupID, ids)
	if err != nil {
		return nil, fmt.Errorf("GetPropertyValues: %w", err)
	}

	// Apply access control filtering
	filtered, err := pas.applyValueReadAccessControl(values, callerID)
	if err != nil {
		return nil, fmt.Errorf("GetPropertyValues: %w", err)
	}
	return filtered, nil
}

// SearchPropertyValues searches for property values based on the given options.
// Values the caller doesn't have access to are silently filtered out.
func (pas *PropertyAccessService) SearchPropertyValues(callerID string, groupID string, opts model.PropertyValueSearchOpts) ([]*model.PropertyValue, error) {
	if hasRestrictions, err := pas.groupHasAccessRestrictions(groupID); err != nil {
		return nil, fmt.Errorf("SearchPropertyValues: cannot determine access restrictions: %w", err)
	} else if !hasRestrictions {
		return pas.propertyService.SearchPropertyValues(groupID, opts)
	}

	values, err := pas.propertyService.SearchPropertyValues(groupID, opts)
	if err != nil {
		return nil, fmt.Errorf("SearchPropertyValues: %w", err)
	}

	// Apply access control filtering
	filtered, err := pas.applyValueReadAccessControl(values, callerID)
	if err != nil {
		return nil, fmt.Errorf("SearchPropertyValues: %w", err)
	}
	return filtered, nil
}

// UpdatePropertyValue updates a property value.
// Checks write access before allowing the update.
func (pas *PropertyAccessService) UpdatePropertyValue(callerID string, groupID string, value *model.PropertyValue) (*model.PropertyValue, error) {
	if hasRestrictions, err := pas.groupHasAccessRestrictions(groupID); err != nil {
		return nil, fmt.Errorf("UpdatePropertyValue: cannot determine access restrictions: %w", err)
	} else if !hasRestrictions {
		return pas.propertyService.UpdatePropertyValue(groupID, value)
	}

	// Get the associated field to check access
	field, err := pas.propertyService.GetPropertyField(groupID, value.FieldID)
	if err != nil {
		return nil, fmt.Errorf("UpdatePropertyValue: %w", err)
	}

	// Check write access
	if err = pas.checkFieldWriteAccess(field, callerID); err != nil {
		return nil, fmt.Errorf("UpdatePropertyValue: %w", err)
	}

	result, err := pas.propertyService.UpdatePropertyValue(groupID, value)
	if err != nil {
		return nil, fmt.Errorf("UpdatePropertyValue: %w", err)
	}
	return result, nil
}

// UpdatePropertyValues updates multiple property values.
// Checks write access for all fields atomically before updating any values.
func (pas *PropertyAccessService) UpdatePropertyValues(callerID string, groupID string, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	shouldApplyAccessControl := false
	for _, value := range values {
		if hasRestrictions, err := pas.groupHasAccessRestrictions(value.GroupID); err != nil {
			return nil, fmt.Errorf("UpdatePropertyValues: cannot determine access restrictions: %w", err)
		} else if hasRestrictions {
			shouldApplyAccessControl = true
			break
		}
	}
	if !shouldApplyAccessControl {
		return pas.propertyService.UpdatePropertyValues(groupID, values)
	}

	if len(values) == 0 {
		return values, nil
	}

	fieldMap, err := pas.getFieldsForValues(values)
	if err != nil {
		return nil, fmt.Errorf("UpdatePropertyValues: %w", err)
	}

	// Check write access for all fields before updating any values
	for _, value := range values {
		field, exists := fieldMap[value.FieldID]
		if !exists {
			return nil, fmt.Errorf("UpdatePropertyValues: field %s not found", value.FieldID)
		}

		if err = pas.checkFieldWriteAccess(field, callerID); err != nil {
			return nil, fmt.Errorf("UpdatePropertyValues: field %s: %w", value.FieldID, err)
		}
	}

	// All checks passed - proceed with update
	result, err := pas.propertyService.UpdatePropertyValues(groupID, values)
	if err != nil {
		return nil, fmt.Errorf("UpdatePropertyValues: %w", err)
	}
	return result, nil
}

// UpsertPropertyValue creates or updates a property value.
// Checks write access before allowing the upsert.
func (pas *PropertyAccessService) UpsertPropertyValue(callerID string, value *model.PropertyValue) (*model.PropertyValue, error) {
	if hasRestrictions, err := pas.groupHasAccessRestrictions(value.GroupID); err != nil {
		return nil, fmt.Errorf("UpsertPropertyValue cannot determine access restrictions: %w", err)
	} else if !hasRestrictions {
		return pas.propertyService.UpsertPropertyValue(value)
	}

	// Get the associated field to check access
	field, err := pas.propertyService.GetPropertyField(value.GroupID, value.FieldID)
	if err != nil {
		return nil, fmt.Errorf("UpsertPropertyValue: %w", err)
	}

	// Check write access (works for both create and update)
	if err = pas.checkFieldWriteAccess(field, callerID); err != nil {
		return nil, fmt.Errorf("UpsertPropertyValue: %w", err)
	}

	result, err := pas.propertyService.UpsertPropertyValue(value)
	if err != nil {
		return nil, fmt.Errorf("UpsertPropertyValue: %w", err)
	}
	return result, nil
}

// UpsertPropertyValues creates or updates multiple property values.
// Checks write access for all fields atomically before upserting any values.
func (pas *PropertyAccessService) UpsertPropertyValues(callerID string, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	shouldApplyAccessControl := false
	for _, value := range values {
		if hasRestrictions, err := pas.groupHasAccessRestrictions(value.GroupID); err != nil {
			return nil, fmt.Errorf("UpsertPropertyValues: cannot determine access restrictions: %w", err)
		} else if hasRestrictions {
			shouldApplyAccessControl = true
			break
		}
	}
	if !shouldApplyAccessControl {
		return pas.propertyService.UpsertPropertyValues(values)
	}

	if len(values) == 0 {
		return values, nil
	}

	fieldMap, err := pas.getFieldsForValues(values)
	if err != nil {
		return nil, fmt.Errorf("UpsertPropertyValues: %w", err)
	}

	// Check write access for all fields before upserting any values
	for _, value := range values {
		field, exists := fieldMap[value.FieldID]
		if !exists {
			return nil, fmt.Errorf("UpsertPropertyValues: field %s not found", value.FieldID)
		}

		if err = pas.checkFieldWriteAccess(field, callerID); err != nil {
			return nil, fmt.Errorf("UpsertPropertyValues: field %s: %w", value.FieldID, err)
		}
	}

	// All checks passed - proceed with upsert
	result, err := pas.propertyService.UpsertPropertyValues(values)
	if err != nil {
		return nil, fmt.Errorf("UpsertPropertyValues: %w", err)
	}
	return result, nil
}

// DeletePropertyValue deletes a property value.
// Checks write access before allowing deletion.
func (pas *PropertyAccessService) DeletePropertyValue(callerID string, groupID, id string) error {
	if hasRestrictions, err := pas.groupHasAccessRestrictions(groupID); err != nil {
		return fmt.Errorf("DeletePropertyValue: cannot determine access restrictions: %w", err)
	} else if !hasRestrictions {
		return pas.propertyService.DeletePropertyValue(groupID, id)
	}

	// Get the value to find its field ID
	value, err := pas.propertyService.GetPropertyValue(groupID, id)
	if err != nil {
		// Value doesn't exist - return nil to match original behavior
		return nil
	}

	// Get the associated field to check access
	field, err := pas.propertyService.GetPropertyField(groupID, value.FieldID)
	if err != nil {
		return fmt.Errorf("DeletePropertyValue: %w", err)
	}

	// Check write access
	if err := pas.checkFieldWriteAccess(field, callerID); err != nil {
		return fmt.Errorf("DeletePropertyValue: %w", err)
	}

	if err := pas.propertyService.DeletePropertyValue(groupID, id); err != nil {
		return fmt.Errorf("DeletePropertyValue: %w", err)
	}
	return nil
}

// DeletePropertyValuesForTarget deletes all property values for a specific target.
// Checks write access for all affected fields atomically before deleting.
func (pas *PropertyAccessService) DeletePropertyValuesForTarget(callerID string, groupID string, targetType string, targetID string) error {
	if hasRestrictions, err := pas.groupHasAccessRestrictions(groupID); err != nil {
		return fmt.Errorf("DeletePropertyValuesForTarget: cannot determine access restrictions: %w", err)
	} else if !hasRestrictions {
		return pas.propertyService.DeletePropertyValuesForTarget(groupID, targetType, targetID)
	}

	// Collect unique field IDs across all values without loading all values into memory
	fieldIDs := make(map[string]struct{})
	var cursor model.PropertyValueSearchCursor
	iterations := 0

	for {
		iterations++
		if iterations > propertyAccessMaxPaginationIterations {
			return fmt.Errorf("DeletePropertyValuesForTarget: exceeded maximum pagination iterations (%d)", propertyAccessMaxPaginationIterations)
		}

		opts := model.PropertyValueSearchOpts{
			TargetType: targetType,
			TargetIDs:  []string{targetID},
			PerPage:    propertyAccessPaginationPageSize,
		}

		if !cursor.IsEmpty() {
			opts.Cursor = cursor
		}

		values, err := pas.propertyService.SearchPropertyValues(groupID, opts)
		if err != nil {
			return fmt.Errorf("DeletePropertyValuesForTarget: %w", err)
		}

		// Extract field IDs from this batch
		for _, value := range values {
			fieldIDs[value.FieldID] = struct{}{}
		}

		// If we got fewer results than the page size, we're done
		if len(values) < propertyAccessPaginationPageSize {
			break
		}

		// Update cursor for next page
		lastValue := values[len(values)-1]
		cursor = model.PropertyValueSearchCursor{
			PropertyValueID: lastValue.ID,
			CreateAt:        lastValue.CreateAt,
		}
	}

	if len(fieldIDs) == 0 {
		// No values to delete - return nil to match original behavior
		return nil
	}

	// Convert map to slice
	fieldIDSlice := make([]string, 0, len(fieldIDs))
	for fieldID := range fieldIDs {
		fieldIDSlice = append(fieldIDSlice, fieldID)
	}

	// Fetch all fields
	fields, err := pas.propertyService.GetPropertyFields(groupID, fieldIDSlice)
	if err != nil {
		return fmt.Errorf("DeletePropertyValuesForTarget: %w", err)
	}

	// Check write access for all fields before deleting any values
	for _, field := range fields {
		if err := pas.checkFieldWriteAccess(field, callerID); err != nil {
			return fmt.Errorf("DeletePropertyValuesForTarget: field %s: %w", field.ID, err)
		}
	}

	// All checks passed - proceed with deletion
	if err := pas.propertyService.DeletePropertyValuesForTarget(groupID, targetType, targetID); err != nil {
		return fmt.Errorf("DeletePropertyValuesForTarget: %w", err)
	}
	return nil
}

// DeletePropertyValuesForField deletes all property values for a specific field.
// Checks write access before allowing deletion.
func (pas *PropertyAccessService) DeletePropertyValuesForField(callerID string, groupID, fieldID string) error {
	if hasRestrictions, err := pas.groupHasAccessRestrictions(groupID); err != nil {
		return fmt.Errorf("DeletePropertyValuesForField: cannot determine access restrictions: %w", err)
	} else if !hasRestrictions {
		return pas.propertyService.DeletePropertyValuesForField(groupID, fieldID)
	}

	// Get the field to check access
	field, err := pas.propertyService.GetPropertyField(groupID, fieldID)
	if err != nil {
		// Field doesn't exist - return nil to match original behavior
		return nil
	}

	// Check write access
	if err := pas.checkFieldWriteAccess(field, callerID); err != nil {
		return fmt.Errorf("DeletePropertyValuesForField: %w", err)
	}

	if err := pas.propertyService.DeletePropertyValuesForField(groupID, fieldID); err != nil {
		return fmt.Errorf("DeletePropertyValuesForField: %w", err)
	}
	return nil
}

// Access Control Helper Methods

// getSourcePluginID extracts the source_plugin_id from a PropertyField's attrs.
// Returns empty string if not set.
func (pas *PropertyAccessService) getSourcePluginID(field *model.PropertyField) string {
	if field.Attrs == nil {
		return ""
	}
	sourcePluginID, _ := field.Attrs[model.PropertyAttrsSourcePluginID].(string)
	return sourcePluginID
}

// getAccessMode extracts the access_mode from a PropertyField's attrs.
// Returns empty string (public access mode) if not set (default).
func (pas *PropertyAccessService) getAccessMode(field *model.PropertyField) string {
	if field.Attrs == nil {
		return model.PropertyAccessModePublic
	}
	accessMode, ok := field.Attrs[model.PropertyAttrsAccessMode].(string)
	if !ok {
		return model.PropertyAccessModePublic
	}
	return accessMode
}

// checkUnrestrictedFieldReadAccess checks if the given caller can read a PropertyField without restrictions.
// Returns true if the caller has unrestricted read access (public field or source plugin).
// Returns an error if access requires filtering or should be denied entirely.
func (pas *PropertyAccessService) hasUnrestrictedFieldReadAccess(field *model.PropertyField, callerID string) bool {
	accessMode := pas.getAccessMode(field)

	// Public fields are readable by everyone without restrictions
	if accessMode == model.PropertyAccessModePublic {
		return true
	}

	// Source plugin always has unrestricted access to fields they created
	sourcePluginID := pas.getSourcePluginID(field)
	if sourcePluginID != "" && sourcePluginID == callerID {
		return true
	}

	// All other cases require filtering or access denial
	return false
}

// ensureSourcePluginIDUnchanged checks that the source_plugin_id attribute hasn't changed between fields.
// Used during field updates to ensure source_plugin_id is immutable.
// Returns nil if unchanged, or an error if source_plugin_id was modified.
func (pas *PropertyAccessService) ensureSourcePluginIDUnchanged(existingField, updatedField *model.PropertyField) error {
	existingSourcePluginID := pas.getSourcePluginID(existingField)
	updatedSourcePluginID := pas.getSourcePluginID(updatedField)

	if existingSourcePluginID != updatedSourcePluginID {
		return fmt.Errorf("source_plugin_id is immutable and cannot be changed from '%s' to '%s'", existingSourcePluginID, updatedSourcePluginID)
	}

	return nil
}

// checkFieldWriteAccess checks if the given caller can modify a PropertyField.
// IMPORTANT: Always pass the existing field fetched from the database, not a field provided by the caller.
// Returns nil if modification is allowed, or an error if denied.
func (pas *PropertyAccessService) checkFieldWriteAccess(field *model.PropertyField, callerID string) error {
	// Check if field is protected
	if !model.IsPropertyFieldProtected(field) {
		return nil
	}

	// Protected fields can only be modified by the source plugin
	sourcePluginID := pas.getSourcePluginID(field)
	if sourcePluginID == "" {
		return fmt.Errorf("field %s is protected, but has no associated source plugin", field.ID)
	}

	if sourcePluginID != callerID {
		return fmt.Errorf("field %s is protected and can only be modified by source plugin '%s'", field.ID, sourcePluginID)
	}

	return nil
}

// checkFieldDeleteAccess checks if the given caller can delete a PropertyField.
// IMPORTANT: Always pass the existing field fetched from the database, not a field provided by the caller.
// Returns nil if deletion is allowed, or an error if denied.
func (pas *PropertyAccessService) checkFieldDeleteAccess(field *model.PropertyField, callerID string) error {
	// Check if field is protected
	if !model.IsPropertyFieldProtected(field) {
		return nil
	}

	// Protected fields can only be deleted by the source plugin
	sourcePluginID := pas.getSourcePluginID(field)
	if sourcePluginID == "" {
		// Protected field with no source plugin - allow deletion
		return nil
	}

	// Check if the source plugin is still installed
	if pas.pluginChecker != nil && !pas.pluginChecker(sourcePluginID) {
		// Plugin has been uninstalled - allow deletion of orphaned field
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
	iterations := 0

	for {
		iterations++
		if iterations > propertyAccessMaxPaginationIterations {
			return nil, fmt.Errorf("getCallerValuesForField: exceeded maximum pagination iterations (%d)", propertyAccessMaxPaginationIterations)
		}

		opts := model.PropertyValueSearchOpts{
			FieldID:   fieldID,
			TargetIDs: []string{callerID},
			PerPage:   propertyAccessPaginationPageSize,
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
		if len(values) < propertyAccessPaginationPageSize {
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
	if field.Attrs != nil {
		maps.Copy(copied.Attrs, field.Attrs)
	}
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
	if field.Attrs == nil {
		return field
	}
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
	if pas.hasUnrestrictedFieldReadAccess(field, callerID) {
		// Unrestricted access - return as-is
		return field
	}

	// Access requires filtering
	accessMode := pas.getAccessMode(field)

	// Shared-only fields: use existing helper to filter options
	if accessMode == model.PropertyAccessModeSharedOnly {
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

// getFieldsForValues fetches all unique fields associated with the given values.
// Returns a map of fieldID -> PropertyField.
// Returns an error if any field cannot be fetched.
func (pas *PropertyAccessService) getFieldsForValues(values []*model.PropertyValue) (map[string]*model.PropertyField, error) {
	if len(values) == 0 {
		return make(map[string]*model.PropertyField), nil
	}

	// Get unique field IDs and group ID
	groupAndFieldIDs := make(map[string]map[string]struct{})
	for _, value := range values {
		if groupAndFieldIDs[value.GroupID] == nil {
			groupAndFieldIDs[value.GroupID] = make(map[string]struct{})
		}
		groupAndFieldIDs[value.GroupID][value.FieldID] = struct{}{}
	}

	fieldMap := make(map[string]*model.PropertyField)
	for groupID, fieldIDs := range groupAndFieldIDs {
		// Convert field map to slice
		fieldIDSlice := make([]string, 0, len(fieldIDs))
		for fieldID := range fieldIDs {
			fieldIDSlice = append(fieldIDSlice, fieldID)
		}

		// Fetch all fields
		fields, err := pas.propertyService.GetPropertyFields(groupID, fieldIDSlice)
		if err != nil {
			return nil, fmt.Errorf("failed to fetch fields for values: %w", err)
		}

		// Build map for easy lookup
		for _, field := range fields {
			fieldMap[field.ID] = field
		}
	}

	return fieldMap, nil
}

// applyValueReadAccessControl applies read access control to a list of values.
// Returns a new list containing only the values the caller can access, with shared_only values filtered.
// Values are silently filtered out if the caller doesn't have access.
func (pas *PropertyAccessService) applyValueReadAccessControl(values []*model.PropertyValue, callerID string) ([]*model.PropertyValue, error) {
	if len(values) == 0 {
		return values, nil
	}

	// Fetch all associated fields
	fieldMap, err := pas.getFieldsForValues(values)
	if err != nil {
		return nil, fmt.Errorf("applyValueReadAccessControl: %w", err)
	}

	// Filter values based on field access
	filtered := make([]*model.PropertyValue, 0, len(values))
	for _, value := range values {
		field, exists := fieldMap[value.FieldID]
		if !exists {
			return nil, fmt.Errorf("applyValueReadAccessControl: field not found for value %s", value.ID)
		}

		accessMode := pas.getAccessMode(field)

		// Check if caller can read this value
		if pas.hasUnrestrictedFieldReadAccess(field, callerID) {
			// Caller has unrestricted access (public or source plugin) - include as-is
			filtered = append(filtered, value)
		} else if accessMode == model.PropertyAccessModeSharedOnly {
			// Shared-only mode: apply filtering
			filteredValue := pas.filterSharedOnlyValue(field, value, callerID)
			if filteredValue != nil {
				filtered = append(filtered, filteredValue)
			}
			// If filteredValue is nil, skip this value (no intersection)
		}
		// For source_only mode where caller is not the source, skip the value
	}

	return filtered, nil
}

func (pas *PropertyAccessService) groupHasAccessRestrictions(groupId string) (bool, error) {
	cpaID, err := getCpaGroupID(pas)
	if err != nil {
		return false, err
	}
	return groupId == cpaID, nil
}
