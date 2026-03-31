// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// rejectTemplateValues checks that none of the given values target a template
// field. Template fields are definition-only and must never hold values.
// This is enforced at the service layer to cover all entry points (API,
// CPA endpoints, plugin API).
// The knownFields parameter is optional; fields found in this map are used
// instead of being fetched from the store. Missing fields are still fetched.
func (ps *PropertyService) rejectTemplateValues(values []*model.PropertyValue, knownFields map[string]*model.PropertyField) error {
	// Collect unique (groupID, fieldID) pairs
	type fieldKey struct{ groupID, fieldID string }
	seen := make(map[fieldKey]struct{}, len(values))
	for _, v := range values {
		seen[fieldKey{v.GroupID, v.FieldID}] = struct{}{}
	}

	for key := range seen {
		// Check pre-fetched fields first
		if knownFields != nil {
			if f, ok := knownFields[key.fieldID]; ok {
				if f.ObjectType == model.PropertyFieldObjectTypeTemplate {
					return model.NewAppError(
						"PropertyService",
						"app.property_value.template_no_values.app_error",
						nil,
						fmt.Sprintf("template field %q cannot have values", key.fieldID),
						http.StatusBadRequest,
					)
				}
				continue
			}
		}

		field, err := ps.fieldStore.Get(key.groupID, key.fieldID)
		if err != nil {
			return fmt.Errorf("failed to look up field %q: %w", key.fieldID, err)
		}
		if field.ObjectType == model.PropertyFieldObjectTypeTemplate {
			return model.NewAppError(
				"PropertyService",
				"app.property_value.template_no_values.app_error",
				nil,
				fmt.Sprintf("template field %q cannot have values", key.fieldID),
				http.StatusBadRequest,
			)
		}
	}
	return nil
}

// Private implementation methods (database access)

// createPropertyValue creates a single property value.
// The knownField parameter is optional; if non-nil, it is used for template rejection check.
func (ps *PropertyService) createPropertyValue(value *model.PropertyValue, knownField *model.PropertyField) (*model.PropertyValue, error) {
	var knownFields map[string]*model.PropertyField
	if knownField != nil {
		knownFields = map[string]*model.PropertyField{knownField.ID: knownField}
	}
	if err := ps.rejectTemplateValues([]*model.PropertyValue{value}, knownFields); err != nil {
		return nil, err
	}
	return ps.valueStore.Create(value)
}

// createPropertyValues creates multiple property values.
// The knownFields parameter is optional; if non-nil, it is used for template rejection check.
func (ps *PropertyService) createPropertyValues(values []*model.PropertyValue, knownFields map[string]*model.PropertyField) ([]*model.PropertyValue, error) {
	if err := ps.rejectTemplateValues(values, knownFields); err != nil {
		return nil, err
	}
	return ps.valueStore.CreateMany(values)
}

func (ps *PropertyService) getPropertyValue(groupID, id string) (*model.PropertyValue, error) {
	return ps.valueStore.Get(groupID, id)
}

func (ps *PropertyService) getPropertyValues(groupID string, ids []string) ([]*model.PropertyValue, error) {
	return ps.valueStore.GetMany(groupID, ids)
}

func (ps *PropertyService) searchPropertyValues(groupID string, opts model.PropertyValueSearchOpts) ([]*model.PropertyValue, error) {
	// groupID is part of the search method signature to
	// incentivize the use of the database indexes in searches
	opts.GroupID = groupID
	return ps.valueStore.SearchPropertyValues(opts)
}

// updatePropertyValue updates a single property value.
// The knownField parameter is optional; if non-nil, it is used for template rejection check.
func (ps *PropertyService) updatePropertyValue(groupID string, value *model.PropertyValue, knownField *model.PropertyField) (*model.PropertyValue, error) {
	values, err := ps.updatePropertyValues(groupID, []*model.PropertyValue{value}, singleFieldMap(knownField))
	if err != nil {
		return nil, err
	}

	return values[0], nil
}

// updatePropertyValues updates multiple property values.
// The knownFields parameter is optional; if non-nil, it is used for template rejection check.
func (ps *PropertyService) updatePropertyValues(groupID string, values []*model.PropertyValue, knownFields map[string]*model.PropertyField) ([]*model.PropertyValue, error) {
	if err := ps.rejectTemplateValues(values, knownFields); err != nil {
		return nil, err
	}
	return ps.valueStore.Update(groupID, values)
}

// upsertPropertyValue creates or updates a single property value.
// The knownField parameter is optional; if non-nil, it is used for template rejection check.
func (ps *PropertyService) upsertPropertyValue(value *model.PropertyValue, knownField *model.PropertyField) (*model.PropertyValue, error) {
	values, err := ps.upsertPropertyValues([]*model.PropertyValue{value}, singleFieldMap(knownField))
	if err != nil {
		return nil, err
	}

	return values[0], nil
}

// upsertPropertyValues creates or updates multiple property values.
// The knownFields parameter is optional; if non-nil, it is used for template rejection check.
func (ps *PropertyService) upsertPropertyValues(values []*model.PropertyValue, knownFields map[string]*model.PropertyField) ([]*model.PropertyValue, error) {
	if err := ps.rejectTemplateValues(values, knownFields); err != nil {
		return nil, err
	}
	return ps.valueStore.Upsert(values)
}

