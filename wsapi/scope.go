// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package wsapi

import (
	"github.com/mattermost/mattermost-server/v6/model"
)

func (api *API) InitScope() {
	api.Router.Handle("subscribe", api.APIWebSocketHandler(api.subscribeScope))
	api.Router.Handle("unsubscribe", api.APIWebSocketHandler(api.unsubscribeScope))
}

func (api *API) subscribeScope(req *model.WebSocketRequest) (map[string]interface{}, *model.AppError) {
	scopes, err := getScopes(req)
	if err != nil {
		return nil, err
	}

	// TODO Add some sort of permission check mechanism for subscribing to scopes
	// Maybe there needs to be a way to register scopes and permission checks?

	err = api.App.SubscribeWebsocketScopes(req.ConnectionID, scopes)

	return nil, err
}

func (api *API) unsubscribeScope(req *model.WebSocketRequest) (map[string]interface{}, *model.AppError) {
	scopes, err := getScopes(req)
	if err != nil {
		return nil, err
	}

	err = api.App.UnsubscribeWebsocketScopes(req.ConnectionID, scopes)

	return nil, err
}

func getScopes(req *model.WebSocketRequest) ([]string, *model.AppError) {
	if _, ok := req.Data["scopes"]; !ok {
		return nil, NewInvalidWebSocketParamError(req.Action, "scopes")
	}

	if _, ok := req.Data["scopes"].([]interface{}); !ok {
		return nil, NewInvalidWebSocketParamError(req.Action, "scopes")
	}

	scopes := make([]string, len(req.Data["scopes"].([]interface{})))
	for _, scope := range req.Data["scopes"].([]interface{}) {
		if _, ok := scope.(string); !ok {
			return nil, NewInvalidWebSocketParamError(req.Action, "scopes")
		}

		scopes = append(scopes, scope.(string))
	}

	return scopes, nil
}
