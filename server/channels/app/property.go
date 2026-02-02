// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// Property Group Methods

// RegisterPropertyGroup registers a new property group with the given name.
func (a *App) RegisterPropertyGroup(rctx request.CTX, name string) (*model.PropertyGroup, *model.AppError) {
	group, err := a.Srv().propertyService.RegisterPropertyGroup(name)
	if err != nil {
		return nil, model.NewAppError("RegisterPropertyGroup", "app.property.register_group.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return group, nil
}

// GetPropertyGroup retrieves a property group by name.
func (a *App) GetPropertyGroup(rctx request.CTX, name string) (*model.PropertyGroup, *model.AppError) {
	group, err := a.Srv().propertyService.GetPropertyGroup(name)
	if err != nil {
		return nil, model.NewAppError("GetPropertyGroup", "app.property.get_group.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return group, nil
}

// Property Field Methods

// CreatePropertyField creates a new property field.
func (a *App) CreatePropertyField(rctx request.CTX, field *model.PropertyField) (*model.PropertyField, *model.AppError) {
	if field == nil {
		return nil, model.NewAppError("CreatePropertyField", "app.property.invalid_input.app_error", nil, "property field is required", http.StatusBadRequest)
	}

	createdField, err := a.Srv().propertyService.CreatePropertyField(field)
	if err != nil {
		return nil, model.NewAppError("CreatePropertyField", "app.property.create_field.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return createdField, nil
}

// GetPropertyField retrieves a property field by group ID and field ID.
func (a *App) GetPropertyField(rctx request.CTX, groupID, fieldID string) (*model.PropertyField, *model.AppError) {
	field, err := a.Srv().propertyService.GetPropertyField(groupID, fieldID)
	if err != nil {
		return nil, model.NewAppError("GetPropertyField", "app.property.get_field.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return field, nil
}

// GetPropertyFields retrieves multiple property fields by their IDs.
func (a *App) GetPropertyFields(rctx request.CTX, groupID string, ids []string) ([]*model.PropertyField, *model.AppError) {
	fields, err := a.Srv().propertyService.GetPropertyFields(groupID, ids)
	if err != nil {
		return nil, model.NewAppError("GetPropertyFields", "app.property.get_fields.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return fields, nil
}

// GetPropertyFieldByName retrieves a property field by name within a group and target.
func (a *App) GetPropertyFieldByName(rctx request.CTX, groupID, targetID, name string) (*model.PropertyField, *model.AppError) {
	field, err := a.Srv().propertyService.GetPropertyFieldByName(groupID, targetID, name)
	if err != nil {
		return nil, model.NewAppError("GetPropertyFieldByName", "app.property.get_field_by_name.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return field, nil
}

// SearchPropertyFields searches for property fields matching the given options.
func (a *App) SearchPropertyFields(rctx request.CTX, groupID string, opts model.PropertyFieldSearchOpts) ([]*model.PropertyField, *model.AppError) {
	fields, err := a.Srv().propertyService.SearchPropertyFields(groupID, opts)
	if err != nil {
		return nil, model.NewAppError("SearchPropertyFields", "app.property.search_fields.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return fields, nil
}

// UpdatePropertyField updates an existing property field.
func (a *App) UpdatePropertyField(rctx request.CTX, groupID string, field *model.PropertyField) (*model.PropertyField, *model.AppError) {
	if field == nil {
		return nil, model.NewAppError("UpdatePropertyField", "app.property.invalid_input.app_error", nil, "property field is required", http.StatusBadRequest)
	}

	updatedField, err := a.Srv().propertyService.UpdatePropertyField(groupID, field)
	if err != nil {
		return nil, model.NewAppError("UpdatePropertyField", "app.property.update_field.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return updatedField, nil
}

// UpdatePropertyFields updates multiple property fields.
func (a *App) UpdatePropertyFields(rctx request.CTX, groupID string, fields []*model.PropertyField) ([]*model.PropertyField, *model.AppError) {
	if len(fields) == 0 {
		return nil, model.NewAppError("UpdatePropertyFields", "app.property.invalid_input.app_error", nil, "property fields are required", http.StatusBadRequest)
	}

	updatedFields, err := a.Srv().propertyService.UpdatePropertyFields(groupID, fields)
	if err != nil {
		return nil, model.NewAppError("UpdatePropertyFields", "app.property.update_fields.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return updatedFields, nil
}

// DeletePropertyField deletes a property field.
func (a *App) DeletePropertyField(rctx request.CTX, groupID, fieldID string) *model.AppError {
	if err := a.Srv().propertyService.DeletePropertyField(groupID, fieldID); err != nil {
		return model.NewAppError("DeletePropertyField", "app.property.delete_field.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

// CountPropertyFieldsForGroup counts property fields for a group.
func (a *App) CountPropertyFieldsForGroup(rctx request.CTX, groupID string, includeDeleted bool) (int64, *model.AppError) {
	var count int64
	var err error

	if includeDeleted {
		count, err = a.Srv().propertyService.CountAllPropertyFieldsForGroup(groupID)
	} else {
		count, err = a.Srv().propertyService.CountActivePropertyFieldsForGroup(groupID)
	}

	if err != nil {
		return 0, model.NewAppError("CountPropertyFieldsForGroup", "app.property.count_fields_for_group.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return count, nil
}

// CountPropertyFieldsForTarget counts property fields for a specific target.
func (a *App) CountPropertyFieldsForTarget(rctx request.CTX, groupID, targetType, targetID string, includeDeleted bool) (int64, *model.AppError) {
	var count int64
	var err error

	if includeDeleted {
		count, err = a.Srv().propertyService.CountAllPropertyFieldsForTarget(groupID, targetType, targetID)
	} else {
		count, err = a.Srv().propertyService.CountActivePropertyFieldsForTarget(groupID, targetType, targetID)
	}

	if err != nil {
		return 0, model.NewAppError("CountPropertyFieldsForTarget", "app.property.count_fields_for_target.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return count, nil
}

// Property Value Methods

// CreatePropertyValue creates a new property value.
func (a *App) CreatePropertyValue(rctx request.CTX, value *model.PropertyValue) (*model.PropertyValue, *model.AppError) {
	if value == nil {
		return nil, model.NewAppError("CreatePropertyValue", "app.property.invalid_input.app_error", nil, "property value is required", http.StatusBadRequest)
	}

	createdValue, err := a.Srv().propertyService.CreatePropertyValue(value)
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

	createdValues, err := a.Srv().propertyService.CreatePropertyValues(values)
	if err != nil {
		return nil, model.NewAppError("CreatePropertyValues", "app.property.create_values.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return createdValues, nil
}

// GetPropertyValue retrieves a property value by group ID and value ID.
func (a *App) GetPropertyValue(rctx request.CTX, groupID, valueID string) (*model.PropertyValue, *model.AppError) {
	value, err := a.Srv().propertyService.GetPropertyValue(groupID, valueID)
	if err != nil {
		return nil, model.NewAppError("GetPropertyValue", "app.property.get_value.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return value, nil
}

// GetPropertyValues retrieves multiple property values by their IDs.
func (a *App) GetPropertyValues(rctx request.CTX, groupID string, ids []string) ([]*model.PropertyValue, *model.AppError) {
	values, err := a.Srv().propertyService.GetPropertyValues(groupID, ids)
	if err != nil {
		return nil, model.NewAppError("GetPropertyValues", "app.property.get_values.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return values, nil
}

// SearchPropertyValues searches for property values matching the given options.
func (a *App) SearchPropertyValues(rctx request.CTX, groupID string, opts model.PropertyValueSearchOpts) ([]*model.PropertyValue, *model.AppError) {
	values, err := a.Srv().propertyService.SearchPropertyValues(groupID, opts)
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

	updatedValue, err := a.Srv().propertyService.UpdatePropertyValue(groupID, value)
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

	updatedValues, err := a.Srv().propertyService.UpdatePropertyValues(groupID, values)
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

	upsertedValue, err := a.Srv().propertyService.UpsertPropertyValue(value)
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

	upsertedValues, err := a.Srv().propertyService.UpsertPropertyValues(values)
	if err != nil {
		return nil, model.NewAppError("UpsertPropertyValues", "app.property.upsert_values.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return upsertedValues, nil
}

// DeletePropertyValue deletes a property value.
func (a *App) DeletePropertyValue(rctx request.CTX, groupID, valueID string) *model.AppError {
	if err := a.Srv().propertyService.DeletePropertyValue(groupID, valueID); err != nil {
		return model.NewAppError("DeletePropertyValue", "app.property.delete_value.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

// DeletePropertyValuesForTarget deletes all property values for a target.
func (a *App) DeletePropertyValuesForTarget(rctx request.CTX, groupID, targetType, targetID string) *model.AppError {
	if err := a.Srv().propertyService.DeletePropertyValuesForTarget(groupID, targetType, targetID); err != nil {
		return model.NewAppError("DeletePropertyValuesForTarget", "app.property.delete_values_for_target.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

// DeletePropertyValuesForField deletes all property values for a field.
func (a *App) DeletePropertyValuesForField(rctx request.CTX, groupID, fieldID string) *model.AppError {
	if err := a.Srv().propertyService.DeletePropertyValuesForField(groupID, fieldID); err != nil {
		return model.NewAppError("DeletePropertyValuesForField", "app.property.delete_values_for_field.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}
