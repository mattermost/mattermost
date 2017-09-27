// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package wsapi

import (
	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

func (api *API) InitSystem() {
	l4g.Debug(utils.T("wsapi.system.init.debug"))

	api.Router.Handle("ping", api.ApiWebSocketHandler(ping))
}

func ping(req *model.WebSocketRequest) (map[string]interface{}, *model.AppError) {
	data := map[string]interface{}{}
	data["text"] = "pong"
	data["version"] = model.CurrentVersion
	data["server_time"] = model.GetMillis()
	data["node_id"] = ""

	return data, nil
}
