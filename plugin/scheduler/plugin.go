// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package scheduler

import (
	"github.com/mattermost/mattermost-server/v6/app"
	tjobs "github.com/mattermost/mattermost-server/v6/jobs/interfaces"
)

type PluginsJobInterfaceImpl struct {
	App *app.App
}

func init() {
	app.RegisterJobsPluginsJobInterface(func(s *app.Server) tjobs.PluginsJobInterface {
		a := app.New(app.ServerConnector(s.Channels()))
		return &PluginsJobInterfaceImpl{a}
	})
}
