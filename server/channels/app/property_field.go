// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// CreatePropertyField creates a new property field.
func (a *App) CreatePropertyField(rctx request.CTX, field *model.PropertyField) (*model.PropertyField, *model.AppError) {
	if field == nil {
		return nil, model.NewAppError("CreatePropertyField", "app.property.invalid_input.app_error", nil, "property field is required", http.StatusBadRequest)
	}

	createdField, err := a.Srv().propertyService.CreatePropertyField(rctx, field)
	if err != nil {
		var appErr *model.AppError
		if errors.As(err, &appErr) {
			return nil, appErr
		}
		return nil, model.NewAppError("CreatePropertyField", "app.property.create_field.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return createdField, nil
}

// GetPropertyField retrieves a property field by group ID and field ID.
func (a *App) GetPropertyField(rctx request.CTX, groupID, fieldID string) (*model.PropertyField, *model.AppError) {
	field, err := a.Srv().propertyService.GetPropertyField(rctx, groupID, fieldID)
	if err != nil {
		return nil, model.NewAppError("GetPropertyField", "app.property.get_field.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return field, nil
}

// GetPropertyFields retrieves multiple property fields by their IDs.
func (a *App) GetPropertyFields(rctx request.CTX, groupID string, ids []string) ([]*model.PropertyField, *model.AppError) {
	fields, err := a.Srv().propertyService.GetPropertyFields(rctx, groupID, ids)
	if err != nil {
		return nil, model.NewAppError("GetPropertyFields", "app.property.get_fields.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return fields, nil
}

// GetPropertyFieldByName retrieves a property field by name within a group and target.
func (a *App) GetPropertyFieldByName(rctx request.CTX, groupID, targetID, name string) (*model.PropertyField, *model.AppError) {
	field, err := a.Srv().propertyService.GetPropertyFieldByName(rctx, groupID, targetID, name)
	if err != nil {
		return nil, model.NewAppError("GetPropertyFieldByName", "app.property.get_field_by_name.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return field, nil
}

// SearchPropertyFields searches for property fields matching the given options.
func (a *App) SearchPropertyFields(rctx request.CTX, groupID string, opts model.PropertyFieldSearchOpts) ([]*model.PropertyField, *model.AppError) {
	fields, err := a.Srv().propertyService.SearchPropertyFields(rctx, groupID, opts)
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

	updatedField, err := a.Srv().propertyService.UpdatePropertyField(rctx, groupID, field)
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

	updatedFields, err := a.Srv().propertyService.UpdatePropertyFields(rctx, groupID, fields)
	if err != nil {
		return nil, model.NewAppError("UpdatePropertyFields", "app.property.update_fields.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return updatedFields, nil
}

// DeletePropertyField deletes a property field.
func (a *App) DeletePropertyField(rctx request.CTX, groupID, fieldID string) *model.AppError {
	if err := a.Srv().propertyService.DeletePropertyField(rctx, groupID, fieldID); err != nil {
		return model.NewAppError("DeletePropertyField", "app.property.delete_field.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

// CountPropertyFieldsForGroup counts property fields for a group.
func (a *App) CountPropertyFieldsForGroup(rctx request.CTX, groupID string, includeDeleted bool) (int64, *model.AppError) {
	var count int64
	var err error
	if includeDeleted {
		count, err = a.Srv().propertyService.CountAllPropertyFieldsForGroup(rctx, groupID)
	} else {
		count, err = a.Srv().propertyService.CountActivePropertyFieldsForGroup(rctx, groupID)
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
		count, err = a.Srv().propertyService.CountAllPropertyFieldsForTarget(rctx, groupID, targetType, targetID)
	} else {
		count, err = a.Srv().propertyService.CountActivePropertyFieldsForTarget(rctx, groupID, targetType, targetID)
	}

	if err != nil {
		return 0, model.NewAppError("CountPropertyFieldsForTarget", "app.property.count_fields_for_target.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return count, nil
}
