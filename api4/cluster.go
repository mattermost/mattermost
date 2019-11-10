// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"bytes"
	"io/ioutil"
	"net/http"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/services/tracing"
)

func (api *API) InitCluster() {
	api.BaseRoutes.Cluster.Handle("/status", api.ApiSessionRequired(getClusterStatus)).Methods("GET")
}

func getClusterStatus(c *Context, w http.ResponseWriter, r *http.Request) {
	span, ctx := tracing.StartSpanWithParentByContext(c.App.Context, "api4:cluster:getClusterStatus")
	c.App.Context = ctx
	var bodyBytes []byte
	if r.Body != nil {
		bodyBytes, _ = ioutil.ReadAll(r.Body)
		r.Body = ioutil.NopCloser(bytes.NewBuffer(bodyBytes))
		span.SetTag("body", string(bodyBytes))
	}

	defer span.Finish()
	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if *c.App.Config().ExperimentalSettings.RestrictSystemAdmin {
		c.Err = model.NewAppError("getClusterStatus", "api.restricted_system_admin", nil, "", http.StatusForbidden)
		return
	}

	infos := c.App.GetClusterStatus()
	w.Write([]byte(model.ClusterInfosToJson(infos)))
}
