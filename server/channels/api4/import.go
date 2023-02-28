// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/platform/shared/mlog"
)

func (api *API) InitImport() {
	api.BaseRoutes.Imports.Handle("", api.APISessionRequired(listImports)).Methods("GET")
}

func listImports(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.IsSystemAdmin() {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	imports, appErr := c.App.ListImports()
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(imports); err != nil {
		c.Logger.Warn("Error writing imports", mlog.Err(err))
	}
}
