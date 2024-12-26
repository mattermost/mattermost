// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/pkg/errors"
)

const CustomProfileAttributesFieldLimit = 20

var cpaGroupID string

func (a *App) cpaGroupID() (string, error) {
	if cpaGroupID != "" {
		return cpaGroupID, nil
	}

	cpaGroup, err := a.Srv().propertyService.RegisterPropertyGroup(model.CustomProfileAttributesPropertyGroupName)
	if err != nil {
		return "", errors.Wrap(err, "cannot register Custom Profile Attributes property group")
	}
	cpaGroupID = cpaGroup.ID

	return cpaGroupID, nil
}

func (a *App) GetCPAField(fieldID string) (*model.PropertyField, *model.AppError) {
	groupID, err := a.cpaGroupID()
	if err != nil {
		return nil, model.NewAppError("GetCPAField", "app.custom_profile_attributes.cpa_group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	field, err := a.Srv().propertyService.GetPropertyField(fieldID)
	if err != nil {
		return nil, model.NewAppError("GetCPAField", "app.custom_profile_attributes.get_property_field.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if field.GroupID != groupID {
		return nil, model.NewAppError("GetCPAField", "app.custom_profile_attributes.property_field_not_found.app_error", nil, "", http.StatusNotFound)
	}

	return field, nil
}

func (a *App) ListCPAFields() ([]*model.PropertyField, *model.AppError) {
	groupID, err := a.cpaGroupID()
	if err != nil {
		return nil, model.NewAppError("GetCPAFields", "app.custom_profile_attributes.cpa_group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	opts := model.PropertyFieldSearchOpts{
		GroupID: groupID,
		Page:    0,
		PerPage: 999999,
	}

	fields, err := a.Srv().propertyService.SearchPropertyFields(opts)
	if err != nil {
		return nil, model.NewAppError("GetCPAFields", "app.custom_profile_attributes.search_property_fields.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return fields, nil
}

func (a *App) CreateCPAField(field *model.PropertyField) (*model.PropertyField, *model.AppError) {
	groupID, err := a.cpaGroupID()
	if err != nil {
		return nil, model.NewAppError("CreateCPAField", "app.custom_profile_attributes.cpa_group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	existingFields, appErr := a.ListCPAFields()
	if appErr != nil {
		return nil, appErr
	}

	if len(existingFields) >= CustomProfileAttributesFieldLimit {
		return nil, model.NewAppError("CreateCPAField", "app.custom_profile_attributes.limit_reached.app_error", nil, "", http.StatusUnprocessableEntity).Wrap(err)
	}

	field.GroupID = groupID
	newField, err := a.Srv().propertyService.CreatePropertyField(field)
	if err != nil {
		return nil, model.NewAppError("CreateCPAField", "app.custom_profile_attributes.create_property_field.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return newField, nil
}

func (a *App) PatchCPAField(fieldID string, patch *model.PropertyFieldPatch) (*model.PropertyField, *model.AppError) {
	existingField, appErr := a.GetCPAField(fieldID)
	if appErr != nil {
		return nil, appErr
	}

	// custom profile attributes doesn't use targets
	patch.TargetID = nil
	patch.TargetType = nil
	existingField.Patch(patch)

	patchedField, err := a.Srv().propertyService.UpdatePropertyField(existingField)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("UpdateCPAField", "app.custom_profile_attributes.property_field_not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("UpdateCPAField", "app.custom_profile_attributes.property_field_update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return patchedField, nil
}

func (a *App) DeleteCPAField(id string) *model.AppError {
	groupID, err := a.cpaGroupID()
	if err != nil {
		return model.NewAppError("DeleteCPAField", "app.custom_profile_attributes.cpa_group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	existingField, err := a.Srv().propertyService.GetPropertyField(id)
	if err != nil {
		return model.NewAppError("DeleteCPAField", "app.custom_profile_attributes.get_property_field.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if existingField.GroupID != groupID {
		return model.NewAppError("DeleteCPAField", "app.custom_profile_attributes.property_field_not_found.app_error", nil, "", http.StatusNotFound)
	}

	if err := a.Srv().propertyService.DeletePropertyField(id); err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return model.NewAppError("DeleteCPAField", "app.custom_profile_attributes.property_field_not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return model.NewAppError("DeleteCPAField", "app.custom_profile_attributes.property_field_delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return nil
}

func (a *App) ListCPAValues(userID string) ([]*model.PropertyValue, *model.AppError) {
	groupID, err := a.cpaGroupID()
	if err != nil {
		return nil, model.NewAppError("GetCPAFields", "app.custom_profile_attributes.cpa_group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	opts := model.PropertyValueSearchOpts{
		GroupID:        groupID,
		TargetID:       userID,
		Page:           0,
		PerPage:        999999,
		IncludeDeleted: false,
	}
	fields, err := a.Srv().propertyService.SearchPropertyValues(opts)
	if err != nil {
		return nil, model.NewAppError("ListCPAValues", "app.custom_profile_attributes.list_property_values.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return fields, nil
}

func (a *App) PatchCPAValues(userID string, values map[string]string) *model.AppError {
	existingValues, err := a.ListCPAValues(userID)
	if err != nil {
		return model.NewAppError("SaveCPAValues", "app.custom_profile_attributes.listcpavalues.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	for key, value := range values {
		exists := false
		for _, currentValue := range existingValues {
			if currentValue.FieldID == key {
				if value == "" {
					appErr := a.ch.srv.propertyService.DeletePropertyValue(currentValue.ID)
					if appErr != nil {
						return model.NewAppError("SaveCPAValues", "app.custom_attributes.getProperties.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
					}
				} else {
					currentValue.Value = value
					_, appErr := a.ch.srv.propertyService.UpdatePropertyValue(currentValue)
					if appErr != nil {
						return model.NewAppError("SaveCPAValues", "app.custom_attributes.getProperties.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
					}
				}
				exists = true
				break
			}
		}
		if !exists {
			groupID, err := a.cpaGroupID()
			if err != nil {
				return model.NewAppError("SaveCPAValues", "app.custom_profile_attributes.cpa_group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}

			propertyValue := &model.PropertyValue{
				GroupID:    groupID,
				TargetType: "user",
				TargetID:   userID,
				FieldID:    key,
				Value:      value,
			}

			_, appErr := a.ch.srv.propertyService.CreatePropertyValue(propertyValue)
			if appErr != nil {
				return model.NewAppError("SaveCPAValues", "app.custom_attributes.createPropertyValue.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
		}
	}
	return nil
}
