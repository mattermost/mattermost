// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
)

func (a *App) CreatePropertyField(field *model.PropertyField, bypassProtectedCheck bool) (*model.PropertyField, error) {
	if !bypassProtectedCheck && field.Protected {
		return nil, model.NewAppError(
			"CreatePropertyField",
			"app.property_field.create.protected.app_error",
			nil,
			"cannot create protected field",
			http.StatusBadRequest,
		)
	}

	return a.Srv().propertyService.CreatePropertyField(field)
}

func (a *App) GetPropertyField(groupID, id string) (*model.PropertyField, error) {
	return a.Srv().propertyService.GetPropertyField(groupID, id)
}

func (a *App) GetPropertyFields(groupID string, ids []string) ([]*model.PropertyField, error) {
	return a.Srv().propertyService.GetPropertyFields(groupID, ids)
}

func (a *App) GetPropertyFieldByName(groupID, targetID, name string) (*model.PropertyField, error) {
	return a.Srv().propertyService.GetPropertyFieldByName(groupID, targetID, name)
}

func (a *App) CountActivePropertyFieldsForGroup(groupID string) (int64, error) {
	return a.Srv().propertyService.CountActivePropertyFieldsForGroup(groupID)
}

func (a *App) CountAllPropertyFieldsForGroup(groupID string) (int64, error) {
	return a.Srv().propertyService.CountAllPropertyFieldsForGroup(groupID)
}

func (a *App) CountActivePropertyFieldsForTarget(groupID, targetType, targetID string) (int64, error) {
	return a.Srv().propertyService.CountActivePropertyFieldsForTarget(groupID, targetType, targetID)
}

func (a *App) CountAllPropertyFieldsForTarget(groupID, targetType, targetID string) (int64, error) {
	return a.Srv().propertyService.CountAllPropertyFieldsForTarget(groupID, targetType, targetID)
}

func (a *App) SearchPropertyFields(groupID string, opts model.PropertyFieldSearchOpts) ([]*model.PropertyField, error) {
	return a.Srv().propertyService.SearchPropertyFields(groupID, opts)
}

func (a *App) UpdatePropertyField(groupID string, field *model.PropertyField, bypassProtectedCheck bool) (*model.PropertyField, error) {
	fields, err := a.UpdatePropertyFields(groupID, []*model.PropertyField{field}, bypassProtectedCheck)
	if err != nil {
		return nil, err
	}

	return fields[0], nil
}

func (a *App) UpdatePropertyFields(groupID string, fields []*model.PropertyField, bypassProtectedCheck bool) ([]*model.PropertyField, error) {
	if !bypassProtectedCheck && len(fields) > 0 {
		ids := make([]string, len(fields))
		for i, f := range fields {
			ids[i] = f.ID
		}

		existingFields, err := a.Srv().propertyService.GetPropertyFields(groupID, ids)
		if err != nil {
			return nil, err
		}

		for _, existing := range existingFields {
			if existing.Protected {
				return nil, model.NewAppError(
					"UpdatePropertyFields",
					"app.property_field.update.protected.app_error",
					map[string]any{"FieldID": existing.ID},
					"cannot update protected field",
					http.StatusForbidden,
				)
			}
		}
	}

	return a.Srv().propertyService.UpdatePropertyFields(groupID, fields)
}

func (a *App) DeletePropertyField(groupID, id string, bypassProtectedCheck bool) error {
	if !bypassProtectedCheck {
		existing, err := a.Srv().propertyService.GetPropertyField(groupID, id)
		if err != nil {
			return err
		}
		if existing.Protected {
			return model.NewAppError(
				"DeletePropertyField",
				"app.property_field.delete.protected.app_error",
				nil,
				"cannot delete protected field",
				http.StatusForbidden,
			)
		}
	}

	return a.Srv().propertyService.DeletePropertyField(groupID, id)
}
