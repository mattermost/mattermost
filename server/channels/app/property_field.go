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

func (a *App) CreatePropertyField(rctx request.CTX, field *model.PropertyField, bypassProtectedCheck bool, connectionID string) (*model.PropertyField, *model.AppError) {
	if !bypassProtectedCheck && field.Protected {
		return nil, model.NewAppError(
			"CreatePropertyField",
			"app.property_field.create.protected.app_error",
			nil,
			"cannot create protected field",
			http.StatusBadRequest,
		)
	}

	created, err := a.Srv().propertyAccessService.propertyService.CreatePropertyField(field)
	if err != nil {
		return nil, model.NewAppError("CreatePropertyField", "app.property_field.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	a.publishPropertyFieldEvent(rctx, model.WebsocketEventPropertyFieldCreated, created, connectionID)

	return created, nil
}

func (a *App) GetPropertyField(groupID, id string) (*model.PropertyField, *model.AppError) {
	field, err := a.Srv().propertyAccessService.propertyService.GetPropertyField(groupID, id)
	if err != nil {
		return nil, model.NewAppError("GetPropertyField", "app.property_field.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return field, nil
}

func (a *App) GetPropertyFields(groupID string, ids []string) ([]*model.PropertyField, *model.AppError) {
	fields, err := a.Srv().propertyAccessService.propertyService.GetPropertyFields(groupID, ids)
	if err != nil {
		var mismatchErr *store.ErrResultsMismatch
		if errors.As(err, &mismatchErr) {
			return nil, model.NewAppError("GetPropertyFields", "app.property_field.get_many.results_mismatch.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		}
		return nil, model.NewAppError("GetPropertyFields", "app.property_field.get_many.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return fields, nil
}

func (a *App) GetPropertyFieldByName(groupID, targetID, name string) (*model.PropertyField, *model.AppError) {
	field, err := a.Srv().propertyAccessService.propertyService.GetPropertyFieldByName(groupID, targetID, name)
	if err != nil {
		return nil, model.NewAppError("GetPropertyFieldByName", "app.property_field.get_by_name.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return field, nil
}

func (a *App) CountActivePropertyFieldsForGroup(groupID string) (int64, *model.AppError) {
	count, err := a.Srv().propertyAccessService.propertyService.CountActivePropertyFieldsForGroup(groupID)
	if err != nil {
		return 0, model.NewAppError("CountActivePropertyFieldsForGroup", "app.property_field.count_active_for_group.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return count, nil
}

func (a *App) CountAllPropertyFieldsForGroup(groupID string) (int64, *model.AppError) {
	count, err := a.Srv().propertyAccessService.propertyService.CountAllPropertyFieldsForGroup(groupID)
	if err != nil {
		return 0, model.NewAppError("CountAllPropertyFieldsForGroup", "app.property_field.count_all_for_group.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return count, nil
}

func (a *App) CountActivePropertyFieldsForTarget(groupID, targetType, targetID string) (int64, *model.AppError) {
	count, err := a.Srv().propertyAccessService.propertyService.CountActivePropertyFieldsForTarget(groupID, targetType, targetID)
	if err != nil {
		return 0, model.NewAppError("CountActivePropertyFieldsForTarget", "app.property_field.count_active_for_target.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return count, nil
}

func (a *App) CountAllPropertyFieldsForTarget(groupID, targetType, targetID string) (int64, *model.AppError) {
	count, err := a.Srv().propertyAccessService.propertyService.CountAllPropertyFieldsForTarget(groupID, targetType, targetID)
	if err != nil {
		return 0, model.NewAppError("CountAllPropertyFieldsForTarget", "app.property_field.count_all_for_target.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return count, nil
}

func (a *App) SearchPropertyFields(groupID string, opts model.PropertyFieldSearchOpts) ([]*model.PropertyField, *model.AppError) {
	fields, err := a.Srv().propertyAccessService.propertyService.SearchPropertyFields(groupID, opts)
	if err != nil {
		return nil, model.NewAppError("SearchPropertyFields", "app.property_field.search.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return fields, nil
}

func (a *App) UpdatePropertyField(rctx request.CTX, groupID string, field *model.PropertyField, bypassProtectedCheck bool, connectionID string) (*model.PropertyField, *model.AppError) {
	fields, err := a.UpdatePropertyFields(rctx, groupID, []*model.PropertyField{field}, bypassProtectedCheck, connectionID)
	if err != nil {
		return nil, err
	}

	return fields[0], nil
}

func (a *App) UpdatePropertyFields(rctx request.CTX, groupID string, fields []*model.PropertyField, bypassProtectedCheck bool, connectionID string) ([]*model.PropertyField, *model.AppError) {
	if !bypassProtectedCheck && len(fields) > 0 {
		ids := make([]string, len(fields))
		for i, f := range fields {
			ids[i] = f.ID
		}

		existingFields, err := a.Srv().propertyAccessService.propertyService.GetPropertyFields(groupID, ids)
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

	updated, err := a.Srv().propertyAccessService.propertyService.UpdatePropertyFields(groupID, fields)
	if err != nil {
		return nil, model.NewAppError("UpdatePropertyFields", "app.property_field.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	for _, field := range updated {
		a.publishPropertyFieldEvent(rctx, model.WebsocketEventPropertyFieldUpdated, field, connectionID)
	}

	return updated, nil
}

func (a *App) DeletePropertyField(rctx request.CTX, groupID, id string, bypassProtectedCheck bool, connectionID string) *model.AppError {
	existing, err := a.Srv().propertyAccessService.propertyService.GetPropertyField(groupID, id)
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

	if err := a.Srv().propertyAccessService.propertyService.DeletePropertyField(groupID, id); err != nil {
		return model.NewAppError("DeletePropertyField", "app.property_field.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	teamID, channelID, ok := propertyFieldBroadcastParams(rctx, existing)
	if ok && existing.IsPSAv2() {
		message := model.NewWebSocketEvent(model.WebsocketEventPropertyFieldDeleted, teamID, channelID, "", nil, connectionID)
		message.Add("field_id", existing.ID)
		message.Add("object_type", existing.ObjectType)
		a.Publish(message)
	}

	return nil
}
