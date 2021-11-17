// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package wsapi

import (
	"github.com/mattermost/mattermost-server/v6/app"
)

type API struct {
	App    *app.App
	Router *app.WebSocketRouter
}

func Init(s *app.Server) {
	a := app.New(app.ServerConnector(s.Channels()))
	api := &API{
		App:    a,
		Router: s.WebSocketRouter,
	}

	api.InitUser()
	api.InitSystem()
	api.InitStatus()
}
