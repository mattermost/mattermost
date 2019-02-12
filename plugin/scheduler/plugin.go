// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package scheduler

import (
	"github.com/mattermost/mattermost-server/app"
	tjobs "github.com/mattermost/mattermost-server/jobs/interfaces"
)

type PluginsJobInterfaceImpl struct {
	App *app.App
}

func init() {
	app.RegisterJobsPluginsJobInterface(func(a *app.App) tjobs.PluginsJobInterface {
		return &PluginsJobInterfaceImpl{a}
	})
}
