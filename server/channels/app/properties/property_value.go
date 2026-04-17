// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// Private implementation methods (database access)

func (ps *PropertyService) createPropertyValue(value *model.PropertyValue) (*model.PropertyValue, error) {
	return ps.valueStore.Create(value)
}

func (ps *PropertyService) createPropertyValues(values []*model.PropertyValue) ([]*model.PropertyValue, error) {
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

// Public methods

func (ps *PropertyService) CreatePropertyValue(rctx request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	if value == nil {
		return nil, fmt.Errorf("CreatePropertyValue: value cannot be nil")
	}

	value, err := ps.runPreCreatePropertyValue(rctx, value)
	if err != nil {
		return nil, fmt.Errorf("CreatePropertyValue: %w", err)
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

	values, err := ps.runPreCreatePropertyValues(rctx, values)
	if err != nil {
		return nil, fmt.Errorf("CreatePropertyValues: %w", err)
	}

	return ps.createPropertyValues(values)
}

func (ps *PropertyService) GetPropertyValue(rctx request.CTX, groupID, id string) (*model.PropertyValue, error) {
	value, err := ps.getPropertyValue(groupID, id)
	if err != nil {
		return nil, fmt.Errorf("GetPropertyValue: %w", err)
	}

	return ps.runPostGetPropertyValue(rctx, value)
}

func (ps *PropertyService) GetPropertyValues(rctx request.CTX, groupID string, ids []string) ([]*model.PropertyValue, error) {
	values, err := ps.getPropertyValues(groupID, ids)
	if err != nil {
		return nil, fmt.Errorf("GetPropertyValues: %w", err)
	}

	return ps.runPostGetPropertyValues(rctx, values)
}

func (ps *PropertyService) SearchPropertyValues(rctx request.CTX, groupID string, opts model.PropertyValueSearchOpts) ([]*model.PropertyValue, error) {
	values, err := ps.searchPropertyValues(groupID, opts)
	if err != nil {
		return nil, fmt.Errorf("SearchPropertyValues: %w", err)
	}

	return ps.runPostGetPropertyValues(rctx, values)
}

func (ps *PropertyService) UpdatePropertyValue(rctx request.CTX, groupID string, value *model.PropertyValue) (*model.PropertyValue, error) {
	value, err := ps.runPreUpdatePropertyValue(rctx, groupID, value)
	if err != nil {
		return nil, fmt.Errorf("UpdatePropertyValue: %w", err)
	}

	return ps.updatePropertyValue(groupID, value)
}

func (ps *PropertyService) UpdatePropertyValues(rctx request.CTX, groupID string, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if len(values) == 0 {
		return values, nil
	}

	// Hooks gate on values[0].GroupID for batch operations, so enforce
	// single-group batches at the public boundary — otherwise a mixed
	// batch could silently bypass per-group hook logic (license,
	// validation, access control).
	for i, v := range values {
		if v == nil {
			return nil, fmt.Errorf("UpdatePropertyValues: nil element at index %d", i)
		}
		if v.GroupID != values[0].GroupID {
			return nil, fmt.Errorf("UpdatePropertyValues: mixed group IDs in batch")
		}
	}

	values, err := ps.runPreUpdatePropertyValues(rctx, groupID, values)
	if err != nil {
		return nil, fmt.Errorf("UpdatePropertyValues: %w", err)
	}

	return ps.updatePropertyValues(groupID, values)
}

func (ps *PropertyService) UpsertPropertyValue(rctx request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	if value == nil {
		return nil, fmt.Errorf("UpsertPropertyValue: value cannot be nil")
	}

	value, err := ps.runPreUpsertPropertyValue(rctx, value)
	if err != nil {
		return nil, fmt.Errorf("UpsertPropertyValue: %w", err)
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

	values, err := ps.runPreUpsertPropertyValues(rctx, values)
	if err != nil {
		return nil, fmt.Errorf("UpsertPropertyValues: %w", err)
	}

	return ps.upsertPropertyValues(values)
}

func (ps *PropertyService) DeletePropertyValue(rctx request.CTX, groupID, id string) error {
	if err := ps.runPreDeletePropertyValue(rctx, groupID, id); err != nil {
		return fmt.Errorf("DeletePropertyValue: %w", err)
	}

	return ps.deletePropertyValue(groupID, id)
}

func (ps *PropertyService) DeletePropertyValuesForTarget(rctx request.CTX, groupID string, targetType string, targetID string) error {
	if err := ps.runPreDeletePropertyValuesForTarget(rctx, groupID, targetType, targetID); err != nil {
		return fmt.Errorf("DeletePropertyValuesForTarget: %w", err)
	}

	return ps.deletePropertyValuesForTarget(groupID, targetType, targetID)
}

func (ps *PropertyService) DeletePropertyValuesForField(rctx request.CTX, groupID, fieldID string) error {
	if err := ps.runPreDeletePropertyValuesForField(rctx, groupID, fieldID); err != nil {
		return fmt.Errorf("DeletePropertyValuesForField: %w", err)
	}

	return ps.deletePropertyValuesForField(groupID, fieldID)
}