// singleFieldMap builds a map from a single field, or returns nil if the field is nil.
func singleFieldMap(field *model.PropertyField) map[string]*model.PropertyField {
	if field == nil {
		return nil
	}
	return map[string]*model.PropertyField{field.ID: field}
}

func (ps *PropertyService) deletePropertyValue(groupID, id string) error {
	return ps.valueStore.Delete(groupID, id)
}

func (ps *PropertyService) deletePropertyValuesForTarget(groupID string, targetType string, targetID string) error {
	return ps.valueStore.DeleteForTarget(groupID, targetType, targetID)
}

func (ps *PropertyService) deletePropertyValuesForField(groupID, fieldID string) error {
	return ps.valueStore.DeleteForField(groupID, fieldID)
}

// Public routing methods

func (ps *PropertyService) CreatePropertyValue(rctx request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	if value == nil {
		return nil, fmt.Errorf("CreatePropertyValue: value cannot be nil")
	}

	result, err := ps.resolveFieldAccessControl(value.GroupID, value.FieldID)
	if err != nil {
		return nil, fmt.Errorf("CreatePropertyValue: %w", err)
	}

	if result.requiresAC {
		callerID := ps.extractCallerID(rctx)
		return ps.propertyAccess.CreatePropertyValue(callerID, value, result.field)
	}

	return ps.createPropertyValue(value, result.field)
}

func (ps *PropertyService) CreatePropertyValues(rctx request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if len(values) == 0 {
		return values, nil
	}

	for i, v := range values {
		if v == nil {
			return nil, fmt.Errorf("CreatePropertyValues: nil element at index %d", i)
		}
		if v.GroupID != values[0].GroupID {
			return nil, fmt.Errorf("CreatePropertyValues: mixed group IDs in batch")
		}
	}

	result, err := ps.resolveFieldAccessControlBatch(values[0].GroupID, uniqueFieldIDsFromValues(values))
	if err != nil {
		return nil, fmt.Errorf("CreatePropertyValues: %w", err)
	}

	if result.requiresAC {
		callerID := ps.extractCallerID(rctx)
		return ps.propertyAccess.CreatePropertyValues(callerID, values, result.fields)
	}

	return ps.createPropertyValues(values, result.fields)
}

func (ps *PropertyService) GetPropertyValue(rctx request.CTX, groupID, id string) (*model.PropertyValue, error) {
	result, err := ps.resolveValueAccessControl(groupID, id)
	if err != nil {
		return nil, fmt.Errorf("GetPropertyValue: %w", err)
	}

	if result.requiresAC {
		callerID := ps.extractCallerID(rctx)
		return ps.propertyAccess.GetPropertyValue(callerID, groupID, id, result.value, result.field)
	}

	// If resolveValueAccessControl already fetched the value, return it directly
	if result.value != nil {
		return result.value, nil
	}

	return ps.getPropertyValue(groupID, id)
}

func (ps *PropertyService) GetPropertyValues(rctx request.CTX, groupID string, ids []string) ([]*model.PropertyValue, error) {
	requiresAC, err := ps.requiresAccessControlForGroupID(groupID)
	if err != nil {
		return nil, fmt.Errorf("GetPropertyValues: %w", err)
	}

	if requiresAC {
		callerID := ps.extractCallerID(rctx)
		return ps.propertyAccess.GetPropertyValues(callerID, groupID, ids, nil, nil)
	}

	// Batch-fetch all values, then check their fields
	values, err := ps.getPropertyValues(groupID, ids)
	if err != nil {
		return nil, fmt.Errorf("GetPropertyValues: %w", err)
	}

	fieldIDs := uniqueFieldIDsFromValues(values)
	result, err := ps.resolveFieldAccessControlBatch(groupID, fieldIDs)
	if err != nil {
		return nil, fmt.Errorf("GetPropertyValues: %w", err)
	}

	if result.requiresAC {
		callerID := ps.extractCallerID(rctx)
		return ps.propertyAccess.GetPropertyValues(callerID, groupID, ids, values, result.fields)
	}

	return values, nil
}

func (ps *PropertyService) SearchPropertyValues(rctx request.CTX, groupID string, opts model.PropertyValueSearchOpts) ([]*model.PropertyValue, error) {
	requiresAC, err := ps.requiresAccessControlForGroupID(groupID)
	if err != nil {
		return nil, fmt.Errorf("SearchPropertyValues: %w", err)
	}

	// If the search targets a specific field, check that field. Otherwise
	// check whether any field in the group links to an AC source.
	if !requiresAC {
		if opts.FieldID != "" {
			var result fieldACResult
			result, err = ps.resolveFieldAccessControl(groupID, opts.FieldID)
			requiresAC = result.requiresAC
		} else {
			requiresAC, err = ps.requiresAccessControlForAnyFieldInGroup(groupID)
		}
		if err != nil {
			return nil, fmt.Errorf("SearchPropertyValues: %w", err)
		}
	}

	if requiresAC {
		callerID := ps.extractCallerID(rctx)
		return ps.propertyAccess.SearchPropertyValues(callerID, groupID, opts)
	}

	return ps.searchPropertyValues(groupID, opts)
}

