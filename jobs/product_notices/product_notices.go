// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package product_notices

import (
	"github.com/mattermost/mattermost-server/v6/app"
	tjobs "github.com/mattermost/mattermost-server/v6/jobs/interfaces"
)

type ProductNoticesJobInterfaceImpl struct {
	App *app.App
}

func init() {
	app.RegisterProductNoticesJobInterface(func(s *app.Server) tjobs.ProductNoticesJobInterface {
		a := app.New(app.ServerConnector(s))
		return &ProductNoticesJobInterfaceImpl{a}
	})
}
