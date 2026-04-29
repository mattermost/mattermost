// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// This file implements the "User Attributes" feature (formerly "Custom
// Profile Attributes" / CPA). Internal identifiers retain the old naming
// for backward compatibility. See MM-68235.

package app

import (
	"encoding/json"
	"errors"
	"net/http"
	"sort"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

const (
	CustomProfileAttributesFieldLimit = 20
)

func (a *App) CpaGroupID() (string, *model.AppError) {
	group, appErr := a.GetPropertyGroup(nil, model.CustomProfileAttributesPropertyGroupName)
	if appErr != nil {
		return "", appErr
	}
	return group.ID, nil
}

func (a *App) GetCPAField(rctx request.CTX, fieldID string) (*model.CPAField, *model.AppError) {
	groupID, appErr := a.CpaGroupID()
	if appErr != nil {
		return nil, model.NewAppError("GetCPAField", "app.custom_profile_attributes.cpa_group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	field, appErr := a.GetPropertyField(rctx, groupID, fieldID)
	if appErr != nil {
		var notFoundErr *store.ErrNotFound
		if errors.As(appErr, &notFoundErr) {
			return nil, model.NewAppError("GetCPAField", "app.custom_profile_attributes.property_field_not_found.app_error", nil, "", http.StatusNotFound).Wrap(appErr)
		}
		return nil, model.NewAppError("GetCPAField", "app.custom_profile_attributes.get_property_field.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	cpaField, err := model.NewCPAFieldFromPropertyField(field)
	if err != nil {
		return nil, model.NewAppError("GetCPAField", "app.custom_profile_attributes.property_field_conversion.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return cpaField, nil
}

func (a *App) ListCPAFields(rctx request.CTX) ([]*model.CPAField, *model.AppError) {
	groupID, appErr := a.CpaGroupID()
	if appErr != nil {
		return nil, model.NewAppError("ListCPAFields", "app.custom_profile_attributes.cpa_group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	opts := model.PropertyFieldSearchOpts{
		GroupID: groupID,
		PerPage: CustomProfileAttributesFieldLimit,
	}

	fields, appErr := a.SearchPropertyFields(rctx, groupID, opts)
	if appErr != nil {
		return nil, model.NewAppError("ListCPAFields", "app.custom_profile_attributes.search_property_fields.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	// Convert PropertyFields to CPAFields
	cpaFields := make([]*model.CPAField, 0, len(fields))
	for _, field := range fields {
		cpaField, convErr := model.NewCPAFieldFromPropertyField(field)
		if convErr != nil {
			return nil, model.NewAppError("ListCPAFields", "app.custom_profile_attributes.property_field_conversion.app_error", nil, "", http.StatusInternalServerError).Wrap(convErr)
		}
		cpaFields = append(cpaFields, cpaField)
	}

	sort.Slice(cpaFields, func(i, j int) bool {
		return cpaFields[i].Attrs.SortOrder < cpaFields[j].Attrs.SortOrder
	})

	return cpaFields, nil
}

func (a *App) CreateCPAField(rctx request.CTX, field *model.CPAField) (*model.CPAField, *model.AppError) {
	groupID, appErr := a.CpaGroupID()
	if appErr != nil {
		return nil, model.NewAppError("CreateCPAField", "app.custom_profile_attributes.cpa_group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	fieldCount, appErr := a.CountPropertyFieldsForGroup(rctx, groupID, false)
	if appErr != nil {
		return nil, model.NewAppError("CreateCPAField", "app.custom_profile_attributes.count_property_fields.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	if fieldCount >= CustomProfileAttributesFieldLimit {
		return nil, model.NewAppError("CreateCPAField", "app.custom_profile_attributes.limit_reached.app_error", nil, "", http.StatusUnprocessableEntity)
	}

	field.GroupID = groupID

	if appErr = field.SanitizeAndValidate(); appErr != nil {
		return nil, appErr
	}

	newField, appErr := a.CreatePropertyField(rctx, field.ToPropertyField(), false, "")
	if appErr != nil {
		return nil, appErr
	}

	cpaField, err := model.NewCPAFieldFromPropertyField(newField)
	if err != nil {
		return nil, model.NewAppError("CreateCPAField", "app.custom_profile_attributes.property_field_conversion.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	message := model.NewWebSocketEvent(model.WebsocketEventCPAFieldCreated, "", "", "", nil, "")
	message.Add("field", cpaField)
	a.Publish(message)

	return cpaField, nil
}

func (a *App) PatchCPAField(rctx request.CTX, fieldID string, patch *model.PropertyFieldPatch) (*model.CPAField, *model.AppError) {
	existingField, appErr := a.GetCPAField(rctx, fieldID)
	if appErr != nil {
		return nil, appErr
	}

	shouldDeleteValues := false
	if patch.Type != nil && *patch.Type != existingField.Type {
		shouldDeleteValues = true
	}

	if err := existingField.Patch(patch); err != nil {
		return nil, model.NewAppError("PatchCPAField", "app.custom_profile_attributes.patch_field.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if appErr = existingField.SanitizeAndValidate(); appErr != nil {
		return nil, appErr
	}

	groupID, appErr := a.CpaGroupID()
	if appErr != nil {
		return nil, model.NewAppError("PatchCPAField", "app.custom_profile_attributes.cpa_group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	patchedField, appErr := a.UpdatePropertyField(rctx, groupID, existingField.ToPropertyField(), false, "")
	if appErr != nil {
		var notFoundErr *store.ErrNotFound
		if errors.As(appErr, &notFoundErr) {
			return nil, model.NewAppError("PatchCPAField", "app.custom_profile_attributes.property_field_not_found.app_error", nil, "", http.StatusNotFound).Wrap(appErr)
		}
		return nil, model.NewAppError("PatchCPAField", "app.custom_profile_attributes.property_field_update.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	cpaField, err := model.NewCPAFieldFromPropertyField(patchedField)
	if err != nil {
		return nil, model.NewAppError("PatchCPAField", "app.custom_profile_attributes.property_field_conversion.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if shouldDeleteValues {
		if dErr := a.DeletePropertyValuesForField(rctx, groupID, cpaField.ID); dErr != nil {
			a.Log().Error("Error deleting property values when updating field",
				mlog.String("fieldID", cpaField.ID),
				mlog.Err(dErr),
			)
		}
	}

	message := model.NewWebSocketEvent(model.WebsocketEventCPAFieldUpdated, "", "", "", nil, "")
	message.Add("field", cpaField)
	message.Add("delete_values", shouldDeleteValues)
	a.Publish(message)

	return cpaField, nil
}

func (a *App) DeleteCPAField(rctx request.CTX, id string) *model.AppError {
	groupID, appErr := a.CpaGroupID()
	if appErr != nil {
		return model.NewAppError("DeleteCPAField", "app.custom_profile_attributes.cpa_group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	if appErr := a.DeletePropertyField(rctx, groupID, id, false, ""); appErr != nil {
		var notFoundErr *store.ErrNotFound
		if errors.As(appErr, &notFoundErr) {
			return model.NewAppError("DeleteCPAField", "app.custom_profile_attributes.property_field_not_found.app_error", nil, "", http.StatusNotFound).Wrap(appErr)
		}
		return model.NewAppError("DeleteCPAField", "app.custom_profile_attributes.property_field_delete.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	message := model.NewWebSocketEvent(model.WebsocketEventCPAFieldDeleted, "", "", "", nil, "")
	message.Add("field_id", id)
	a.Publish(message)

	return nil
}

func (a *App) ListCPAValues(rctx request.CTX, targetUserID string) ([]*model.PropertyValue, *model.AppError) {
	groupID, appErr := a.CpaGroupID()
	if appErr != nil {
		return nil, model.NewAppError("ListCPAValues", "app.custom_profile_attributes.cpa_group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	values, appErr := a.SearchPropertyValues(rctx, groupID, model.PropertyValueSearchOpts{
		TargetIDs: []string{targetUserID},
		PerPage:   CustomProfileAttributesFieldLimit,
	})
	if appErr != nil {
		return nil, model.NewAppError("ListCPAValues", "app.custom_profile_attributes.list_property_values.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	return values, nil
}

func (a *App) GetCPAValue(rctx request.CTX, valueID string) (*model.PropertyValue, *model.AppError) {
	groupID, appErr := a.CpaGroupID()
	if appErr != nil {
		return nil, model.NewAppError("GetCPAValue", "app.custom_profile_attributes.cpa_group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	value, appErr := a.GetPropertyValue(rctx, groupID, valueID)
	if appErr != nil {
		return nil, model.NewAppError("GetCPAValue", "app.custom_profile_attributes.get_property_value.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	return value, nil
}

func (a *App) PatchCPAValue(rctx request.CTX, userID string, fieldID string, value json.RawMessage, allowSynced bool) (*model.PropertyValue, *model.AppError) {
	values, appErr := a.PatchCPAValues(rctx, userID, map[string]json.RawMessage{fieldID: value}, allowSynced)
	if appErr != nil {
		return nil, appErr
	}

	return values[0], nil
}

func (a *App) PatchCPAValues(rctx request.CTX, userID string, fieldValueMap map[string]json.RawMessage, allowSynced bool) ([]*model.PropertyValue, *model.AppError) {
	groupID, appErr := a.CpaGroupID()
	if appErr != nil {
		return nil, model.NewAppError("PatchCPAValues", "app.custom_profile_attributes.cpa_group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	valuesToUpdate := []*model.PropertyValue{}
	for fieldID, rawValue := range fieldValueMap {
		// make sure field exists in this group
		cpaField, fieldErr := a.GetCPAField(rctx, fieldID)
		if fieldErr != nil {
			return nil, model.NewAppError("PatchCPAValues", "app.custom_profile_attributes.property_field_not_found.app_error", nil, "", http.StatusNotFound).Wrap(fieldErr)
		} else if cpaField.DeleteAt > 0 {
			return nil, model.NewAppError("PatchCPAValues", "app.custom_profile_attributes.property_field_not_found.app_error", nil, "", http.StatusNotFound)
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
			TargetType: model.PropertyValueTargetTypeUser,
			TargetID:   userID,
			FieldID:    fieldID,
			Value:      sanitizedValue,
		}
		valuesToUpdate = append(valuesToUpdate, value)
	}

	updatedValues, appErr := a.UpsertPropertyValues(rctx, valuesToUpdate, "", "", "")
	if appErr != nil {
		return nil, model.NewAppError("PatchCPAValues", "app.custom_profile_attributes.property_value_upsert.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
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

func (a *App) DeleteCPAValues(rctx request.CTX, userID string) *model.AppError {
	groupID, appErr := a.CpaGroupID()
	if appErr != nil {
		return model.NewAppError("DeleteCPAValues", "app.custom_profile_attributes.cpa_group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	if appErr := a.DeletePropertyValuesForTarget(rctx, groupID, "user", userID); appErr != nil {
		return model.NewAppError("DeleteCPAValues", "app.custom_profile_attributes.delete_property_values_for_user.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	message := model.NewWebSocketEvent(model.WebsocketEventCPAValuesUpdated, "", "", "", nil, "")
	message.Add("user_id", userID)
	message.Add("values", map[string]json.RawMessage{})
	a.Publish(message)

	return nil
}
