// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"context"
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// rejectTemplateValues checks that none of the given values target a template
// field. Template fields are definition-only and must never hold values.
// This is enforced at the service layer to cover all entry points (API,
// CPA endpoints, plugin API).
func (ps *PropertyService) rejectTemplateValues(values []*model.PropertyValue) error {
	// Collect unique field IDs
	seen := make(map[string]struct{}, len(values))
	for _, v := range values {
		if v == nil {
			continue
		}
		seen[v.FieldID] = struct{}{}
	}
	if len(seen) == 0 {
		return nil
	}

	fieldIDs := make([]string, 0, len(seen))
	for id := range seen {
		fieldIDs = append(fieldIDs, id)
	}

	// Batch lookup from master to avoid replication lag
	fields, err := ps.fieldStore.GetMany(store.WithMaster(context.Background()), "", fieldIDs)
	if err != nil {
		return fmt.Errorf("failed to look up fields for template check: %w", err)
	}

	for _, field := range fields {
		if field.ObjectType == model.PropertyFieldObjectTypeTemplate {
			return model.NewAppError(
				"PropertyService",
				"app.property_value.template_no_values.app_error",
				nil,
				fmt.Sprintf("template field %q cannot have values", field.ID),
				http.StatusBadRequest,
			)
		}
	}
	return nil
}

// Private implementation methods (database access)

func (ps *PropertyService) createPropertyValue(value *model.PropertyValue) (*model.PropertyValue, error) {
	if err := ps.rejectTemplateValues([]*model.PropertyValue{value}); err != nil {
		return nil, err
	}
	return ps.valueStore.Create(value)
}

