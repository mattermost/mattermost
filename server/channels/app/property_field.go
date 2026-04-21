// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func propertyFieldBroadcastParams(rctx request.CTX, field *model.PropertyField) (teamID, channelID string, ok bool) {
	switch field.TargetType {
	case "team":
		return field.TargetID, "", true
	case "channel":
		return "", field.TargetID, true
	case "system":
		return "", "", true
	default:
		rctx.Logger().Warn(
			"Unrecognized property field TargetType, skipping broadcast",
			mlog.String("target_type", field.TargetType),
			mlog.String("field_id", field.ID),
		)
		return "", "", false
	}
}

func (a *App) publishPropertyFieldEvent(rctx request.CTX, eventType model.WebsocketEventType, field *model.PropertyField, connectionID string) {
	if field == nil || field.IsPSAv1() {
		return
	}
	teamID, channelID, ok := propertyFieldBroadcastParams(rctx, field)
	if !ok {
		return
	}
	fieldJSON, err := json.Marshal(field)
	if err != nil {
		rctx.Logger().Warn("Failed to encode property field to JSON", mlog.Err(err))
		return
	}
	message := model.NewWebSocketEvent(eventType, teamID, channelID, "", nil, connectionID)
	message.Add("property_field", string(fieldJSON))
	message.Add("object_type", field.ObjectType)
	a.Publish(message)
}

