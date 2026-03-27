// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// Private implementation methods (database access)

func (ps *PropertyService) createPropertyField(field *model.PropertyField) (*model.PropertyField, error) {
	return ps.fieldStore.Create(field)
}

func (ps *PropertyService) getPropertyField(groupID, id string) (*model.PropertyField, error) {
	return ps.fieldStore.Get(groupID, id)
}

func (ps *PropertyService) getPropertyFields(groupID string, ids []string) ([]*model.PropertyField, error) {
	return ps.fieldStore.GetMany(groupID, ids)
}

func (ps *PropertyService) getPropertyFieldByName(groupID, targetID, name string) (*model.PropertyField, error) {
	return ps.fieldStore.GetFieldByName(groupID, targetID, name)
}

func (ps *PropertyService) countActivePropertyFieldsForGroup(groupID string) (int64, error) {
	return ps.fieldStore.CountForGroup(groupID, false)
}

func (ps *PropertyService) countAllPropertyFieldsForGroup(groupID string) (int64, error) {
	return ps.fieldStore.CountForGroup(groupID, true)
}

func (ps *PropertyService) countActivePropertyFieldsForTarget(groupID, targetType, targetID string) (int64, error) {
	return ps.fieldStore.CountForTarget(groupID, targetType, targetID, false)
}

func (ps *PropertyService) countAllPropertyFieldsForTarget(groupID, targetType, targetID string) (int64, error) {
	return ps.fieldStore.CountForTarget(groupID, targetType, targetID, true)
}

func (ps *PropertyService) searchPropertyFields(groupID string, opts model.PropertyFieldSearchOpts) ([]*model.PropertyField, error) {
	// groupID is part of the search method signature to
	// incentivize the use of the database indexes in searches
	opts.GroupID = groupID

	return ps.fieldStore.SearchPropertyFields(opts)
}

func (ps *PropertyService) updatePropertyField(groupID string, field *model.PropertyField) (*model.PropertyField, error) {
	fields, err := ps.updatePropertyFields(groupID, []*model.PropertyField{field})
	if err != nil {
		return nil, err
	}

	return fields[0], nil
}

func (ps *PropertyService) updatePropertyFields(groupID string, fields []*model.PropertyField) ([]*model.PropertyField, error) {
	return ps.fieldStore.Update(groupID, fields)
}

func (ps *PropertyService) deletePropertyField(groupID, id string) error {
	// if groupID is not empty, we need to check first that the field belongs to the group
	if groupID != "" {
		if _, err := ps.getPropertyField(groupID, id); err != nil {
			return fmt.Errorf("error getting property field %q for group %q: %w", id, groupID, err)
		}
	}

	if err := ps.valueStore.DeleteForField(groupID, id); err != nil {
		return err
	}

	return ps.fieldStore.Delete(groupID, id)
}

// Public routing methods

func (ps *PropertyService) CreatePropertyField(rctx request.CTX, field *model.PropertyField) (*model.PropertyField, error) {
	requiresAC, err := ps.requiresAccessControl(field.GroupID)
	if err != nil {
		return nil, fmt.Errorf("CreatePropertyField: %w", err)
	}

	if requiresAC {
		callerID := ps.extractCallerID(rctx)
		return ps.propertyAccess.CreatePropertyField(callerID, field)
	}

	return ps.createPropertyField(field)
}

func (ps *PropertyService) GetPropertyField(rctx request.CTX, groupID, id string) (*model.PropertyField, error) {
	requiresAC, err := ps.requiresAccessControl(groupID)
	if err != nil {
		return nil, fmt.Errorf("GetPropertyField: %w", err)
	}

	if requiresAC {
		callerID := ps.extractCallerID(rctx)
		return ps.propertyAccess.GetPropertyField(callerID, groupID, id)
	}

	return ps.getPropertyField(groupID, id)
}

func (ps *PropertyService) GetPropertyFields(rctx request.CTX, groupID string, ids []string) ([]*model.PropertyField, error) {
	requiresAC, err := ps.requiresAccessControl(groupID)
	if err != nil {
		return nil, fmt.Errorf("GetPropertyFields: %w", err)
	}

	if requiresAC {
		callerID := ps.extractCallerID(rctx)
		return ps.propertyAccess.GetPropertyFields(callerID, groupID, ids)
	}

	return ps.getPropertyFields(groupID, ids)
}