func (ps *PropertyService) createPropertyValues(values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if err := ps.rejectTemplateValues(values); err != nil {
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

func (ps *PropertyService) updatePropertyValue(groupID string, value *model.PropertyValue) (*model.PropertyValue, error) {
	values, err := ps.updatePropertyValues(groupID, []*model.PropertyValue{value})
	if err != nil {
		return nil, err
	}

	return values[0], nil
}

func (ps *PropertyService) updatePropertyValues(groupID string, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if err := ps.rejectTemplateValues(values); err != nil {
		return nil, err
	}
	return ps.valueStore.Update(groupID, values)
}

func (ps *PropertyService) upsertPropertyValue(value *model.PropertyValue) (*model.PropertyValue, error) {
	values, err := ps.upsertPropertyValues([]*model.PropertyValue{value})
	if err != nil {
		return nil, err
	}

	return values[0], nil
}

func (ps *PropertyService) upsertPropertyValues(values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if err := ps.rejectTemplateValues(values); err != nil {
		return nil, err
	}
	return ps.valueStore.Upsert(values)
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

	requiresAC, err := ps.requiresAccessControlForGroupID(value.GroupID)
	if err != nil {
		return nil, fmt.Errorf("CreatePropertyValue: %w", err)
	}

	if requiresAC {
		callerID := ps.extractCallerID(rctx)
		return ps.propertyAccess.CreatePropertyValue(callerID, value)
	}

	return ps.createPropertyValue(value)
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

	requiresAC, err := ps.requiresAccessControlForGroupID(values[0].GroupID)
	if err != nil {
		return nil, fmt.Errorf("CreatePropertyValues: %w", err)
	}

	if requiresAC {
		callerID := ps.extractCallerID(rctx)
		return ps.propertyAccess.CreatePropertyValues(callerID, values)
	}

	return ps.createPropertyValues(values)
}

func (ps *PropertyService) GetPropertyValue(rctx request.CTX, groupID, id string) (*model.PropertyValue, error) {
	requiresAC, err := ps.requiresAccessControlForGroupID(groupID)
	if err != nil {
		return nil, fmt.Errorf("GetPropertyValue: %w", err)
	}

	if requiresAC {
		callerID := ps.extractCallerID(rctx)
		return ps.propertyAccess.GetPropertyValue(callerID, groupID, id)
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
		return ps.propertyAccess.GetPropertyValues(callerID, groupID, ids)
	}

	return ps.getPropertyValues(groupID, ids)
}

func (ps *PropertyService) SearchPropertyValues(rctx request.CTX, groupID string, opts model.PropertyValueSearchOpts) ([]*model.PropertyValue, error) {
	requiresAC, err := ps.requiresAccessControlForGroupID(groupID)
	if err != nil {
		return nil, fmt.Errorf("SearchPropertyValues: %w", err)
	}

	if requiresAC {
		callerID := ps.extractCallerID(rctx)
		return ps.propertyAccess.SearchPropertyValues(callerID, groupID, opts)
	}

	return ps.searchPropertyValues(groupID, opts)
}

func (ps *PropertyService) UpdatePropertyValue(rctx request.CTX, groupID string, value *model.PropertyValue) (*model.PropertyValue, error) {
	requiresAC, err := ps.requiresAccessControlForGroupID(groupID)
	if err != nil {
		return nil, fmt.Errorf("UpdatePropertyValue: %w", err)
	}

	if requiresAC {
		callerID := ps.extractCallerID(rctx)
		return ps.propertyAccess.UpdatePropertyValue(callerID, groupID, value)
	}

	return ps.updatePropertyValue(groupID, value)
}

func (ps *PropertyService) UpdatePropertyValues(rctx request.CTX, groupID string, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	requiresAC, err := ps.requiresAccessControlForGroupID(groupID)
	if err != nil {
		return nil, fmt.Errorf("UpdatePropertyValues: %w", err)
	}

	if requiresAC {
		callerID := ps.extractCallerID(rctx)
		return ps.propertyAccess.UpdatePropertyValues(callerID, groupID, values)
	}

	return ps.updatePropertyValues(groupID, values)
}

func (ps *PropertyService) UpsertPropertyValue(rctx request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	if value == nil {
		return nil, fmt.Errorf("UpsertPropertyValue: value cannot be nil")
	}

	requiresAC, err := ps.requiresAccessControlForGroupID(value.GroupID)
	if err != nil {
		return nil, fmt.Errorf("UpsertPropertyValue: %w", err)
	}

	if requiresAC {
		callerID := ps.extractCallerID(rctx)
		return ps.propertyAccess.UpsertPropertyValue(callerID, value)
	}

	return ps.upsertPropertyValue(value)
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

	requiresAC, err := ps.requiresAccessControlForGroupID(values[0].GroupID)
	if err != nil {
		return nil, fmt.Errorf("UpsertPropertyValues: %w", err)
	}

	if requiresAC {
		callerID := ps.extractCallerID(rctx)
		return ps.propertyAccess.UpsertPropertyValues(callerID, values)
	}

	return ps.upsertPropertyValues(values)
}

func (ps *PropertyService) DeletePropertyValue(rctx request.CTX, groupID, id string) error {
	requiresAC, err := ps.requiresAccessControlForGroupID(groupID)
	if err != nil {
		return fmt.Errorf("DeletePropertyValue: %w", err)
	}

	if requiresAC {
		callerID := ps.extractCallerID(rctx)
		return ps.propertyAccess.DeletePropertyValue(callerID, groupID, id)
	}

	return ps.deletePropertyValue(groupID, id)
}

func (ps *PropertyService) DeletePropertyValuesForTarget(rctx request.CTX, groupID string, targetType string, targetID string) error {
	requiresAC, err := ps.requiresAccessControlForGroupID(groupID)
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
	requiresAC, err := ps.requiresAccessControlForGroupID(groupID)
	if err != nil {
		return fmt.Errorf("DeletePropertyValuesForField: %w", err)
	}

	if requiresAC {
		callerID := ps.extractCallerID(rctx)
		return ps.propertyAccess.DeletePropertyValuesForField(callerID, groupID, fieldID)
	}

	return ps.deletePropertyValuesForField(groupID, fieldID)
}