// CreatePropertyField creates a new property field.
func (a *App) CreatePropertyField(rctx request.CTX, field *model.PropertyField, bypassProtectedCheck bool, connectionID string) (*model.PropertyField, *model.AppError) {
	if field == nil {
		return nil, model.NewAppError("CreatePropertyField", "app.property_field.invalid_input.app_error", nil, "property field is required", http.StatusBadRequest)
	}

	if !bypassProtectedCheck && field.Protected {
		return nil, model.NewAppError(
			"CreatePropertyField",
			"app.property_field.create.protected.app_error",
			nil,
			"cannot create protected field",
			http.StatusBadRequest,
		)
	}

	createdField, err := a.Srv().propertyService.CreatePropertyField(rctx, field)
	if err != nil {
		var appErr *model.AppError
		if errors.As(err, &appErr) {
			return nil, appErr
		}
		return nil, model.NewAppError("CreatePropertyField", "app.property_field.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	a.publishPropertyFieldEvent(rctx, model.WebsocketEventPropertyFieldCreated, createdField, connectionID)

	return createdField, nil
}

// GetPropertyField retrieves a property field by group ID and field ID.
func (a *App) GetPropertyField(rctx request.CTX, groupID, fieldID string) (*model.PropertyField, *model.AppError) {
	field, err := a.Srv().propertyService.GetPropertyField(rctx, groupID, fieldID)
	if err != nil {
		return nil, model.NewAppError("GetPropertyField", "app.property_field.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return field, nil
}

// GetPropertyFields retrieves multiple property fields by their IDs.
func (a *App) GetPropertyFields(rctx request.CTX, groupID string, ids []string) ([]*model.PropertyField, *model.AppError) {
	fields, err := a.Srv().propertyService.GetPropertyFields(rctx, groupID, ids)
	if err != nil {
		var resultsMismatchErr *store.ErrResultsMismatch
		if errors.As(err, &resultsMismatchErr) {
			return nil, model.NewAppError("GetPropertyFields", "app.property_field.get_many.fields_not_found.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		}
		return nil, model.NewAppError("GetPropertyFields", "app.property_field.get_many.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return fields, nil
}

// GetPropertyFieldByName retrieves a property field by name within a group and target.
func (a *App) GetPropertyFieldByName(rctx request.CTX, groupID, targetID, name string) (*model.PropertyField, *model.AppError) {
	field, err := a.Srv().propertyService.GetPropertyFieldByName(rctx, groupID, targetID, name)
	if err != nil {
		return nil, model.NewAppError("GetPropertyFieldByName", "app.property_field.get_by_name.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return field, nil
}

// SearchPropertyFields searches for property fields matching the given options.
func (a *App) SearchPropertyFields(rctx request.CTX, groupID string, opts model.PropertyFieldSearchOpts) ([]*model.PropertyField, *model.AppError) {
	fields, err := a.Srv().propertyService.SearchPropertyFields(rctx, groupID, opts)
	if err != nil {
		return nil, model.NewAppError("SearchPropertyFields", "app.property_field.search.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return fields, nil
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
		return 0, model.NewAppError("CountPropertyFieldsForGroup", "app.property_field.count_for_group.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
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
		return 0, model.NewAppError("CountPropertyFieldsForTarget", "app.property_field.count_for_target.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return count, nil
}

// UpdatePropertyField updates an existing property field.
func (a *App) UpdatePropertyField(rctx request.CTX, groupID string, field *model.PropertyField, bypassProtectedCheck bool, connectionID string) (*model.PropertyField, *model.AppError) {
	fields, err := a.UpdatePropertyFields(rctx, groupID, []*model.PropertyField{field}, bypassProtectedCheck, connectionID)
	if err != nil {
		return nil, err
	}

	return fields[0], nil
}

// UpdatePropertyFields updates multiple property fields.
func (a *App) UpdatePropertyFields(rctx request.CTX, groupID string, fields []*model.PropertyField, bypassProtectedCheck bool, connectionID string) ([]*model.PropertyField, *model.AppError) {
	if len(fields) == 0 {
		return nil, model.NewAppError("UpdatePropertyFields", "app.property_field.invalid_input.app_error", nil, "property fields are required", http.StatusBadRequest)
	}

	if !bypassProtectedCheck {
		ids := make([]string, len(fields))
		for i, f := range fields {
			ids[i] = f.ID
		}

		existingFields, err := a.Srv().propertyService.GetPropertyFields(rctx, groupID, ids)
		if err != nil {
			return nil, model.NewAppError("UpdatePropertyFields", "app.property_field.update.get_existing.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
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

	updated, propagated, err := a.Srv().propertyService.UpdatePropertyFields(rctx, groupID, fields)
	if err != nil {
		var appErr *model.AppError
		if errors.As(err, &appErr) {
			return nil, appErr
		}
		var conflictErr *store.ErrConflict
		if errors.As(err, &conflictErr) {
			return nil, model.NewAppError("UpdatePropertyFields", "app.property_field.update.conflict.app_error", nil, "concurrent modification detected; please retry", http.StatusConflict).Wrap(err)
		}
		return nil, model.NewAppError("UpdatePropertyFields", "app.property_field.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Broadcast websocket events for both requested and propagated fields
	for _, field := range updated {
		a.publishPropertyFieldEvent(rctx, model.WebsocketEventPropertyFieldUpdated, field, connectionID)
	}
	for _, field := range propagated {
		a.publishPropertyFieldEvent(rctx, model.WebsocketEventPropertyFieldUpdated, field, "")
	}

	return updated, nil
}

// DeletePropertyField deletes a property field.
func (a *App) DeletePropertyField(rctx request.CTX, groupID, id string, bypassProtectedCheck bool, connectionID string) *model.AppError {
	existing, err := a.Srv().propertyService.GetPropertyField(rctx, groupID, id)
	if err != nil {
		return model.NewAppError("DeletePropertyField", "app.property_field.delete.get_existing.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if existing == nil {
		return model.NewAppError("DeletePropertyField", "app.property_field.delete.not_found.app_error", nil, "", http.StatusNotFound)
	}

	if !bypassProtectedCheck && existing.Protected {
		return model.NewAppError(
			"DeletePropertyField",
			"app.property_field.delete.protected.app_error",
			nil,
			"cannot delete protected field",
			http.StatusForbidden,
		)
	}

	if err := a.Srv().propertyService.DeletePropertyField(rctx, groupID, id); err != nil {
		var appErr *model.AppError
		if errors.As(err, &appErr) {
			return appErr
		}
		return model.NewAppError("DeletePropertyField", "app.property_field.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if existing.IsPSAv2() {
		teamID, channelID, ok := propertyFieldBroadcastParams(rctx, existing)
		if ok {
			message := model.NewWebSocketEvent(model.WebsocketEventPropertyFieldDeleted, teamID, channelID, "", nil, connectionID)
			message.Add("field_id", existing.ID)
			message.Add("object_type", existing.ObjectType)
			a.Publish(message)
		}
	}

	return nil
}
