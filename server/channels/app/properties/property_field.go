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

func (ps *PropertyService) GetPropertyField(id string, groupID string) (*model.PropertyField, error) {
	return ps.fieldStore.Get(id, groupID)
}

func (ps *PropertyService) GetPropertyFields(ids []string, groupID string) ([]*model.PropertyField, error) {
	return ps.fieldStore.GetMany(ids, groupID)
}

func (ps *PropertyService) CountActivePropertyFieldsForGroup(groupID string) (int64, error) {
	return ps.fieldStore.CountForGroup(groupID, false)
}

func (ps *PropertyService) SearchPropertyFields(opts model.PropertyFieldSearchOpts) ([]*model.PropertyField, error) {
	return ps.fieldStore.SearchPropertyFields(opts)
}

func (ps *PropertyService) UpdatePropertyField(field *model.PropertyField, groupID string) (*model.PropertyField, error) {
	fields, err := ps.UpdatePropertyFields([]*model.PropertyField{field}, groupID)
	if err != nil {
		return nil, err
	}

	return fields[0], nil
}

func (ps *PropertyService) UpdatePropertyFields(fields []*model.PropertyField, groupID string) ([]*model.PropertyField, error) {
	return ps.fieldStore.Update(fields, groupID)
}

func (ps *PropertyService) DeletePropertyField(id string, groupID string) error {
	// if groupID is not empty, we need to check first that the field belongs to the group
	if groupID != "" {
		if _, err := ps.GetPropertyField(id, groupID); err != nil {
			return fmt.Errorf("error getting property field %q for group %q: %w", id, groupID, err)
		}
	}

	if err := ps.valueStore.DeleteForField(id); err != nil {
		return err
	}

	return ps.fieldStore.Delete(id, groupID)
}
