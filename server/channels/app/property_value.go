// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
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

func (a *App) SearchPropertyValues(groupID string, opts model.PropertyValueSearchOpts) ([]*model.PropertyValue, *model.AppError) {
	values, err := a.Srv().propertyAccessService.propertyService.SearchPropertyValues(groupID, opts)
	if err != nil {
		return nil, model.NewAppError("SearchPropertyValues", "app.property_value.search.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return values, nil
}

func (a *App) UpsertPropertyValues(rctx request.CTX, values []*model.PropertyValue, objectType, targetID, connectionID string) ([]*model.PropertyValue, *model.AppError) {
	result, err := a.Srv().propertyAccessService.propertyService.UpsertPropertyValues(values)
	if err != nil {
		return nil, model.NewAppError("UpsertPropertyValues", "app.property_value.upsert.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
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
