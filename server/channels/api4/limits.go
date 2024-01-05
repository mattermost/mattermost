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
	api.BaseRoutes.Limits.Handle("/users", api.APISessionRequired(getUserLimits)).Methods("GET")
}

func getUserLimits(c *Context, w http.ResponseWriter, r *http.Request) {
	if !(c.IsSystemAdmin() && c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadUserManagementUsers)) {
		c.SetPermissionError(model.PermissionSysconsoleReadUserManagementUsers)
		return
	}

	userLimits, err := c.App.GetUserLimits()
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(userLimits); err != nil {
		c.Logger.Error("Error writing user limits response", mlog.Err(err))
	}
}
