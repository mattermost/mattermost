// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"github.com/mattermost/mattermost/server/public/model"
)

func (ps *PropertyService) CreatePropertyValue(value *model.PropertyValue) (*model.PropertyValue, error) {
	return ps.valueStore.Create(value)
}

func (ps *PropertyService) GetPropertyValue(groupID, id string) (*model.PropertyValue, error) {
	return ps.valueStore.Get(groupID, id)
}

func (ps *PropertyService) GetPropertyValues(groupID string, ids []string) ([]*model.PropertyValue, error) {
	return ps.valueStore.GetMany(groupID, ids)
}

func (ps *PropertyService) SearchPropertyValues(groupID, targetID string, opts model.PropertyValueSearchOpts) ([]*model.PropertyValue, error) {
	// groupID and targetID are part of the search method signature to
	// incentivize the use of the database indexes in searches
	opts.GroupID = groupID
	opts.TargetID = targetID
	return ps.valueStore.SearchPropertyValues(opts)
}

func (ps *PropertyService) UpdatePropertyValue(value *model.PropertyValue) (*model.PropertyValue, error) {
	values, err := ps.UpdatePropertyValues([]*model.PropertyValue{value})
	if err != nil {
		return nil, err
	}

	return values[0], nil
}

func (ps *PropertyService) UpdatePropertyValues(values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	return ps.valueStore.Update(values)
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

func (ps *PropertyService) DeletePropertyValue(id string) error {
	return ps.valueStore.Delete(id)
}
