// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package wsapi

import (
	"github.com/mattermost/mattermost-server/v6/app"
	"github.com/mattermost/mattermost-server/v6/model"
)

func (api *API) initSubscription() {
	api.Router.Handle(model.WebsocketEventSubscribe, api.APIWebSocketHandler(api.subscribe))
	api.Router.Handle(model.WebsocketEventUnsubscribe, api.APIWebSocketHandler(api.unsubscribe))
}

func (api *API) subscribe(req *model.WebSocketRequest, conn *app.WebConn) (map[string]interface{}, *model.AppError) {
	subscriptionID, err := subjectIDFromRequest(req)
	if err != nil {
		return nil, err
	}

	conn.Subscribe(subscriptionID)

	return nil, nil
}

func (api *API) unsubscribe(req *model.WebSocketRequest, conn *app.WebConn) (map[string]interface{}, *model.AppError) {
	subscriptionID, err := subjectIDFromRequest(req)
	if err != nil {
		return nil, err
	}

	conn.Unsubscribe(subscriptionID)

	return nil, nil
}

func subjectIDFromRequest(req *model.WebSocketRequest) (model.WebsocketSubjectID, *model.AppError) {
	const paramKey = "subscription_id"

	paramVal, has := req.Data[paramKey]
	if !has {
		return "", NewInvalidWebSocketParamError(req.Action, paramKey)
	}

	id, ok := paramVal.(model.WebsocketSubjectID)
	if !ok || !id.IsValid() {
		return "", NewInvalidWebSocketParamError(req.Action, paramKey)
	}

	return id, nil
}
