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
// If the field's LinkedFieldID is set, the field inherits type, options,
// and security attributes from the referenced template field. The source
// must be a template field in the same group, must not itself be linked,
// and must not be deleted.
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
// Fields with a LinkedFieldID cannot have their type or options modified.
// Set LinkedFieldID to an empty string to unlink a field from its source.
//
// Minimum server version: 10.10
func (p *PropertyService) UpdatePropertyField(groupID string, field *model.PropertyField) (*model.PropertyField, error) {
	return p.api.UpdatePropertyField(groupID, field)
}

// DeletePropertyField deletes a property field (soft delete).
//
// Returns an error if the field has active linked dependents. Unlink or
// delete dependent fields first.
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

// GetPropertyFieldOptions returns one page of a property field's options,
// ordered by creation time and continuing after the option the cursor names.
// The page includes options inherited from a linked template, flagged
// read_only, and each option carries the names of the options directly above it
// where the field's options form a hierarchy.
//
// A page holds the options this caller may see, which on a field whose options
// are access-controlled is fewer than the field has; a page shorter than the size
// asked for is the end of them.
//
// Minimum server version: 11.10
func (p *PropertyService) GetPropertyFieldOptions(groupID, fieldID string, cursorCreateAt int64, cursorID string, perPage int) ([]*model.PropertyFieldOption, error) {
	return p.api.GetPropertyFieldOptions(groupID, fieldID, cursorCreateAt, cursorID, perPage)
}

// CreatePropertyFieldOptions adds options to a property field. Each option may
// name the options it sits under, by name, in parents. Every option is created
// or none is.
//
// Minimum server version: 11.10
func (p *PropertyService) CreatePropertyFieldOptions(groupID, fieldID string, options []*model.PropertyFieldOption) ([]*model.PropertyFieldOption, error) {
	return p.api.CreatePropertyFieldOptions(groupID, fieldID, options)
}

// UpdatePropertyFieldOptions rewrites options a property field owns, each named
// by id. A part the payload leaves out is left as it was; parents, when given,
// replaces that option's parent set. Every option is updated or none is.
//
// Minimum server version: 11.10
func (p *PropertyService) UpdatePropertyFieldOptions(groupID, fieldID string, options []*model.PropertyFieldOption) ([]*model.PropertyFieldOption, error) {
	return p.api.UpdatePropertyFieldOptions(groupID, fieldID, options)
}

// DeletePropertyFieldOptions removes options a property field owns, named by id.
// The set is judged as a whole, so a whole branch of a hierarchy can be removed
// in one call.
//
// Minimum server version: 11.10
func (p *PropertyService) DeletePropertyFieldOptions(groupID, fieldID string, optionIDs []string) error {
	return p.api.DeletePropertyFieldOptions(groupID, fieldID, optionIDs)
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

// UpsertPropertyValuesWithOptions creates or updates multiple property values,
// declaring the scope the plugin is acting as for owner-based access control.
//
// Minimum server version: 11.10
func (p *PropertyService) UpsertPropertyValuesWithOptions(values []*model.PropertyValue, options model.PropertyRequestOptions) ([]*model.PropertyValue, error) {
	return p.api.UpsertPropertyValuesWithOptions(values, options)
}

// UpsertPropertyValueWithOptions creates or updates a single property value,
// declaring the scope the plugin is acting as for owner-based access control.
//
// Minimum server version: 11.10
func (p *PropertyService) UpsertPropertyValueWithOptions(value *model.PropertyValue, options model.PropertyRequestOptions) (*model.PropertyValue, error) {
	return p.api.UpsertPropertyValueWithOptions(value, options)
}

// DeletePropertyValueWithOptions deletes a property value, declaring the scope
// the plugin is acting as for owner-based access control.
//
// Minimum server version: 11.10
func (p *PropertyService) DeletePropertyValueWithOptions(groupID, valueID string, options model.PropertyRequestOptions) error {
	return p.api.DeletePropertyValueWithOptions(groupID, valueID, options)
}

// DeletePropertyValuesForTargetWithOptions deletes all property values for a
// target, declaring the scope the plugin is acting as. This is the
// deprovisioning entrypoint and needs only the target, no value objects.
//
// Minimum server version: 11.10
func (p *PropertyService) DeletePropertyValuesForTargetWithOptions(groupID, targetType, targetID string, options model.PropertyRequestOptions) error {
	return p.api.DeletePropertyValuesForTargetWithOptions(groupID, targetType, targetID, options)
}

// DeletePropertyValuesForFieldWithOptions deletes all property values for a
// field, declaring the scope the plugin is acting as for owner-based access
// control.
//
// Minimum server version: 11.10
func (p *PropertyService) DeletePropertyValuesForFieldWithOptions(groupID, fieldID string, options model.PropertyRequestOptions) error {
	return p.api.DeletePropertyValuesForFieldWithOptions(groupID, fieldID, options)
}