func (ps *PropertyService) UpdatePropertyValue(rctx request.CTX, groupID string, value *model.PropertyValue) (*model.PropertyValue, error) {
	result, err := ps.resolveFieldAccessControl(groupID, value.FieldID)
	if err != nil {
		return nil, fmt.Errorf("UpdatePropertyValue: %w", err)
	}

	if result.requiresAC {
		callerID := ps.extractCallerID(rctx)
		return ps.propertyAccess.UpdatePropertyValue(callerID, groupID, value, result.field)
	}

	return ps.updatePropertyValue(groupID, value, result.field)
}

func (ps *PropertyService) UpdatePropertyValues(rctx request.CTX, groupID string, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if len(values) == 0 {
		return values, nil
	}

	result, err := ps.resolveFieldAccessControlBatch(groupID, uniqueFieldIDsFromValues(values))
	if err != nil {
		return nil, fmt.Errorf("UpdatePropertyValues: %w", err)
	}

	if result.requiresAC {
		callerID := ps.extractCallerID(rctx)
		return ps.propertyAccess.UpdatePropertyValues(callerID, groupID, values, result.fields)
	}

	return ps.updatePropertyValues(groupID, values, result.fields)
}

func (ps *PropertyService) UpsertPropertyValue(rctx request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	if value == nil {
		return nil, fmt.Errorf("UpsertPropertyValue: value cannot be nil")
	}

	result, err := ps.resolveFieldAccessControl(value.GroupID, value.FieldID)
	if err != nil {
		return nil, fmt.Errorf("UpsertPropertyValue: %w", err)
	}

	if result.requiresAC {
		callerID := ps.extractCallerID(rctx)
		return ps.propertyAccess.UpsertPropertyValue(callerID, value, result.field)
	}

	return ps.upsertPropertyValue(value, result.field)
}

func (ps *PropertyService) UpsertPropertyValues(rctx request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if len(values) == 0 {
		return values, nil
	}

	for i, v := range values {
		if v == nil {
			return nil, fmt.Errorf("UpsertPropertyValues: nil element at index %d", i)
		}
		if v.GroupID != values[0].GroupID {
			return nil, fmt.Errorf("UpsertPropertyValues: mixed group IDs in batch")
		}
	}

	result, err := ps.resolveFieldAccessControlBatch(values[0].GroupID, uniqueFieldIDsFromValues(values))
	if err != nil {
		return nil, fmt.Errorf("UpsertPropertyValues: %w", err)
	}

	if result.requiresAC {
		callerID := ps.extractCallerID(rctx)
		return ps.propertyAccess.UpsertPropertyValues(callerID, values, result.fields)
	}

	return ps.upsertPropertyValues(values, result.fields)
}

func (ps *PropertyService) DeletePropertyValue(rctx request.CTX, groupID, id string) error {
	result, err := ps.resolveValueAccessControl(groupID, id)
	if err != nil {
		return fmt.Errorf("DeletePropertyValue: %w", err)
	}

	if result.requiresAC {
		callerID := ps.extractCallerID(rctx)
		return ps.propertyAccess.DeletePropertyValue(callerID, groupID, id, result.value, result.field)
	}

	return ps.deletePropertyValue(groupID, id)
}

func (ps *PropertyService) DeletePropertyValuesForTarget(rctx request.CTX, groupID string, targetType string, targetID string) error {
	requiresAC, err := ps.requiresAccessControlForAnyFieldInGroup(groupID)
	if err != nil {
		return fmt.Errorf("DeletePropertyValuesForTarget: %w", err)
	}

	if requiresAC {
		callerID := ps.extractCallerID(rctx)
		return ps.propertyAccess.DeletePropertyValuesForTarget(callerID, groupID, targetType, targetID)
	}

	return ps.deletePropertyValuesForTarget(groupID, targetType, targetID)
}

func (ps *PropertyService) DeletePropertyValuesForField(rctx request.CTX, groupID, fieldID string) error {
	result, err := ps.resolveFieldAccessControl(groupID, fieldID)
	if err != nil {
		return fmt.Errorf("DeletePropertyValuesForField: %w", err)
	}

	if result.requiresAC {
		callerID := ps.extractCallerID(rctx)
		return ps.propertyAccess.DeletePropertyValuesForField(callerID, groupID, fieldID, result.field)
	}

	return ps.deletePropertyValuesForField(groupID, fieldID)
}

// uniqueFieldIDsFromValues extracts unique field IDs from a slice of values.
func uniqueFieldIDsFromValues(values []*model.PropertyValue) []string {
	seen := make(map[string]struct{}, len(values))
	ids := make([]string, 0, len(values))
	for _, v := range values {
		if _, ok := seen[v.FieldID]; !ok {
			seen[v.FieldID] = struct{}{}
			ids = append(ids, v.FieldID)
		}
	}
	return ids
}
