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

func (ps *PropertyService) UpdatePropertyValue(groupID string, value *model.PropertyValue) (*model.PropertyValue, error) {
	values, err := ps.UpdatePropertyValues(groupID, []*model.PropertyValue{value})
	if err != nil {
		return nil, err
	}

	return values[0], nil
}

func (ps *PropertyService) UpdatePropertyValues(groupID string, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	return ps.valueStore.Update(groupID, values)
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

func (ps *PropertyService) DeletePropertyValue(groupID, id string) error {
	return ps.valueStore.Delete(groupID, id)
}

func (ps *PropertyService) DeletePropertyValuesForTarget(groupID string, targetType string, targetID string) error {
	return ps.valueStore.DeleteForTarget(groupID, targetType, targetID)
}
