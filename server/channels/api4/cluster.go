// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
)

func (api *API) InitCluster() {
	api.BaseRoutes.Cluster.Handle("/status", api.APISessionRequired(getClusterStatus)).Methods(http.MethodGet)
}

func getClusterStatus(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionToAndNotRestrictedAdmin(*c.AppContext.Session(), model.PermissionSysconsoleReadEnvironmentHighAvailability) {
		c.SetPermissionError(model.PermissionSysconsoleReadEnvironmentHighAvailability)
		return
	}

	infos, err := c.App.GetClusterStatus(c.AppContext)
	if err != nil {
		c.Err = model.NewAppError("getClusterStatus", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	js, err := json.Marshal(infos)
	if err != nil {
		c.Err = model.NewAppError("getClusterStatus", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	w.Write(js)
}
