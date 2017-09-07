// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

func InitCluster() {
	l4g.Debug(utils.T("api.cluster.init.debug"))

	BaseRoutes.Cluster.Handle("/status", ApiSessionRequired(getClusterStatus)).Methods("GET")
}

func getClusterStatus(c *Context, w http.ResponseWriter, r *http.Request) {
	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	infos := app.GetClusterStatus()
	w.Write([]byte(model.ClusterInfosToJson(infos)))
}
