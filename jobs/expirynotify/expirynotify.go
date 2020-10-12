// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package expirynotify

import (
	"github.com/mattermost/mattermost-server/v5/app"
	tjobs "github.com/mattermost/mattermost-server/v5/jobs/interfaces"
)

type ExpiryNotifyJobInterfaceImpl struct {
	App *app.App
}

func init() {
	app.RegisterJobsExpiryNotifyJobInterface(func(a *app.App) tjobs.ExpiryNotifyJobInterface {
		return &ExpiryNotifyJobInterfaceImpl{a}
	})
}
