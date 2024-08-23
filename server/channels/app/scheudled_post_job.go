// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import "github.com/mattermost/mattermost/server/public/shared/request"

func (a *App) ProcessScheduledPosts(rctx request.CTX) {
	rctx.Logger().Info("ProcessScheduledPosts called...")
}
