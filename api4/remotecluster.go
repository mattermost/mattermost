// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v5/audit"
	"github.com/mattermost/mattermost-server/v5/model"
)

func (api *API) InitRemoteCluster() {
	api.BaseRoutes.RemoteCluster.Handle("/ping", api.ApiHandler(getRemoteClusterPing)).Methods("GET")
	api.BaseRoutes.System.Handle("/msg", api.ApiSessionRequired(acceptMessage)).Methods("POST")
}

func getRemoteClusterPing(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	token := props["token"]
	if len(token) != model.TOKEN_SIZE {
		c.SetInvalidParam("token")
		return
	}

	remoteId := props["remote_id"]
	if len(remoteId) != model.TOKEN_SIZE {
		c.SetInvalidParam("remote_id")
		return
	}

	auditRec := c.MakeAuditRecord("remoteClusterPing", audit.Fail)
	defer c.LogAuditRec(auditRec)

	rc, err := c.App.GetRemoteCluster(remoteId)
	if err != nil {
		c.SetInvalidRemoteClusterIdError(remoteId)
	}
	auditRec.AddMeta("remoteCluster", rc)

	if rc.Token != token {
		c.SetInvalidRemoteClusterTokenError()
	}

	if err := c.App.SetRemoteClusterLastPingAt(remoteId); err != nil {
		auditRec.AddMeta("err", err)
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func acceptMessage(c *Context, w http.ResponseWriter, r *http.Request) {

	ReturnStatusOK(w)
}
