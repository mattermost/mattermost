// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"io"
	"net/http"
	"time"

	"github.com/mattermost/mattermost-server/v6/app"
	"github.com/mattermost/mattermost-server/v6/audit"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/services/remotecluster"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

func (api *API) InitRemoteCluster() {
	api.BaseRoutes.RemoteCluster.Handle("/ping", api.RemoteClusterTokenRequired(remoteClusterPing)).Methods("POST")
	api.BaseRoutes.RemoteCluster.Handle("/msg", api.RemoteClusterTokenRequired(remoteClusterAcceptMessage)).Methods("POST")
	api.BaseRoutes.RemoteCluster.Handle("/confirm_invite", api.RemoteClusterTokenRequired(remoteClusterConfirmInvite)).Methods("POST")
	api.BaseRoutes.RemoteCluster.Handle("/upload/{upload_id:[A-Za-z0-9]+}", api.RemoteClusterTokenRequired(uploadRemoteData)).Methods("POST")
	api.BaseRoutes.RemoteCluster.Handle("/{user_id:[A-Za-z0-9]+}/image", api.RemoteClusterTokenRequired(remoteSetProfileImage)).Methods("POST")
}

func remoteClusterPing(c *Context, w http.ResponseWriter, r *http.Request) {
	// make sure remote cluster service is enabled.
	if _, appErr := c.App.GetRemoteClusterService(); appErr != nil {
		c.Err = appErr
		return
	}

	var frame model.RemoteClusterFrame
	if err := json.NewDecoder(r.Body).Decode(&frame); err != nil {
		c.Err = model.NewAppError("remoteClusterPing", "api.unmarshal_error", nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	if appErr := frame.IsValid(); appErr != nil {
		c.Err = appErr
		return
	}

	remoteId := c.GetRemoteID(r)
	if remoteId != frame.RemoteId {
		c.SetInvalidRemoteIdError(frame.RemoteId)
		return
	}

	rc, appErr := c.App.GetRemoteCluster(frame.RemoteId)
	if appErr != nil {
		c.SetInvalidRemoteIdError(frame.RemoteId)
		return
	}

	var ping model.RemoteClusterPing
	if err := json.Unmarshal(frame.Msg.Payload, &ping); err != nil {
		c.SetInvalidParamWithErr("msg.payload", err)
		return
	}
	ping.RecvAt = model.GetMillis()

	if metrics := c.App.Metrics(); metrics != nil {
		metrics.IncrementRemoteClusterMsgReceivedCounter(rc.RemoteId)
	}

	err := json.NewEncoder(w).Encode(ping)
	if err != nil {
		c.Logger.Warn("Error writing response", mlog.Err(err))
	}
}

func remoteClusterAcceptMessage(c *Context, w http.ResponseWriter, r *http.Request) {
	// make sure remote cluster service is running.
	service, appErr := c.App.GetRemoteClusterService()
	if appErr != nil {
		c.Err = appErr
		return
	}

	var frame model.RemoteClusterFrame
	if err := json.NewDecoder(r.Body).Decode(&frame); err != nil {
		c.Err = model.NewAppError("remoteClusterAcceptMessage", "api.unmarshal_error", nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	appErr = frame.IsValid()
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec := c.MakeAuditRecord("remoteClusterAcceptMessage", audit.Fail)
	auditRec.AddEventParameter("remote_cluster_frame", frame)
	defer c.LogAuditRec(auditRec)

	remoteId := c.GetRemoteID(r)
	if remoteId != frame.RemoteId {
		c.SetInvalidRemoteIdError(frame.RemoteId)
		return
	}

	rc, appErr := c.App.GetRemoteCluster(frame.RemoteId)
	if appErr != nil {
		c.SetInvalidRemoteIdError(frame.RemoteId)
		return
	}
	auditRec.AddMeta("remoteCluster", rc)

	// pass message to Remote Cluster Service and write response
	resp := service.ReceiveIncomingMsg(rc, frame.Msg)

	b, err := json.Marshal(resp)
	if err != nil {
		c.Err = model.NewAppError("remoteClusterAcceptMessage", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
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

	var frame model.RemoteClusterFrame
	if jsonErr := json.NewDecoder(r.Body).Decode(&frame); jsonErr != nil {
		c.Err = model.NewAppError("remoteClusterConfirmInvite", "api.unmarshal_error", nil, "", http.StatusBadRequest).Wrap(jsonErr)
		return
	}

	if appErr := frame.IsValid(); appErr != nil {
		c.Err = appErr
		return
	}

	auditRec := c.MakeAuditRecord("remoteClusterAcceptInvite", audit.Fail)
	auditRec.AddEventParameter("remote_cluster_frame", frame)
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

	var confirm model.RemoteClusterInvite
	if jsonErr := json.Unmarshal(frame.Msg.Payload, &confirm); jsonErr != nil {
		c.SetInvalidParam("msg.payload")
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
	auditRec.AddEventParameter("upload_id", c.Params.UploadId)

	c.AppContext.SetContext(app.WithMaster(c.AppContext.Context()))
	us, err := c.App.GetUploadSession(c.AppContext, c.Params.UploadId)
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

	if err := json.NewEncoder(w).Encode(info); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func remoteSetProfileImage(c *Context, w http.ResponseWriter, r *http.Request) {
	defer io.Copy(io.Discard, r.Body)

	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if *c.App.Config().FileSettings.DriverName == "" {
		c.Err = model.NewAppError("remoteUploadProfileImage", "api.user.upload_profile_user.storage.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	if r.ContentLength > *c.App.Config().FileSettings.MaxFileSize {
		c.Err = model.NewAppError("remoteUploadProfileImage", "api.user.upload_profile_user.too_large.app_error", nil, "", http.StatusRequestEntityTooLarge)
		return
	}

	if err := r.ParseMultipartForm(*c.App.Config().FileSettings.MaxFileSize); err != nil {
		c.Err = model.NewAppError("remoteUploadProfileImage", "api.user.upload_profile_user.parse.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	m := r.MultipartForm
	imageArray, ok := m.File["image"]
	if !ok {
		c.Err = model.NewAppError("remoteUploadProfileImage", "api.user.upload_profile_user.no_file.app_error", nil, "", http.StatusBadRequest)
		return
	}

	if len(imageArray) == 0 {
		c.Err = model.NewAppError("remoteUploadProfileImage", "api.user.upload_profile_user.array.app_error", nil, "", http.StatusBadRequest)
		return
	}

	auditRec := c.MakeAuditRecord("remoteUploadProfileImage", audit.Fail)
	defer c.LogAuditRec(auditRec)
	if imageArray[0] != nil {
		auditRec.AddEventParameter("filename", imageArray[0].Filename)
	}

	user, err := c.App.GetUser(c.Params.UserId)
	if err != nil || !user.IsRemote() {
		c.SetInvalidURLParam("user_id")
		return
	}
	auditRec.AddMeta("user", user)

	imageData := imageArray[0]
	if err := c.App.SetProfileImage(c.AppContext, c.Params.UserId, imageData); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("")

	ReturnStatusOK(w)
}
