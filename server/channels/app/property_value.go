// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// CreatePropertyValue creates a new property value.
func (a *App) CreatePropertyValue(rctx request.CTX, value *model.PropertyValue) (*model.PropertyValue, *model.AppError) {
	if value == nil {
		return nil, model.NewAppError("CreatePropertyValue", "app.property.invalid_input.app_error", nil, "property value is required", http.StatusBadRequest)
	}

	createdValue, err := a.Srv().propertyService.CreatePropertyValue(rctx, value)
	if err != nil {
		return nil, model.NewAppError("CreatePropertyValue", "app.property.create_value.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return createdValue, nil
}

// CreatePropertyValues creates multiple property values.
func (a *App) CreatePropertyValues(rctx request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, *model.AppError) {
	if len(values) == 0 {
		return nil, model.NewAppError("CreatePropertyValues", "app.property.invalid_input.app_error", nil, "property values are required", http.StatusBadRequest)
	}

	createdValues, err := a.Srv().propertyService.CreatePropertyValues(rctx, values)
	if err != nil {
		return nil, model.NewAppError("CreatePropertyValues", "app.property.create_values.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return createdValues, nil
}

// GetPropertyValue retrieves a property value by group ID and value ID.
func (a *App) GetPropertyValue(rctx request.CTX, groupID, valueID string) (*model.PropertyValue, *model.AppError) {
	value, err := a.Srv().propertyService.GetPropertyValue(rctx, groupID, valueID)
	if err != nil {
		return nil, model.NewAppError("GetPropertyValue", "app.property.get_value.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return value, nil
}

// GetPropertyValues retrieves multiple property values by their IDs.
func (a *App) GetPropertyValues(rctx request.CTX, groupID string, ids []string) ([]*model.PropertyValue, *model.AppError) {
	values, err := a.Srv().propertyService.GetPropertyValues(rctx, groupID, ids)
	if err != nil {
		return nil, model.NewAppError("GetPropertyValues", "app.property.get_values.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return values, nil
}

// SearchPropertyValues searches for property values matching the given options.
func (a *App) SearchPropertyValues(rctx request.CTX, groupID string, opts model.PropertyValueSearchOpts) ([]*model.PropertyValue, *model.AppError) {
	values, err := a.Srv().propertyService.SearchPropertyValues(rctx, groupID, opts)
	if err != nil {
		return nil, model.NewAppError("SearchPropertyValues", "app.property.search_values.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return values, nil
}

// UpdatePropertyValue updates an existing property value.
func (a *App) UpdatePropertyValue(rctx request.CTX, groupID string, value *model.PropertyValue) (*model.PropertyValue, *model.AppError) {
	if value == nil {
		return nil, model.NewAppError("UpdatePropertyValue", "app.property.invalid_input.app_error", nil, "property value is required", http.StatusBadRequest)
	}

	updatedValue, err := a.Srv().propertyService.UpdatePropertyValue(rctx, groupID, value)
	if err != nil {
		return nil, model.NewAppError("UpdatePropertyValue", "app.property.update_value.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return updatedValue, nil
}

// UpdatePropertyValues updates multiple property values.
func (a *App) UpdatePropertyValues(rctx request.CTX, groupID string, values []*model.PropertyValue) ([]*model.PropertyValue, *model.AppError) {
	if len(values) == 0 {
		return nil, model.NewAppError("UpdatePropertyValues", "app.property.invalid_input.app_error", nil, "property values are required", http.StatusBadRequest)
	}

	updatedValues, err := a.Srv().propertyService.UpdatePropertyValues(rctx, groupID, values)
	if err != nil {
		return nil, model.NewAppError("UpdatePropertyValues", "app.property.update_values.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return updatedValues, nil
}

// UpsertPropertyValue creates or updates a property value.
func (a *App) UpsertPropertyValue(rctx request.CTX, value *model.PropertyValue) (*model.PropertyValue, *model.AppError) {
	if value == nil {
		return nil, model.NewAppError("UpsertPropertyValue", "app.property.invalid_input.app_error", nil, "property value is required", http.StatusBadRequest)
	}

	upsertedValue, err := a.Srv().propertyService.UpsertPropertyValue(rctx, value)
	if err != nil {
		return nil, model.NewAppError("UpsertPropertyValue", "app.property.upsert_value.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return upsertedValue, nil
}

// UpsertPropertyValues creates or updates multiple property values.
func (a *App) UpsertPropertyValues(rctx request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, *model.AppError) {
	if len(values) == 0 {
		return nil, model.NewAppError("UpsertPropertyValues", "app.property.invalid_input.app_error", nil, "property values are required", http.StatusBadRequest)
	}

	upsertedValues, err := a.Srv().propertyService.UpsertPropertyValues(rctx, values)
	if err != nil {
		return nil, model.NewAppError("UpsertPropertyValues", "app.property.upsert_values.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return upsertedValues, nil
}

// DeletePropertyValue deletes a property value.
func (a *App) DeletePropertyValue(rctx request.CTX, groupID, valueID string) *model.AppError {
	if err := a.Srv().propertyService.DeletePropertyValue(rctx, groupID, valueID); err != nil {
		return model.NewAppError("DeletePropertyValue", "app.property.delete_value.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

// DeletePropertyValuesForTarget deletes all property values for a target.
func (a *App) DeletePropertyValuesForTarget(rctx request.CTX, groupID, targetType, targetID string) *model.AppError {
	if err := a.Srv().propertyService.DeletePropertyValuesForTarget(rctx, groupID, targetType, targetID); err != nil {
		return model.NewAppError("DeletePropertyValuesForTarget", "app.property.delete_values_for_target.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

// DeletePropertyValuesForField deletes all property values for a field.
func (a *App) DeletePropertyValuesForField(rctx request.CTX, groupID, fieldID string) *model.AppError {
	if err := a.Srv().propertyService.DeletePropertyValuesForField(rctx, groupID, fieldID); err != nil {
		return model.NewAppError("DeletePropertyValuesForField", "app.property.delete_values_for_field.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}