func (ps *PropertyService) GetPropertyFieldByName(rctx request.CTX, groupID, targetID, name string) (*model.PropertyField, error) {
	requiresAC, err := ps.requiresAccessControl(groupID)
	if err != nil {
		return nil, fmt.Errorf("GetPropertyFieldByName: %w", err)
	}

	if requiresAC {
		callerID := ps.extractCallerID(rctx)
		return ps.propertyAccess.GetPropertyFieldByName(callerID, groupID, targetID, name)
	}

	return ps.getPropertyFieldByName(groupID, targetID, name)
}

func (ps *PropertyService) CountActivePropertyFieldsForGroup(rctx request.CTX, groupID string) (int64, error) {
	requiresAC, err := ps.requiresAccessControl(groupID)
	if err != nil {
		return 0, fmt.Errorf("CountActivePropertyFieldsForGroup: %w", err)
	}

	if requiresAC {
		return ps.propertyAccess.CountActivePropertyFieldsForGroup(groupID)
	}

	return ps.countActivePropertyFieldsForGroup(groupID)
}

func (ps *PropertyService) CountAllPropertyFieldsForGroup(rctx request.CTX, groupID string) (int64, error) {
	requiresAC, err := ps.requiresAccessControl(groupID)
	if err != nil {
		return 0, fmt.Errorf("CountAllPropertyFieldsForGroup: %w", err)
	}

	if requiresAC {
		return ps.propertyAccess.CountAllPropertyFieldsForGroup(groupID)
	}

	return ps.countAllPropertyFieldsForGroup(groupID)
}

func (ps *PropertyService) CountActivePropertyFieldsForTarget(rctx request.CTX, groupID, targetType, targetID string) (int64, error) {
	requiresAC, err := ps.requiresAccessControl(groupID)
	if err != nil {
		return 0, fmt.Errorf("CountActivePropertyFieldsForTarget: %w", err)
	}

	if requiresAC {
		return ps.propertyAccess.CountActivePropertyFieldsForTarget(groupID, targetType, targetID)
	}

	return ps.countActivePropertyFieldsForTarget(groupID, targetType, targetID)
}

func (ps *PropertyService) CountAllPropertyFieldsForTarget(rctx request.CTX, groupID, targetType, targetID string) (int64, error) {
	requiresAC, err := ps.requiresAccessControl(groupID)
	if err != nil {
		return 0, fmt.Errorf("CountAllPropertyFieldsForTarget: %w", err)
	}

	if requiresAC {
		return ps.propertyAccess.CountAllPropertyFieldsForTarget(groupID, targetType, targetID)
	}

	return ps.countAllPropertyFieldsForTarget(groupID, targetType, targetID)
}

func (ps *PropertyService) SearchPropertyFields(rctx request.CTX, groupID string, opts model.PropertyFieldSearchOpts) ([]*model.PropertyField, error) {
	requiresAC, err := ps.requiresAccessControl(groupID)
	if err != nil {
		return nil, fmt.Errorf("SearchPropertyFields: %w", err)
	}

	if requiresAC {
		callerID := ps.extractCallerID(rctx)
		return ps.propertyAccess.SearchPropertyFields(callerID, groupID, opts)
	}

	return ps.searchPropertyFields(groupID, opts)
}

func (ps *PropertyService) UpdatePropertyField(rctx request.CTX, groupID string, field *model.PropertyField) (*model.PropertyField, error) {
	requiresAC, err := ps.requiresAccessControl(groupID)
	if err != nil {
		return nil, fmt.Errorf("UpdatePropertyField: %w", err)
	}

	if requiresAC {
		callerID := ps.extractCallerID(rctx)
		return ps.propertyAccess.UpdatePropertyField(callerID, groupID, field)
	}

	return ps.updatePropertyField(groupID, field)
}

func (ps *PropertyService) UpdatePropertyFields(rctx request.CTX, groupID string, fields []*model.PropertyField) ([]*model.PropertyField, error) {
	requiresAC, err := ps.requiresAccessControl(groupID)
	if err != nil {
		return nil, fmt.Errorf("UpdatePropertyFields: %w", err)
	}

	if requiresAC {
		callerID := ps.extractCallerID(rctx)
		return ps.propertyAccess.UpdatePropertyFields(callerID, groupID, fields)
	}

	return ps.updatePropertyFields(groupID, fields)
}

func (ps *PropertyService) DeletePropertyField(rctx request.CTX, groupID, id string) error {
	requiresAC, err := ps.requiresAccessControl(groupID)
	if err != nil {
		return fmt.Errorf("DeletePropertyField: %w", err)
	}

	if requiresAC {
		callerID := ps.extractCallerID(rctx)
		return ps.propertyAccess.DeletePropertyField(callerID, groupID, id)
	}

	return ps.deletePropertyField(groupID, id)
}
