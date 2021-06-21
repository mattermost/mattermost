// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package daily_license_check

import (
	"github.com/mattermost/mattermost-server/v5/app"
	ejobs "github.com/mattermost/mattermost-server/v5/einterfaces/jobs"
)

type DailyLicenseCheckJobInterfaceImpl struct {
	App *app.App
}

func init() {
	app.RegisterJobsDailyLicenseCheckInterface(func(s *app.Server) ejobs.DailyLicenseCheckJobInterface {
		a := app.New(app.ServerConnector(s))
		return &DailyLicenseCheckJobInterfaceImpl{a}
	})
}
