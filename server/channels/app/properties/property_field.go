// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"github.com/mattermost/mattermost/server/public/model"
)

func (ps *PropertyService) CreatePropertyField(field *model.PropertyField) (*model.PropertyField, error) {
	return ps.fieldStore.Create(field)
}

func (ps *PropertyService) GetPropertyField(id string) (*model.PropertyField, error) {
	return ps.fieldStore.Get(id)
}

func (ps *PropertyService) GetPropertyFields(ids []string) ([]*model.PropertyField, error) {
	return ps.fieldStore.GetMany(ids)
}

func (ps *PropertyService) SearchPropertyFields(opts model.PropertyFieldSearchOpts) ([]*model.PropertyField, error) {
	return ps.fieldStore.SearchPropertyFields(opts)
}

func (ps *PropertyService) UpdatePropertyField(field *model.PropertyField) (*model.PropertyField, error) {
	fields, err := ps.UpdatePropertyFields([]*model.PropertyField{field})
	if err != nil {
		return nil, err
	}

	return fields[0], nil
}

func (ps *PropertyService) UpdatePropertyFields(fields []*model.PropertyField) ([]*model.PropertyField, error) {
	return ps.fieldStore.Update(fields)
}

func (ps *PropertyService) DeletePropertyField(id string) error {
	if err := ps.valueStore.DeleteForField(id); err != nil {
		return err
	}
	return ps.fieldStore.Delete(id)
}
