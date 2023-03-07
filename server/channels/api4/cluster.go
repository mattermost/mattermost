// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost-server/server/v7/model"
)

func (api *API) InitCluster() {
	api.BaseRoutes.Cluster.Handle("/status", api.APISessionRequired(getClusterStatus)).Methods("GET")
}

func getClusterStatus(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadEnvironmentHighAvailability) {
		c.SetPermissionError(model.PermissionSysconsoleReadEnvironmentHighAvailability)
		return
	}

	if *c.App.Config().ExperimentalSettings.RestrictSystemAdmin {
		c.Err = model.NewAppError("getClusterStatus", "api.restricted_system_admin", nil, "", http.StatusForbidden)
		return
	}

	infos := c.App.GetClusterStatus()
	js, err := json.Marshal(infos)
	if err != nil {
		c.Err = model.NewAppError("getClusterStatus", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	w.Write(js)
}
