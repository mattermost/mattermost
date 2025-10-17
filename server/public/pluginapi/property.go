package pluginapi

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

// PropertyService exposes methods to manipulate property fields and values.
type PropertyService struct {
	api plugin.API
}

// CreatePropertyField creates a new property field.
//
// Minimum server version: 10.10
func (p *PropertyService) CreatePropertyField(field *model.PropertyField) (*model.PropertyField, error) {
	return p.api.CreatePropertyField(field)
}

// GetPropertyField gets a property field by groupID and fieldID.
//
// Minimum server version: 10.10
func (p *PropertyService) GetPropertyField(groupID, fieldID string) (*model.PropertyField, error) {
	return p.api.GetPropertyField(groupID, fieldID)
}

// GetPropertyFields gets multiple property fields by groupID and a list of IDs.
//
// Minimum server version: 10.10
func (p *PropertyService) GetPropertyFields(groupID string, ids []string) ([]*model.PropertyField, error) {
	return p.api.GetPropertyFields(groupID, ids)
}

// UpdatePropertyField updates an existing property field.
//
// Minimum server version: 10.10
func (p *PropertyService) UpdatePropertyField(groupID string, field *model.PropertyField) (*model.PropertyField, error) {
	return p.api.UpdatePropertyField(groupID, field)
}

// DeletePropertyField deletes a property field (soft delete).
//
// Minimum server version: 10.10
func (p *PropertyService) DeletePropertyField(groupID, fieldID string) error {
	return p.api.DeletePropertyField(groupID, fieldID)
}

// SearchPropertyFields searches for property fields with filtering options.
//
// Minimum server version: 11.0
func (p *PropertyService) SearchPropertyFields(groupID string, opts model.PropertyFieldSearchOpts) ([]*model.PropertyField, error) {
	return p.api.SearchPropertyFields(groupID, opts)
}

// CountPropertyFields counts property fields for a group.
//
// Minimum server version: 11.0
func (p *PropertyService) CountPropertyFields(groupID string, includeDeleted bool) (int64, error) {
	return p.api.CountPropertyFields(groupID, includeDeleted)
}

// CountPropertyFieldsForTarget counts property fields for a specific target.
//
// Minimum server version: 11.0
func (p *PropertyService) CountPropertyFieldsForTarget(groupID, targetType, targetID string, includeDeleted bool) (int64, error) {
	return p.api.CountPropertyFieldsForTarget(groupID, targetType, targetID, includeDeleted)
}

// CreatePropertyValue creates a new property value.
//
// Minimum server version: 10.10
func (p *PropertyService) CreatePropertyValue(value *model.PropertyValue) (*model.PropertyValue, error) {
	return p.api.CreatePropertyValue(value)
}

// GetPropertyValue gets a property value by groupID and valueID.
//
// Minimum server version: 10.10
func (p *PropertyService) GetPropertyValue(groupID, valueID string) (*model.PropertyValue, error) {
	return p.api.GetPropertyValue(groupID, valueID)
}

// GetPropertyValues gets multiple property values by groupID and a list of IDs.
//
// Minimum server version: 10.10
func (p *PropertyService) GetPropertyValues(groupID string, ids []string) ([]*model.PropertyValue, error) {
	return p.api.GetPropertyValues(groupID, ids)
}

// UpdatePropertyValue updates an existing property value.
//
// Minimum server version: 10.10
func (p *PropertyService) UpdatePropertyValue(groupID string, value *model.PropertyValue) (*model.PropertyValue, error) {
	return p.api.UpdatePropertyValue(groupID, value)
}

// UpsertPropertyValue creates a new property value or updates it if it already exists.
//
// Minimum server version: 10.10
func (p *PropertyService) UpsertPropertyValue(value *model.PropertyValue) (*model.PropertyValue, error) {
	return p.api.UpsertPropertyValue(value)
}

// DeletePropertyValue deletes a property value (soft delete).
//
// Minimum server version: 10.10
func (p *PropertyService) DeletePropertyValue(groupID, valueID string) error {
	return p.api.DeletePropertyValue(groupID, valueID)
}

// SearchPropertyValues searches for property values with filtering options.
//
// Minimum server version: 11.0
func (p *PropertyService) SearchPropertyValues(groupID string, opts model.PropertyValueSearchOpts) ([]*model.PropertyValue, error) {
	return p.api.SearchPropertyValues(groupID, opts)
}

// RegisterPropertyGroup registers a new property group.
//
// Minimum server version: 10.10
func (p *PropertyService) RegisterPropertyGroup(name string) (*model.PropertyGroup, error) {
	return p.api.RegisterPropertyGroup(name)
}

// GetPropertyGroup gets a property group by name.
//
// Minimum server version: 10.10
func (p *PropertyService) GetPropertyGroup(name string) (*model.PropertyGroup, error) {
	return p.api.GetPropertyGroup(name)
}

// GetPropertyFieldByName gets a property field by groupID, targetID and name.
//
// Minimum server version: 10.10
func (p *PropertyService) GetPropertyFieldByName(groupID, targetID, name string) (*model.PropertyField, error) {
	return p.api.GetPropertyFieldByName(groupID, targetID, name)
}

// UpdatePropertyFields updates multiple property fields in a single operation.
//
// Minimum server version: 10.10
func (p *PropertyService) UpdatePropertyFields(groupID string, fields []*model.PropertyField) ([]*model.PropertyField, error) {
	return p.api.UpdatePropertyFields(groupID, fields)
}

// UpdatePropertyValues updates multiple property values in a single operation.
//
// Minimum server version: 10.10
func (p *PropertyService) UpdatePropertyValues(groupID string, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	return p.api.UpdatePropertyValues(groupID, values)
}

// UpsertPropertyValues creates or updates multiple property values in a single operation.
//
// Minimum server version: 10.10
func (p *PropertyService) UpsertPropertyValues(values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	return p.api.UpsertPropertyValues(values)
}

// DeletePropertyValuesForTarget deletes all property values for a specific target.
//
// Minimum server version: 10.10
func (p *PropertyService) DeletePropertyValuesForTarget(groupID, targetType, targetID string) error {
	return p.api.DeletePropertyValuesForTarget(groupID, targetType, targetID)
}

// DeletePropertyValuesForField deletes all property values for a specific field.
//
// Minimum server version: 10.10
func (p *PropertyService) DeletePropertyValuesForField(groupID, fieldID string) error {
	return p.api.DeletePropertyValuesForField(groupID, fieldID)
}
