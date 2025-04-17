// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"sort"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/pkg/errors"
)

const (
	CustomProfileAttributesFieldLimit = 20
)

var cpaGroupID string

// ToDo: we should explore moving this to the database cache layer
// instead of maintaining the ID cached at the application level
func (a *App) CpaGroupID() (string, error) {
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
	groupID, err := a.CpaGroupID()
	if err != nil {
		return nil, model.NewAppError("GetCPAField", "app.custom_profile_attributes.cpa_group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	field, err := a.Srv().propertyService.GetPropertyField(groupID, fieldID)
	if err != nil {
		switch {
		case errors.Is(err, sql.ErrNoRows):
			return nil, model.NewAppError("GetCPAField", "app.custom_profile_attributes.property_field_not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetCPAField", "app.custom_profile_attributes.get_property_field.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return field, nil
}

func (a *App) ListCPAFields() ([]*model.PropertyField, *model.AppError) {
	groupID, err := a.CpaGroupID()
	if err != nil {
		return nil, model.NewAppError("GetCPAFields", "app.custom_profile_attributes.cpa_group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	opts := model.PropertyFieldSearchOpts{
		GroupID: groupID,
		PerPage: CustomProfileAttributesFieldLimit,
	}

	fields, err := a.Srv().propertyService.SearchPropertyFields(groupID, "", opts)
	if err != nil {
		return nil, model.NewAppError("GetCPAFields", "app.custom_profile_attributes.search_property_fields.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	sort.Slice(fields, func(i, j int) bool {
		return model.CPASortOrder(fields[i]) < model.CPASortOrder(fields[j])
	})

	return fields, nil
}

func (a *App) CreateCPAField(field *model.CPAField) (*model.PropertyField, *model.AppError) {
	groupID, err := a.CpaGroupID()
	if err != nil {
		return nil, model.NewAppError("CreateCPAField", "app.custom_profile_attributes.cpa_group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	fieldCount, err := a.Srv().propertyService.CountActivePropertyFieldsForGroup(groupID)
	if err != nil {
		return nil, model.NewAppError("CreateCPAField", "app.custom_profile_attributes.count_property_fields.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if fieldCount >= CustomProfileAttributesFieldLimit {
		return nil, model.NewAppError("CreateCPAField", "app.custom_profile_attributes.limit_reached.app_error", nil, "", http.StatusUnprocessableEntity).Wrap(err)
	}

	field.GroupID = groupID

	if appErr := field.SanitizeAndValidate(); appErr != nil {
		return nil, appErr
	}

	newField, err := a.Srv().propertyService.CreatePropertyField(field.ToPropertyField())
	if err != nil {
		var appErr *model.AppError
		switch {
		case errors.As(err, &appErr):
			return nil, appErr
		default:
			return nil, model.NewAppError("CreateCPAField", "app.custom_profile_attributes.create_property_field.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	message := model.NewWebSocketEvent(model.WebsocketEventCPAFieldCreated, "", "", "", nil, "")
	message.Add("field", newField)
	a.Publish(message)

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

	cpaField, err := model.NewCPAFieldFromPropertyField(existingField)
	if err != nil {
		return nil, model.NewAppError("UpdateCPAField", "app.custom_profile_attributes.property_field_conversion.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if appErr := cpaField.SanitizeAndValidate(); appErr != nil {
		return nil, appErr
	}

	// we've already ensured that the field exists for the CPA group,
	// we don't need to specify the groupID for the update
	patchedField, err := a.Srv().propertyService.UpdatePropertyField("", cpaField.ToPropertyField())
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("UpdateCPAField", "app.custom_profile_attributes.property_field_not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("UpdateCPAField", "app.custom_profile_attributes.property_field_update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	message := model.NewWebSocketEvent(model.WebsocketEventCPAFieldUpdated, "", "", "", nil, "")
	message.Add("field", patchedField)
	a.Publish(message)

	return patchedField, nil
}

func (a *App) DeleteCPAField(id string) *model.AppError {
	groupID, err := a.CpaGroupID()
	if err != nil {
		return model.NewAppError("DeleteCPAField", "app.custom_profile_attributes.cpa_group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if err := a.Srv().propertyService.DeletePropertyField(groupID, id); err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return model.NewAppError("DeleteCPAField", "app.custom_profile_attributes.property_field_not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return model.NewAppError("DeleteCPAField", "app.custom_profile_attributes.property_field_delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	message := model.NewWebSocketEvent(model.WebsocketEventCPAFieldDeleted, "", "", "", nil, "")
	message.Add("field_id", id)
	a.Publish(message)

	return nil
}

func (a *App) ListCPAValues(userID string) ([]*model.PropertyValue, *model.AppError) {
	groupID, err := a.CpaGroupID()
	if err != nil {
		return nil, model.NewAppError("GetCPAFields", "app.custom_profile_attributes.cpa_group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	values, err := a.Srv().propertyService.SearchPropertyValues(groupID, userID, model.PropertyValueSearchOpts{
		PerPage: CustomProfileAttributesFieldLimit,
	})
	if err != nil {
		return nil, model.NewAppError("ListCPAValues", "app.custom_profile_attributes.list_property_values.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return values, nil
}

func (a *App) GetCPAValue(valueID string) (*model.PropertyValue, *model.AppError) {
	groupID, err := a.CpaGroupID()
	if err != nil {
		return nil, model.NewAppError("GetCPAValue", "app.custom_profile_attributes.cpa_group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	value, err := a.Srv().propertyService.GetPropertyValue(groupID, valueID)
	if err != nil {
		return nil, model.NewAppError("GetCPAValue", "app.custom_profile_attributes.get_property_field.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return value, nil
}

func (a *App) PatchCPAValue(userID string, fieldID string, value json.RawMessage, allowSynced bool) (*model.PropertyValue, *model.AppError) {
	values, appErr := a.PatchCPAValues(userID, map[string]json.RawMessage{fieldID: value}, allowSynced)
	if appErr != nil {
		return nil, appErr
	}

	return values[0], nil
}

func (a *App) PatchCPAValues(userID string, fieldValueMap map[string]json.RawMessage, allowSynced bool) ([]*model.PropertyValue, *model.AppError) {
	groupID, err := a.CpaGroupID()
	if err != nil {
		return nil, model.NewAppError("PatchCPAValues", "app.custom_profile_attributes.cpa_group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	valuesToUpdate := []*model.PropertyValue{}
	for fieldID, rawValue := range fieldValueMap {
		// make sure field exists in this group
		existingField, appErr := a.GetCPAField(fieldID)
		if appErr != nil {
			return nil, model.NewAppError("PatchCPAValues", "app.custom_profile_attributes.property_field_not_found.app_error", nil, "", http.StatusNotFound).Wrap(appErr)
		} else if existingField.DeleteAt > 0 {
			return nil, model.NewAppError("PatchCPAValues", "app.custom_profile_attributes.property_field_not_found.app_error", nil, "", http.StatusNotFound)
		}

		cpaField, fErr := model.NewCPAFieldFromPropertyField(existingField)
		if fErr != nil {
			return nil, model.NewAppError("PatchCPAValues", "app.custom_profile_attributes.property_field_conversion.app_error", nil, "", http.StatusInternalServerError).Wrap(fErr)
		}

		if !allowSynced && cpaField.IsSynced() {
			return nil, model.NewAppError("PatchCPAValues", "app.custom_profile_attributes.property_field_is_synced.app_error", nil, "", http.StatusBadRequest)
		}

		sanitizedValue, sErr := model.SanitizeAndValidatePropertyValue(cpaField, rawValue)
		if sErr != nil {
			return nil, model.NewAppError("PatchCPAValues", "app.custom_profile_attributes.validate_value.app_error", nil, "", http.StatusBadRequest).Wrap(sErr)
		}

		value := &model.PropertyValue{
			GroupID:    groupID,
			TargetType: "user",
			TargetID:   userID,
			FieldID:    fieldID,
			Value:      sanitizedValue,
		}
		valuesToUpdate = append(valuesToUpdate, value)
	}

	updatedValues, err := a.Srv().propertyService.UpsertPropertyValues(valuesToUpdate)
	if err != nil {
		return nil, model.NewAppError("PatchCPAValues", "app.custom_profile_attributes.property_value_upsert.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	updatedFieldValueMap := map[string]json.RawMessage{}
	for _, value := range updatedValues {
		updatedFieldValueMap[value.FieldID] = value.Value
	}

	message := model.NewWebSocketEvent(model.WebsocketEventCPAValuesUpdated, "", "", "", nil, "")
	message.Add("user_id", userID)
	message.Add("values", updatedFieldValueMap)
	a.Publish(message)

	return updatedValues, nil
}

func (a *App) DeleteCPAValues(userID string) *model.AppError {
	groupID, err := a.CpaGroupID()
	if err != nil {
		return model.NewAppError("DeleteCPAValues", "app.custom_profile_attributes.cpa_group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if err := a.Srv().propertyService.DeletePropertyValuesForTarget(groupID, "user", userID); err != nil {
		return model.NewAppError("DeleteCPAValues", "app.custom_profile_attributes.delete_property_values_for_user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	message := model.NewWebSocketEvent(model.WebsocketEventCPAValuesUpdated, "", "", "", nil, "")
	message.Add("user_id", userID)
	message.Add("values", map[string]json.RawMessage{})
	a.Publish(message)

	return nil
}
