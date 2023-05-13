// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"

	"github.com/mattermost/mattermost-server/server/public/shared/mlog"
)

// initialize is called when the App is first created.
func (a *App) initialize(skipTemplateInit bool) {
	if !skipTemplateInit {
		if err := a.InitTemplates(); err != nil {
			a.logger.Error(`InitializeTemplates failed`, mlog.Err(err))
		}
	}
}

func (a *App) Shutdown() {
	if a.blockChangeNotifier != nil {
		ctx, cancel := context.WithTimeout(context.Background(), blockChangeNotifierShutdownTimeout)
		defer cancel()
		if !a.blockChangeNotifier.Shutdown(ctx) {
			a.logger.Warn("blockChangeNotifier shutdown timed out")
		}
	}
}
