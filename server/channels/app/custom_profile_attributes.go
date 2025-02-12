// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/pkg/errors"
)

const CustomProfileAttributesFieldLimit = 20

var cpaGroupID string

// ToDo: we should explore moving this to the database cache layer
// instead of maintaining the ID cached at the application level
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
		PerPage: CustomProfileAttributesFieldLimit,
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

	if appErr := validateCustomProfileAttributesField(field); appErr != nil {
		return nil, appErr
	}

	field.GroupID = groupID
	newField, err := a.Srv().propertyService.CreatePropertyField(field)
	if err != nil {
		var appErr *model.AppError
		switch {
		case errors.As(err, &appErr):
			return nil, appErr
		default:
			return nil, model.NewAppError("CreateCPAField", "app.custom_profile_attributes.create_property_field.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
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

	if appErr := validateCustomProfileAttributesField(existingField); appErr != nil {
		return nil, appErr
	}

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

func (a *App) GetCPAValue(valueID string) (*model.PropertyValue, *model.AppError) {
	groupID, err := a.cpaGroupID()
	if err != nil {
		return nil, model.NewAppError("GetCPAValue", "app.custom_profile_attributes.cpa_group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	value, err := a.Srv().propertyService.GetPropertyValue(valueID)
	if err != nil {
		return nil, model.NewAppError("GetCPAValue", "app.custom_profile_attributes.get_property_field.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if value.GroupID != groupID {
		return nil, model.NewAppError("GetCPAValue", "app.custom_profile_attributes.property_field_not_found.app_error", nil, "", http.StatusNotFound)
	}

	return value, nil
}

func (a *App) PatchCPAValue(userID string, fieldID string, value json.RawMessage) (*model.PropertyValue, *model.AppError) {
	groupID, err := a.cpaGroupID()
	if err != nil {
		return nil, model.NewAppError("PatchCPAValues", "app.custom_profile_attributes.cpa_group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// make sure field exists in this group
	existingField, appErr := a.GetCPAField(fieldID)
	if appErr != nil {
		return nil, model.NewAppError("PatchCPAValue", "app.custom_profile_attributes.property_field_not_found.app_error", nil, "", http.StatusNotFound).Wrap(appErr)
	} else if existingField.DeleteAt > 0 {
		return nil, model.NewAppError("PatchCPAValue", "app.custom_profile_attributes.property_field_not_found.app_error", nil, "", http.StatusNotFound)
	}

	existingValues, appErr := a.ListCPAValues(userID)
	if appErr != nil {
		return nil, model.NewAppError("PatchCPAValue", "app.custom_profile_attributes.property_value_list.app_error", nil, "", http.StatusNotFound).Wrap(err)
	}
	var existingValue *model.PropertyValue
	for key, value := range existingValues {
		if value.FieldID == fieldID {
			existingValue = existingValues[key]
			break
		}
	}

	if existingValue != nil {
		existingValue.Value = value
		_, err = a.ch.srv.propertyService.UpdatePropertyValue(existingValue)
		if err != nil {
			return nil, model.NewAppError("PatchCPAValue", "app.custom_profile_attributes.property_value_update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	} else {
		propertyValue := &model.PropertyValue{
			GroupID:    groupID,
			TargetType: "user",
			TargetID:   userID,
			FieldID:    fieldID,
			Value:      value,
		}
		existingValue, err = a.ch.srv.propertyService.CreatePropertyValue(propertyValue)
		if err != nil {
			return nil, model.NewAppError("PatchCPAValue", "app.custom_profile_attributes.property_value_creation.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return existingValue, nil
}

func validateCustomProfileAttributesField(field *model.PropertyField) *model.AppError {
	if field.Attrs == nil {
		field.Attrs = model.StringInterface{}
	}

	switch field.Type {
	case model.PropertyFieldTypeText:
		if valueType, ok := field.Attrs[model.CustomProfileAttributesPropertyAttrsValueType]; ok {
			valueTypeStr, ok := valueType.(string)
			if !ok {
				return model.NewAppError("CreateCPAField", "app.custom_profile_attributes.not_string_value_type.app_error", nil, "", http.StatusUnprocessableEntity)
			}
			valueTypeStr = strings.TrimSpace(valueTypeStr)
			if !model.IsKnownCustomProfilteAttributesValueType(valueTypeStr) {
				return model.NewAppError("CreateCPAField", "app.custom_profile_attributes.unknown_value_type.app_error", map[string]any{"ValueType": valueTypeStr}, "", http.StatusUnprocessableEntity)
			}

			field.Attrs[model.CustomProfileAttributesPropertyAttrsValueType] = valueTypeStr
		}

	case model.PropertyFieldTypeSelect, model.PropertyFieldTypeMultiselect:
		if options, ok := field.Attrs[model.CustomProfileAttributesPropertyAttrsOptions]; ok {
			var finalOptions model.CustomProfileAttributesSelectOptions
			optionsArr, ok := options.([]any)
			if !ok {
				return model.NewAppError("CreateCPAField", "app.custom_profile_attributes.not_array_options.app_error", nil, "", http.StatusUnprocessableEntity)
			}
			for i, option := range optionsArr {
				optionMap, ok := option.(map[string]any)
				if !ok {
					return model.NewAppError("CreateCPAField", "app.custom_profile_attributes.not_map_option.app_error", map[string]any{"Index": i}, "", http.StatusUnprocessableEntity)
				}
				option := model.NewCustomProfileAttributesSelectOptionFromMap(optionMap)
				finalOptions = append(finalOptions, option)
			}
			if err := finalOptions.IsValid(); err != nil {
				return model.NewAppError("CreateCPAField", "app.custom_profile_attributes.invalid_options.app_error", nil, "", http.StatusUnprocessableEntity).Wrap(err)
			}
			field.Attrs[model.CustomProfileAttributesPropertyAttrsOptions] = finalOptions
		}
	}

	visibility := model.CustomProfileAttributesVisibilityDefault
	if visibilityAttr, ok := field.Attrs[model.CustomProfileAttributesPropertyAttrsVisibility]; ok {
		if visibilityStr, ok := visibilityAttr.(string); ok {
			visibilityStr = strings.TrimSpace(visibilityStr)
			if !model.IsKnownCustomProfilteAttributesVisibility(visibilityStr) {
				return model.NewAppError("CreateCPAField", "app.custom_profile_attributes.unknown_visibility.app_error", map[string]any{"Visibility": visibilityStr}, "", http.StatusUnprocessableEntity)
			}
			visibility = visibilityStr
		}
	}
	field.Attrs[model.CustomProfileAttributesPropertyAttrsVisibility] = visibility

	return nil
}
