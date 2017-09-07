// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package wsapi

import (
	"github.com/mattermost/mattermost-server/app"
)

func InitRouter() {
	app.Global().Srv.WebSocketRouter = app.NewWebSocketRouter()
}

func InitApi() {
	InitUser()
	InitSystem()
	InitStatus()
	InitWebrtc()

	app.HubStart()
}
