// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"sort"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
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
		return nil, appErr
	}

	field, appErr := a.GetPropertyField(rctx, groupID, fieldID)
	if appErr != nil {
		if errors.Is(appErr, sql.ErrNoRows) {
			return nil, model.NewAppError("GetCPAField", "app.custom_profile_attributes.property_field_not_found.app_error", nil, "", http.StatusNotFound).Wrap(appErr)
		}
		return nil, appErr
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
		return nil, appErr
	}

	opts := model.PropertyFieldSearchOpts{
		GroupID:    groupID,
		ObjectType: model.PropertyFieldObjectTypeUser,
		PerPage:    200, // global limit for the protected_attributes group
	}

	fields, appErr := a.SearchPropertyFields(rctx, groupID, opts)
	if appErr != nil {
		return nil, appErr
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
		return nil, appErr
	}

	field.GroupID = groupID
	field.ObjectType = model.PropertyFieldObjectTypeUser
	field.TargetType = string(model.PropertyFieldTargetLevelSystem)

	if appErr = field.SanitizeAndValidate(); appErr != nil {
		return nil, appErr
	}

	// Permission levels are enforced by the attribute validation hook for the
	// protected_attributes group — no need to set them here.
	pf := field.ToPropertyField()

	newField, appErr := a.CreatePropertyField(rctx, pf, false, "")
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

	if err := existingField.Patch(patch); err != nil {
		return nil, model.NewAppError("PatchCPAField", "app.custom_profile_attributes.patch_field.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if appErr = existingField.SanitizeAndValidate(); appErr != nil {
		return nil, appErr
	}

	groupID, appErr := a.CpaGroupID()
	if appErr != nil {
		return nil, appErr
	}

	patchedField, appErr := a.UpdatePropertyField(rctx, groupID, existingField.ToPropertyField(), false, "")
	if appErr != nil {
		if errors.Is(appErr, sql.ErrNoRows) {
			return nil, model.NewAppError("PatchCPAField", "app.custom_profile_attributes.property_field_not_found.app_error", nil, "", http.StatusNotFound).Wrap(appErr)
		}
		return nil, appErr
	}

	cpaField, err := model.NewCPAFieldFromPropertyField(patchedField)
	if err != nil {
		return nil, model.NewAppError("PatchCPAField", "app.custom_profile_attributes.property_field_conversion.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	message := model.NewWebSocketEvent(model.WebsocketEventCPAFieldUpdated, "", "", "", nil, "")
	message.Add("field", cpaField)
	a.Publish(message)

	return cpaField, nil
}

func (a *App) DeleteCPAField(rctx request.CTX, id string) *model.AppError {
	groupID, appErr := a.CpaGroupID()
	if appErr != nil {
		return appErr
	}

	if appErr := a.DeletePropertyField(rctx, groupID, id, false, ""); appErr != nil {
		if errors.Is(appErr, sql.ErrNoRows) {
			return model.NewAppError("DeleteCPAField", "app.custom_profile_attributes.property_field_not_found.app_error", nil, "", http.StatusNotFound).Wrap(appErr)
		}
		return appErr
	}

	message := model.NewWebSocketEvent(model.WebsocketEventCPAFieldDeleted, "", "", "", nil, "")
	message.Add("field_id", id)
	a.Publish(message)

	return nil
}

func (a *App) ListCPAValues(rctx request.CTX, targetUserID string) ([]*model.PropertyValue, *model.AppError) {
	groupID, appErr := a.CpaGroupID()
	if appErr != nil {
		return nil, appErr
	}

	values, appErr := a.SearchPropertyValues(rctx, groupID, model.PropertyValueSearchOpts{
		TargetIDs: []string{targetUserID},
		PerPage:   200,
	})
	if appErr != nil {
		return nil, appErr
	}

	return values, nil
}

func (a *App) GetCPAValue(rctx request.CTX, valueID string) (*model.PropertyValue, *model.AppError) {
	groupID, appErr := a.CpaGroupID()
	if appErr != nil {
		return nil, appErr
	}

	value, appErr := a.GetPropertyValue(rctx, groupID, valueID)
	if appErr != nil {
		return nil, appErr
	}

	return value, nil
}

func (a *App) PatchCPAValue(rctx request.CTX, userID string, fieldID string, value json.RawMessage) (*model.PropertyValue, *model.AppError) {
	values, appErr := a.PatchCPAValues(rctx, userID, map[string]json.RawMessage{fieldID: value})
	if appErr != nil {
		return nil, appErr
	}

	if len(values) == 0 {
		return nil, model.NewAppError("PatchCPAValue", "app.custom_profile_attributes.property_value_upsert.app_error", nil, "upsert returned no results", http.StatusInternalServerError)
	}

	return values[0], nil
}

func (a *App) PatchCPAValues(rctx request.CTX, userID string, fieldValueMap map[string]json.RawMessage) ([]*model.PropertyValue, *model.AppError) {
	groupID, appErr := a.CpaGroupID()
	if appErr != nil {
		return nil, appErr
	}

	valuesToUpdate := []*model.PropertyValue{}
	for fieldID, rawValue := range fieldValueMap {
		// make sure field exists in this group and is not deleted
		cpaField, fieldErr := a.GetCPAField(rctx, fieldID)
		if fieldErr != nil {
			return nil, fieldErr
		} else if cpaField.DeleteAt > 0 {
			return nil, model.NewAppError("PatchCPAValues", "app.custom_profile_attributes.property_field_not_found.app_error", nil, "", http.StatusNotFound)
		}

		value := &model.PropertyValue{
			GroupID:    groupID,
			TargetType: model.PropertyValueTargetTypeUser,
			TargetID:   userID,
			FieldID:    fieldID,
			Value:      rawValue,
		}
		valuesToUpdate = append(valuesToUpdate, value)
	}

	updatedValues, appErr := a.UpsertPropertyValues(rctx, valuesToUpdate, "", "", "")
	if appErr != nil {
		return nil, appErr
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
		return appErr
	}

	if appErr := a.DeletePropertyValuesForTarget(rctx, groupID, "user", userID); appErr != nil {
		return appErr
	}

	message := model.NewWebSocketEvent(model.WebsocketEventCPAValuesUpdated, "", "", "", nil, "")
	message.Add("user_id", userID)
	message.Add("values", map[string]json.RawMessage{})
	a.Publish(message)

	return nil
}
