// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package wsapi

import (
	"github.com/mattermost/mattermost-server/model"
)

func (api *API) InitWebrtc() {
	api.Router.Handle("webrtc", api.ApiWebSocketHandler(api.webrtcMessage))
}

func (api *API) webrtcMessage(req *model.WebSocketRequest) (map[string]interface{}, *model.AppError) {
	var ok bool
	var toUserId string
	if toUserId, ok = req.Data["to_user_id"].(string); !ok || len(toUserId) != 26 {
		return nil, NewInvalidWebSocketParamError(req.Action, "to_user_id")
	}

	event := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_WEBRTC, "", "", toUserId, nil)
	event.Data = req.Data
	api.App.Publish(event)

	return nil, nil
}
