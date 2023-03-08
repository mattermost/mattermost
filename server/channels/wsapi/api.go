// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package wsapi

import (
	"github.com/mattermost/mattermost-server/v6/server/channels/app"
	"github.com/mattermost/mattermost-server/v6/server/channels/app/platform"
)

type API struct {
	App    *app.App
	Router *platform.WebSocketRouter
}

func Init(s *app.Server) {
	a := app.New(app.ServerConnector(s.Channels()))
	router := s.Platform().WebSocketRouter
	api := &API{
		App:    a,
		Router: router,
	}

	api.InitUser()
	api.InitSystem()
	api.InitStatus()
}
