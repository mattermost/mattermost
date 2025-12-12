// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app/properties"
)

// PropertyAccessService is a decorator around PropertyService that enforces
// access control based on caller identity. All property operations go through
// this service to ensure consistent access control enforcement.
//
// Currently, this service acts as a simple pass-through to PropertyService.
// Access control logic will be added in subsequent commits.
type PropertyAccessService struct {
	propertyService *properties.PropertyService
}

// NewPropertyAccessService creates a new PropertyAccessService wrapping the given PropertyService.
func NewPropertyAccessService(ps *properties.PropertyService) *PropertyAccessService {
	return &PropertyAccessService{
		propertyService: ps,
	}
}

// Property Group Methods

// RegisterPropertyGroup registers a new property group.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) RegisterPropertyGroup(callerID string, name string) (*model.PropertyGroup, error) {
	return pas.propertyService.RegisterPropertyGroup(name)
}

// GetPropertyGroup retrieves a property group by name.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) GetPropertyGroup(callerID string, name string) (*model.PropertyGroup, error) {
	return pas.propertyService.GetPropertyGroup(name)
}

// Property Field Methods

// CreatePropertyField creates a new property field.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) CreatePropertyField(callerID string, field *model.PropertyField) (*model.PropertyField, error) {
	return pas.propertyService.CreatePropertyField(field)
}

// GetPropertyField retrieves a property field by group and field ID.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) GetPropertyField(callerID string, groupID, id string) (*model.PropertyField, error) {
	return pas.propertyService.GetPropertyField(groupID, id)
}

// GetPropertyFields retrieves multiple property fields by their IDs.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) GetPropertyFields(callerID string, groupID string, ids []string) ([]*model.PropertyField, error) {
	return pas.propertyService.GetPropertyFields(groupID, ids)
}

// GetPropertyFieldByName retrieves a property field by name.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) GetPropertyFieldByName(callerID string, groupID, targetID, name string) (*model.PropertyField, error) {
	return pas.propertyService.GetPropertyFieldByName(groupID, targetID, name)
}

// CountActivePropertyFieldsForGroup counts active property fields for a group.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) CountActivePropertyFieldsForGroup(callerID string, groupID string) (int64, error) {
	return pas.propertyService.CountActivePropertyFieldsForGroup(groupID)
}

// CountAllPropertyFieldsForGroup counts all property fields (including deleted) for a group.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) CountAllPropertyFieldsForGroup(callerID string, groupID string) (int64, error) {
	return pas.propertyService.CountAllPropertyFieldsForGroup(groupID)
}

// CountActivePropertyFieldsForTarget counts active property fields for a specific target.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) CountActivePropertyFieldsForTarget(callerID string, groupID, targetType, targetID string) (int64, error) {
	return pas.propertyService.CountActivePropertyFieldsForTarget(groupID, targetType, targetID)
}

// CountAllPropertyFieldsForTarget counts all property fields (including deleted) for a specific target.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) CountAllPropertyFieldsForTarget(callerID string, groupID, targetType, targetID string) (int64, error) {
	return pas.propertyService.CountAllPropertyFieldsForTarget(groupID, targetType, targetID)
}

// SearchPropertyFields searches for property fields based on the given options.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) SearchPropertyFields(callerID string, groupID string, opts model.PropertyFieldSearchOpts) ([]*model.PropertyField, error) {
	return pas.propertyService.SearchPropertyFields(groupID, opts)
}

// UpdatePropertyField updates a property field.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) UpdatePropertyField(callerID string, groupID string, field *model.PropertyField) (*model.PropertyField, error) {
	return pas.propertyService.UpdatePropertyField(groupID, field)
}

// UpdatePropertyFields updates multiple property fields.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) UpdatePropertyFields(callerID string, groupID string, fields []*model.PropertyField) ([]*model.PropertyField, error) {
	return pas.propertyService.UpdatePropertyFields(groupID, fields)
}

// DeletePropertyField deletes a property field and all its values.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) DeletePropertyField(callerID string, groupID, id string) error {
	return pas.propertyService.DeletePropertyField(groupID, id)
}

// Property Value Methods

// CreatePropertyValue creates a new property value.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) CreatePropertyValue(callerID string, value *model.PropertyValue) (*model.PropertyValue, error) {
	return pas.propertyService.CreatePropertyValue(value)
}

// CreatePropertyValues creates multiple property values.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) CreatePropertyValues(callerID string, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	return pas.propertyService.CreatePropertyValues(values)
}

// GetPropertyValue retrieves a property value by ID.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) GetPropertyValue(callerID string, groupID, id string) (*model.PropertyValue, error) {
	return pas.propertyService.GetPropertyValue(groupID, id)
}

// GetPropertyValues retrieves multiple property values by their IDs.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) GetPropertyValues(callerID string, groupID string, ids []string) ([]*model.PropertyValue, error) {
	return pas.propertyService.GetPropertyValues(groupID, ids)
}

// SearchPropertyValues searches for property values based on the given options.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) SearchPropertyValues(callerID string, groupID string, opts model.PropertyValueSearchOpts) ([]*model.PropertyValue, error) {
	return pas.propertyService.SearchPropertyValues(groupID, opts)
}

// UpdatePropertyValue updates a property value.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) UpdatePropertyValue(callerID string, groupID string, value *model.PropertyValue) (*model.PropertyValue, error) {
	return pas.propertyService.UpdatePropertyValue(groupID, value)
}

// UpdatePropertyValues updates multiple property values.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) UpdatePropertyValues(callerID string, groupID string, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	return pas.propertyService.UpdatePropertyValues(groupID, values)
}

// UpsertPropertyValue creates or updates a property value.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) UpsertPropertyValue(callerID string, value *model.PropertyValue) (*model.PropertyValue, error) {
	return pas.propertyService.UpsertPropertyValue(value)
}

// UpsertPropertyValues creates or updates multiple property values.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) UpsertPropertyValues(callerID string, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	return pas.propertyService.UpsertPropertyValues(values)
}

// DeletePropertyValue deletes a property value.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) DeletePropertyValue(callerID string, groupID, id string) error {
	return pas.propertyService.DeletePropertyValue(groupID, id)
}

// DeletePropertyValuesForTarget deletes all property values for a specific target.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) DeletePropertyValuesForTarget(callerID string, groupID string, targetType string, targetID string) error {
	return pas.propertyService.DeletePropertyValuesForTarget(groupID, targetType, targetID)
}

// DeletePropertyValuesForField deletes all property values for a specific field.
// callerID identifies the caller (pluginID, userID, or empty string for system).
func (pas *PropertyAccessService) DeletePropertyValuesForField(callerID string, groupID, fieldID string) error {
	return pas.propertyService.DeletePropertyValuesForField(groupID, fieldID)
}
