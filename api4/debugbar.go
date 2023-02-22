// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

func (api *API) InitDebugBar() {
	api.BaseRoutes.DebugBar.Handle("/systeminfo", api.APISessionRequired(getSystemInfo)).Methods("GET")
}

func getSystemInfo(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.Srv().DebugBar().IsEnabled() {
		c.Err = model.NewAppError("Api4.GetSystemInfo", "api.debugbar.getSystemInfo.disabled_debugbar.error", nil, "", http.StatusNotImplemented)
		return
	}

	info, err := c.App.GetDebugBarInfo()
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(info); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
