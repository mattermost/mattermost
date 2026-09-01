// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (api *API) InitPermissions() {
	api.BaseRoutes.Permissions.Handle("", api.APISessionRequired(getPluginPermissions)).Methods(http.MethodGet)
	api.BaseRoutes.Permissions.Handle("/ancillary", api.APISessionRequired(appendAncillaryPermissionsPost)).Methods(http.MethodPost)
}

func getPluginPermissions(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadUserManagementPermissions) {
		c.SetPermissionError(model.PermissionSysconsoleReadUserManagementPermissions)
		return
	}

	permissions, appErr := c.App.GetPluginPermissions()
	if appErr != nil {
		c.Err = appErr
		return
	}
	if permissions == nil {
		permissions = []*model.PluginPermission{}
	}

	if err := json.NewEncoder(w).Encode(permissions); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func appendAncillaryPermissionsPost(c *Context, w http.ResponseWriter, r *http.Request) {
	permissions, err := model.NonSortedArrayFromJSON(r.Body)
	if err != nil || len(permissions) < 1 {
		c.Err = model.NewAppError("appendAncillaryPermissionsPost", model.PayloadParseError, nil, "", http.StatusBadRequest).Wrap(err)
		return
	}
	b, err := json.Marshal(model.AddAncillaryPermissions(permissions))
	if err != nil {
		c.SetJSONEncodingError(err)
		return
	}
	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
