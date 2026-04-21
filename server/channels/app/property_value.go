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

func (a *App) resolveValueBroadcastParams(rctx request.CTX, objectType, targetID string) (teamID, channelID string, err *model.AppError) {
	switch objectType {
	case model.PropertyFieldObjectTypePost:
		post, appErr := a.GetSinglePost(rctx, targetID, false)
		if appErr != nil {
			return "", "", appErr
		}
		return "", post.ChannelId, nil
	case model.PropertyFieldObjectTypeChannel:
		return "", targetID, nil
	case model.PropertyFieldObjectTypeUser:
		return "", "", nil // system-wide
	default:
		return "", "", model.NewAppError(
			"resolveValueBroadcastParams",
			"app.property_value.resolve_broadcast_params.unknown_object_type.app_error",
			map[string]any{"ObjectType": objectType},
			"unrecognized object type",
			http.StatusBadRequest,
		)
	}
}

// CreatePropertyValue creates a new property value.
func (a *App) CreatePropertyValue(rctx request.CTX, value *model.PropertyValue) (*model.PropertyValue, *model.AppError) {
	if value == nil {
		return nil, model.NewAppError("CreatePropertyValue", "app.property_value.invalid_input.app_error", nil, "property value is required", http.StatusBadRequest)
	}
	value.Value = model.SanitizePropertyValue(value.Value)

	createdValue, err := a.Srv().propertyService.CreatePropertyValue(rctx, value)
	if err != nil {
		if appErr := mapPropertyServiceError("CreatePropertyValue", err); appErr != nil {
			return nil, appErr
		}
		return nil, model.NewAppError("CreatePropertyValue", "app.property_value.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return createdValue, nil
}

// CreatePropertyValues creates multiple property values.
func (a *App) CreatePropertyValues(rctx request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, *model.AppError) {
	if len(values) == 0 {
		return nil, model.NewAppError("CreatePropertyValues", "app.property_value.invalid_input.app_error", nil, "property values are required", http.StatusBadRequest)
	}
	for _, v := range values {
		v.Value = model.SanitizePropertyValue(v.Value)
	}

	createdValues, err := a.Srv().propertyService.CreatePropertyValues(rctx, values)
	if err != nil {
		if appErr := mapPropertyServiceError("CreatePropertyValues", err); appErr != nil {
			return nil, appErr
		}
		return nil, model.NewAppError("CreatePropertyValues", "app.property_value.create_many.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return createdValues, nil
}

// GetPropertyValue retrieves a property value by group ID and value ID.
func (a *App) GetPropertyValue(rctx request.CTX, groupID, valueID string) (*model.PropertyValue, *model.AppError) {
	value, err := a.Srv().propertyService.GetPropertyValue(rctx, groupID, valueID)
	if err != nil {
		var notFoundErr *store.ErrNotFound
		if errors.As(err, &notFoundErr) {
			return nil, model.NewAppError("GetPropertyValue", "app.property_value.not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
		}
		if appErr := mapPropertyServiceError("GetPropertyValue", err); appErr != nil {
			return nil, appErr
		}
		return nil, model.NewAppError("GetPropertyValue", "app.property_value.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return value, nil
}

// GetPropertyValues retrieves multiple property values by their IDs.
func (a *App) GetPropertyValues(rctx request.CTX, groupID string, ids []string) ([]*model.PropertyValue, *model.AppError) {
	values, err := a.Srv().propertyService.GetPropertyValues(rctx, groupID, ids)
	if err != nil {
		if appErr := mapPropertyServiceError("GetPropertyValues", err); appErr != nil {
			return nil, appErr
		}
		return nil, model.NewAppError("GetPropertyValues", "app.property_value.get_many.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return values, nil
}

// SearchPropertyValues searches for property values matching the given options.
func (a *App) SearchPropertyValues(rctx request.CTX, groupID string, opts model.PropertyValueSearchOpts) ([]*model.PropertyValue, *model.AppError) {
	values, err := a.Srv().propertyService.SearchPropertyValues(rctx, groupID, opts)
	if err != nil {
		if appErr := mapPropertyServiceError("SearchPropertyValues", err); appErr != nil {
			return nil, appErr
		}
		return nil, model.NewAppError("SearchPropertyValues", "app.property_value.search.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return values, nil
}

// UpdatePropertyValue updates an existing property value.
func (a *App) UpdatePropertyValue(rctx request.CTX, groupID string, value *model.PropertyValue) (*model.PropertyValue, *model.AppError) {
	if value == nil {
		return nil, model.NewAppError("UpdatePropertyValue", "app.property_value.invalid_input.app_error", nil, "property value is required", http.StatusBadRequest)
	}
	value.Value = model.SanitizePropertyValue(value.Value)

	updatedValue, err := a.Srv().propertyService.UpdatePropertyValue(rctx, groupID, value)
	if err != nil {
		if appErr := mapPropertyServiceError("UpdatePropertyValue", err); appErr != nil {
			return nil, appErr
		}
		return nil, model.NewAppError("UpdatePropertyValue", "app.property_value.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return updatedValue, nil
}

// UpdatePropertyValues updates multiple property values.
func (a *App) UpdatePropertyValues(rctx request.CTX, groupID string, values []*model.PropertyValue) ([]*model.PropertyValue, *model.AppError) {
	if len(values) == 0 {
		return nil, model.NewAppError("UpdatePropertyValues", "app.property_value.invalid_input.app_error", nil, "property values are required", http.StatusBadRequest)
	}
	for _, v := range values {
		v.Value = model.SanitizePropertyValue(v.Value)
	}

	updatedValues, err := a.Srv().propertyService.UpdatePropertyValues(rctx, groupID, values)
	if err != nil {
		if appErr := mapPropertyServiceError("UpdatePropertyValues", err); appErr != nil {
			return nil, appErr
		}
		return nil, model.NewAppError("UpdatePropertyValues", "app.property_value.update_many.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return updatedValues, nil
}

// UpsertPropertyValue creates or updates a property value.
func (a *App) UpsertPropertyValue(rctx request.CTX, value *model.PropertyValue) (*model.PropertyValue, *model.AppError) {
	if value == nil {
		return nil, model.NewAppError("UpsertPropertyValue", "app.property_value.invalid_input.app_error", nil, "property value is required", http.StatusBadRequest)
	}
	value.Value = model.SanitizePropertyValue(value.Value)

	upsertedValue, err := a.Srv().propertyService.UpsertPropertyValue(rctx, value)
	if err != nil {
		if appErr := mapPropertyServiceError("UpsertPropertyValue", err); appErr != nil {
			return nil, appErr
		}
		return nil, model.NewAppError("UpsertPropertyValue", "app.property_value.upsert.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return upsertedValue, nil
}

// UpsertPropertyValues creates or updates multiple property values.
// When objectType is non-empty, WebSocket events are broadcast to notify
// clients of the updated values.
func (a *App) UpsertPropertyValues(rctx request.CTX, values []*model.PropertyValue, objectType, targetID, connectionID string) ([]*model.PropertyValue, *model.AppError) {
	if len(values) == 0 {
		return nil, model.NewAppError("UpsertPropertyValues", "app.property_value.invalid_input.app_error", nil, "property values are required", http.StatusBadRequest)
	}
	for _, v := range values {
		v.Value = model.SanitizePropertyValue(v.Value)
	}

	result, err := a.Srv().propertyService.UpsertPropertyValues(rctx, values)
	if err != nil {
		if appErr := mapPropertyServiceError("UpsertPropertyValues", err); appErr != nil {
			return nil, appErr
		}
		return nil, model.NewAppError("UpsertPropertyValues", "app.property_value.upsert_many.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Only publish websocket events for PSAv2 properties (those with an ObjectType)
	if objectType != "" {
		teamID, channelID, appErr := a.resolveValueBroadcastParams(rctx, objectType, targetID)
		if appErr != nil {
			rctx.Logger().Warn("Failed to resolve broadcast params for property values", mlog.Err(appErr))
		} else {
			valuesJSON, jsonErr := json.Marshal(result)
			if jsonErr != nil {
				rctx.Logger().Warn("Failed to encode property values to JSON", mlog.Err(jsonErr))
			} else {
				message := model.NewWebSocketEvent(model.WebsocketEventPropertyValuesUpdated, teamID, channelID, "", nil, connectionID)
				message.Add("object_type", objectType)
				message.Add("target_id", targetID)
				message.Add("values", string(valuesJSON))
				a.Publish(message)
			}
		}
	}

	return result, nil
}

// DeletePropertyValue deletes a property value and broadcasts a property_values_updated event.
func (a *App) DeletePropertyValue(rctx request.CTX, groupID, valueID string) *model.AppError {
	value, appErr := a.GetPropertyValue(rctx, groupID, valueID)
	if appErr != nil {
		return appErr
	}

	if err := a.Srv().propertyService.DeletePropertyValue(rctx, groupID, valueID); err != nil {
		if mappedErr := mapPropertyServiceError("DeletePropertyValue", err); mappedErr != nil {
			return mappedErr
		}
		return model.NewAppError("DeletePropertyValue", "app.property_value.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	teamID, channelID, appErr := a.resolveValueBroadcastParams(rctx, value.TargetType, value.TargetID)
	if appErr != nil {
		rctx.Logger().Warn("Failed to resolve broadcast params for property value deletion", mlog.Err(appErr))
		return nil
	}

	deleted := &model.PropertyValue{
		TargetID:   value.TargetID,
		TargetType: value.TargetType,
		GroupID:    value.GroupID,
		FieldID:    value.FieldID,
	}
	valuesJSON, jsonErr := json.Marshal([]*model.PropertyValue{deleted})
	if jsonErr != nil {
		rctx.Logger().Warn("Failed to encode deleted property value to JSON", mlog.Err(jsonErr))
		return nil
	}

	message := model.NewWebSocketEvent(model.WebsocketEventPropertyValuesUpdated, teamID, channelID, "", nil, "")
	message.Add("object_type", value.TargetType)
	message.Add("target_id", value.TargetID)
	message.Add("values", string(valuesJSON))
	a.Publish(message)
	return nil
}

// DeletePropertyValuesForTarget deletes all property values for a target and broadcasts a property_values_updated event.
func (a *App) DeletePropertyValuesForTarget(rctx request.CTX, groupID, targetType, targetID string) *model.AppError {
	if err := a.Srv().propertyService.DeletePropertyValuesForTarget(rctx, groupID, targetType, targetID); err != nil {
		if appErr := mapPropertyServiceError("DeletePropertyValuesForTarget", err); appErr != nil {
			return appErr
		}
		return model.NewAppError("DeletePropertyValuesForTarget", "app.property_value.delete_for_target.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	teamID, channelID, appErr := a.resolveValueBroadcastParams(rctx, targetType, targetID)
	if appErr != nil {
		rctx.Logger().Warn("Failed to resolve broadcast params for property value deletion", mlog.Err(appErr))
		return nil
	}

	message := model.NewWebSocketEvent(model.WebsocketEventPropertyValuesUpdated, teamID, channelID, "", nil, "")
	message.Add("object_type", targetType)
	message.Add("target_id", targetID)
	message.Add("values", "[]")
	a.Publish(message)
	return nil
}

// DeletePropertyValuesForField deletes all property values for a field and broadcasts a property_values_updated event.
func (a *App) DeletePropertyValuesForField(rctx request.CTX, groupID, fieldID string) *model.AppError {
	if err := a.Srv().propertyService.DeletePropertyValuesForField(rctx, groupID, fieldID); err != nil {
		if appErr := mapPropertyServiceError("DeletePropertyValuesForField", err); appErr != nil {
			return appErr
		}
		return model.NewAppError("DeletePropertyValuesForField", "app.property_value.delete_for_field.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	message := model.NewWebSocketEvent(model.WebsocketEventPropertyValuesUpdated, "", "", "", nil, "")
	message.Add("field_id", fieldID)
	message.Add("values", "[]")
	a.Publish(message)
	return nil
}
