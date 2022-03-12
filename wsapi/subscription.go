// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package wsapi

import (
	"fmt"

	"github.com/mattermost/mattermost-server/v6/app"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
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
		mlog.Debug("missing JSON field", mlog.String("key", paramKey))
		return "", NewInvalidWebSocketParamError(req.Action, paramKey)
	}

	id := model.WebsocketSubjectID(fmt.Sprintf("%s", paramVal))
	if !id.IsValid() {
		mlog.Debug("invalid JSON field", mlog.String("key", paramKey), mlog.Any("value", paramVal))
		return "", NewInvalidWebSocketParamError(req.Action, paramKey)
	}

	return id, nil
}
