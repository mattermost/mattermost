// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package wsapi

import (
	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func InitUser() {
	l4g.Debug(utils.T("wsapi.user.init.debug"))

	app.Srv.WebSocketRouter.Handle("user_typing", ApiWebSocketHandler(userTyping))
}

func userTyping(req *model.WebSocketRequest) (map[string]interface{}, *model.AppError) {
	var ok bool
	var channelId string
	if channelId, ok = req.Data["channel_id"].(string); !ok || len(channelId) != 26 {
		return nil, NewInvalidWebSocketParamError(req.Action, "channel_id")
	}

	var parentId string
	if parentId, ok = req.Data["parent_id"].(string); !ok {
		parentId = ""
	}

	omitUsers := make(map[string]bool, 1)
	omitUsers[req.Session.UserId] = true

	event := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_TYPING, "", channelId, "", omitUsers)
	event.Add("parent_id", parentId)
	event.Add("user_id", req.Session.UserId)
	go app.Publish(event)

	return nil, nil
}
