// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/mattermost/mattermost-server/v5/audit"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/services/remotecluster"
)

func (api *API) InitRemoteCluster() {
	api.BaseRoutes.RemoteCluster.Handle("/ping", api.RemoteClusterTokenRequired(remoteClusterPing)).Methods("POST")
	api.BaseRoutes.RemoteCluster.Handle("/msg", api.RemoteClusterTokenRequired(remoteClusterAcceptMessage)).Methods("POST")
	api.BaseRoutes.RemoteCluster.Handle("/confirm_invite", api.RemoteClusterTokenRequired(remoteClusterConfirmInvite)).Methods("POST")
	api.BaseRoutes.RemoteCluster.Handle("/upload/{upload_id:[A-Za-z0-9]+}", api.RemoteClusterTokenRequired(uploadRemoteData)).Methods("POST")
}

func remoteClusterPing(c *Context, w http.ResponseWriter, r *http.Request) {
	// make sure remote cluster service is enabled.
	if _, appErr := c.App.GetRemoteClusterService(); appErr != nil {
		c.Err = appErr
		return
	}

	frame, appErr := model.RemoteClusterFrameFromJSON(r.Body)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if appErr = frame.IsValid(); appErr != nil {
		c.Err = appErr
		return
	}

	remoteId := c.GetRemoteID(r)
	if remoteId != frame.RemoteId {
		c.SetInvalidRemoteIdError(frame.RemoteId)
		return
	}

	rc, err := c.App.GetRemoteCluster(frame.RemoteId)
	if err != nil {
		c.SetInvalidRemoteIdError(frame.RemoteId)
		return
	}

	ping, err := model.RemoteClusterPingFromRawJSON(frame.Msg.Payload)
	if err != nil {
		c.SetInvalidParam("msg.payload")
		return
	}
	ping.RecvAt = model.GetMillis()

	if metrics := c.App.Metrics(); metrics != nil {
		metrics.IncrementRemoteClusterMsgReceivedCounter(rc.RemoteId)
	}

	resp, _ := json.Marshal(ping)
	w.Write(resp)
}

func remoteClusterAcceptMessage(c *Context, w http.ResponseWriter, r *http.Request) {
	// make sure remote cluster service is running.
	service, appErr := c.App.GetRemoteClusterService()
	if appErr != nil {
		c.Err = appErr
		return
	}

	frame, appErr := model.RemoteClusterFrameFromJSON(r.Body)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if appErr = frame.IsValid(); appErr != nil {
		c.Err = appErr
		return
	}

	auditRec := c.MakeAuditRecord("remoteClusterAcceptMessage", audit.Fail)
	defer c.LogAuditRec(auditRec)

	remoteId := c.GetRemoteID(r)
	if remoteId != frame.RemoteId {
		c.SetInvalidRemoteIdError(frame.RemoteId)
		return
	}

	rc, err := c.App.GetRemoteCluster(frame.RemoteId)
	if err != nil {
		c.SetInvalidRemoteIdError(frame.RemoteId)
		return
	}
	auditRec.AddMeta("remoteCluster", rc)

	// pass message to Remote Cluster Service and write response
	resp := service.ReceiveIncomingMsg(rc, frame.Msg)

	b, errMarshall := json.Marshal(resp)
	if errMarshall != nil {
		c.Err = model.NewAppError("remoteClusterAcceptMessage", "api.marshal_error", nil, errMarshall.Error(), http.StatusInternalServerError)
		return
	}
	w.Write(b)
}

func remoteClusterConfirmInvite(c *Context, w http.ResponseWriter, r *http.Request) {
	// make sure remote cluster service is running.
	if _, appErr := c.App.GetRemoteClusterService(); appErr != nil {
		c.Err = appErr
		return
	}

	frame, appErr := model.RemoteClusterFrameFromJSON(r.Body)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if appErr = frame.IsValid(); appErr != nil {
		c.Err = appErr
		return
	}

	auditRec := c.MakeAuditRecord("remoteClusterAcceptInvite", audit.Fail)
	defer c.LogAuditRec(auditRec)

	remoteId := c.GetRemoteID(r)
	if remoteId != frame.RemoteId {
		c.SetInvalidRemoteIdError(frame.RemoteId)
		return
	}

	rc, err := c.App.GetRemoteCluster(frame.RemoteId)
	if err != nil {
		c.SetInvalidRemoteIdError(frame.RemoteId)
		return
	}
	auditRec.AddMeta("remoteCluster", rc)

	if time.Since(model.GetTimeForMillis(rc.CreateAt)) > remotecluster.InviteExpiresAfter {
		c.Err = model.NewAppError("remoteClusterAcceptMessage", "api.context.invitation_expired.error", nil, "", http.StatusBadRequest)
		return
	}

	confirm, appErr := model.RemoteClusterInviteFromRawJSON(frame.Msg.Payload)
	if appErr != nil {
		c.Err = appErr
		return
	}

	rc.RemoteTeamId = confirm.RemoteTeamId
	rc.SiteURL = confirm.SiteURL
	rc.RemoteToken = confirm.Token

	if _, err := c.App.UpdateRemoteCluster(rc); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func uploadRemoteData(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*c.App.Config().FileSettings.EnableFileAttachments {
		c.Err = model.NewAppError("uploadRemoteData", "api.file.attachments.disabled.app_error",
			nil, "", http.StatusNotImplemented)
		return
	}

	c.RequireUploadId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("uploadRemoteData", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("upload_id", c.Params.UploadId)

	us, err := c.App.GetUploadSession(c.Params.UploadId)
	if err != nil {
		c.Err = err
		return
	}

	if us.RemoteId != c.GetRemoteID(r) {
		c.Err = model.NewAppError("uploadRemoteData", "api.context.remote_id_mismatch.app_error",
			nil, "", http.StatusUnauthorized)
		return
	}

	info, err := doUploadData(c, us, r)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()

	if info == nil {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	w.Write([]byte(info.ToJson()))
}
