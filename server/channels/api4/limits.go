// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (api *API) InitLimits() {
	api.BaseRoutes.Limits.Handle("/server", api.APISessionRequired(getServerLimits)).Methods(http.MethodGet)
}

func getServerLimits(c *Context, w http.ResponseWriter, r *http.Request) {
	isAdmin := c.IsSystemAdmin() && c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadUserManagementUsers)

	serverLimits, err := c.App.GetServerLimits()
	if err != nil {
		c.Err = err
		return
	}

	// Non-admin users only get message history limit information, no user count data
	if !isAdmin {
		limitedData := &model.ServerLimits{
			MaxUsersLimit:          0,
			MaxUsersHardLimit:      0,
			ActiveUserCount:        0,
			LastAccessiblePostTime: serverLimits.LastAccessiblePostTime,
			PostHistoryLimit:       serverLimits.PostHistoryLimit,
		}
		serverLimits = limitedData
	}

	if err := json.NewEncoder(w).Encode(serverLimits); err != nil {
		c.Logger.Warn("Error writing server limits response", mlog.Err(err))
	}
}
