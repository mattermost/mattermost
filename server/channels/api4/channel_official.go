// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
)

// checkOfficialChannelPermission checks if the user can perform actions on an official channel.
// Returns nil if permitted, or an AppError if the channel is official and the user is not the creator.
func checkOfficialChannelPermission(c *Context, channel *model.Channel) *model.AppError {
	isOfficial, appErr := c.App.IsOfficialChannel(c.AppContext, channel)
	if appErr != nil {
		return appErr
	}

	if isOfficial {
		// For official channels, only the creator can perform actions
		if channel.CreatorId != c.AppContext.Session().UserId {
			return model.NewAppError("checkOfficialChannelPermission", "api.channel.official_channel.forbidden", nil, i18n.T("api.channel.official_channel.forbidden"), http.StatusForbidden)
		}
	}

	// For non-official channels, return nil (no error)
	return nil
}
