// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func (a *App) ProcessScheduledPosts(rctx request.CTX) {
	rctx.Logger().Info("ProcessScheduledPosts called...")
	scheduledPosts, err := a.Srv().Store().ScheduledPost().GetScheduledPosts(model.GetMillis(), "", 4)
	if err != nil {
		rctx.Logger().Error(err.Error())
		return
	}

	for _, scheduledPost := range scheduledPosts {
		rctx.Logger().Debug(fmt.Sprintf("Scheduled Post: %s", scheduledPost.Message))
	}
}
