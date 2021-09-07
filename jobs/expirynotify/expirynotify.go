// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package expirynotify

import (
	"github.com/mattermost/mattermost-server/v6/app"
	tjobs "github.com/mattermost/mattermost-server/v6/jobs/interfaces"
)

type ExpiryNotifyJobInterfaceImpl struct {
	App *app.App
}

func init() {
	app.RegisterJobsExpiryNotifyJobInterface(func(s *app.Server) tjobs.ExpiryNotifyJobInterface {
		a := app.New(app.ServerConnector(s))
		return &ExpiryNotifyJobInterfaceImpl{a}
	})
}
