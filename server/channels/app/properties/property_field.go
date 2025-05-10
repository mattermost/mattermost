// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
)

func (ps *PropertyService) CreatePropertyField(field *model.PropertyField) (*model.PropertyField, error) {
	return ps.fieldStore.Create(field)
}

func (ps *PropertyService) GetPropertyField(groupID, id string) (*model.PropertyField, error) {
	return ps.fieldStore.Get(groupID, id)
}

func (ps *PropertyService) GetPropertyFields(groupID string, ids []string) ([]*model.PropertyField, error) {
	return ps.fieldStore.GetMany(groupID, ids)
}

func (ps *PropertyService) GetPropertyFieldByName(groupID, targetID, name string) (*model.PropertyField, error) {
	return ps.fieldStore.GetFieldByName(groupID, targetID, name)
}

func (ps *PropertyService) CountActivePropertyFieldsForGroup(groupID string) (int64, error) {
	return ps.fieldStore.CountForGroup(groupID, false)
}

func (ps *PropertyService) SearchPropertyFields(groupID, targetID string, opts model.PropertyFieldSearchOpts) ([]*model.PropertyField, error) {
	// groupID and targetID are part of the search method signature to
	// incentivize the use of the database indexes in searches
	opts.GroupID = groupID
	opts.TargetID = targetID

	return ps.fieldStore.SearchPropertyFields(opts)
}

func (ps *PropertyService) UpdatePropertyField(groupID string, field *model.PropertyField) (*model.PropertyField, error) {
	fields, err := ps.UpdatePropertyFields(groupID, []*model.PropertyField{field})
	if err != nil {
		return nil, err
	}

	return fields[0], nil
}

func (ps *PropertyService) UpdatePropertyFields(groupID string, fields []*model.PropertyField) ([]*model.PropertyField, error) {
	return ps.fieldStore.Update(groupID, fields)
}

func (ps *PropertyService) DeletePropertyField(groupID, id string) error {
	// if groupID is not empty, we need to check first that the field belongs to the group
	if groupID != "" {
		if _, err := ps.GetPropertyField(groupID, id); err != nil {
			return fmt.Errorf("error getting property field %q for group %q: %w", id, groupID, err)
		}
	}

	if err := ps.valueStore.DeleteForField(id); err != nil {
		return err
	}

	return ps.fieldStore.Delete(groupID, id)
}
