// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"github.com/mattermost/mattermost/server/public/model"
)

func (ps *PropertyService) CreatePropertyValue(value *model.PropertyValue) (*model.PropertyValue, error) {
	return ps.valueStore.Create(value)
}

func (ps *PropertyService) GetPropertyValue(id string, groupID string) (*model.PropertyValue, error) {
	return ps.valueStore.Get(id, groupID)
}

func (ps *PropertyService) GetPropertyValues(ids []string, groupID string) ([]*model.PropertyValue, error) {
	return ps.valueStore.GetMany(ids, groupID)
}

func (ps *PropertyService) SearchPropertyValues(opts model.PropertyValueSearchOpts) ([]*model.PropertyValue, error) {
	return ps.valueStore.SearchPropertyValues(opts)
}

func (ps *PropertyService) UpdatePropertyValue(value *model.PropertyValue, groupID string) (*model.PropertyValue, error) {
	values, err := ps.UpdatePropertyValues([]*model.PropertyValue{value}, groupID)
	if err != nil {
		return nil, err
	}

	return values[0], nil
}

func (ps *PropertyService) UpdatePropertyValues(values []*model.PropertyValue, groupID string) ([]*model.PropertyValue, error) {
	return ps.valueStore.Update(values, groupID)
}

func (ps *PropertyService) UpsertPropertyValue(value *model.PropertyValue) (*model.PropertyValue, error) {
	values, err := ps.UpsertPropertyValues([]*model.PropertyValue{value})
	if err != nil {
		return nil, err
	}

	return values[0], nil
}

func (ps *PropertyService) UpsertPropertyValues(values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	return ps.valueStore.Upsert(values)
}

func (ps *PropertyService) DeletePropertyValue(id string, groupID string) error {
	return ps.valueStore.Delete(id, groupID)
}
