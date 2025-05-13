package pluginapi

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

// PropertyService exposes methods to manipulate property fields.
type PropertyService struct {
	api plugin.API
}

// CreatePropertyField creates a new property field.
//
// Minimum server version: 10.8
func (p *PropertyService) CreatePropertyField(field *model.PropertyField) (*model.PropertyField, error) {
	result, appErr := p.api.CreatePropertyField(field)
	return result, normalizeAppErr(appErr)
}

// GetPropertyField gets a property field by groupID and fieldID.
//
// Minimum server version: 10.8
func (p *PropertyService) GetPropertyField(groupID, fieldID string) (*model.PropertyField, error) {
	result, appErr := p.api.GetPropertyField(groupID, fieldID)
	return result, normalizeAppErr(appErr)
}

// GetPropertyFields gets multiple property fields by groupID and a list of IDs.
//
// Minimum server version: 10.8
func (p *PropertyService) GetPropertyFields(groupID string, ids []string) ([]*model.PropertyField, error) {
	result, appErr := p.api.GetPropertyFields(groupID, ids)
	return result, normalizeAppErr(appErr)
}

// UpdatePropertyField updates an existing property field.
//
// Minimum server version: 10.8
func (p *PropertyService) UpdatePropertyField(groupID string, field *model.PropertyField) (*model.PropertyField, error) {
	result, appErr := p.api.UpdatePropertyField(groupID, field)
	return result, normalizeAppErr(appErr)
}

// DeletePropertyField deletes a property field (soft delete).
//
// Minimum server version: 10.8
func (p *PropertyService) DeletePropertyField(groupID, fieldID string) error {
	appErr := p.api.DeletePropertyField(groupID, fieldID)
	return normalizeAppErr(appErr)
}

// SearchPropertyFields searches for property fields with filtering options.
//
// Minimum server version: 10.8
func (p *PropertyService) SearchPropertyFields(groupID, targetID string, opts model.PropertyFieldSearchOpts) ([]*model.PropertyField, error) {
	result, appErr := p.api.SearchPropertyFields(groupID, targetID, opts)
	return result, normalizeAppErr(appErr)
}