// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"io"
	"net/http"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/audit"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
	"github.com/mattermost/mattermost/server/v8/platform/services/remotecluster"
)

func (api *API) InitRemoteCluster() {
	api.BaseRoutes.RemoteCluster.Handle("/ping", api.RemoteClusterTokenRequired(remoteClusterPing)).Methods(http.MethodPost)
	api.BaseRoutes.RemoteCluster.Handle("/msg", api.RemoteClusterTokenRequired(remoteClusterAcceptMessage)).Methods(http.MethodPost)
	api.BaseRoutes.RemoteCluster.Handle("/confirm_invite", api.RemoteClusterTokenRequired(remoteClusterConfirmInvite)).Methods(http.MethodPost)
	api.BaseRoutes.RemoteCluster.Handle("/upload/{upload_id:[A-Za-z0-9]+}", api.RemoteClusterTokenRequired(uploadRemoteData, handlerParamFileAPI)).Methods(http.MethodPost)
	api.BaseRoutes.RemoteCluster.Handle("/{user_id:[A-Za-z0-9]+}/image", api.RemoteClusterTokenRequired(remoteSetProfileImage, handlerParamFileAPI)).Methods(http.MethodPost)

	api.BaseRoutes.RemoteCluster.Handle("", api.APISessionRequired(getRemoteClusters)).Methods(http.MethodGet)
	api.BaseRoutes.RemoteCluster.Handle("", api.APISessionRequired(createRemoteCluster)).Methods(http.MethodPost)
	api.BaseRoutes.RemoteCluster.Handle("/accept_invite", api.APISessionRequired(remoteClusterAcceptInvite)).Methods(http.MethodPost)
	api.BaseRoutes.RemoteCluster.Handle("/{remote_id:[A-Za-z0-9]+}/generate_invite", api.APISessionRequired(generateRemoteClusterInvite)).Methods(http.MethodPost)
	api.BaseRoutes.RemoteCluster.Handle("/{remote_id:[A-Za-z0-9]+}", api.APISessionRequired(getRemoteCluster)).Methods(http.MethodGet)
	api.BaseRoutes.RemoteCluster.Handle("/{remote_id:[A-Za-z0-9]+}", api.APISessionRequired(patchRemoteCluster)).Methods(http.MethodPatch)
	api.BaseRoutes.RemoteCluster.Handle("/{remote_id:[A-Za-z0-9]+}", api.APISessionRequired(deleteRemoteCluster)).Methods(http.MethodDelete)
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

	rc, appErr := c.App.GetRemoteCluster(frame.RemoteId, false)
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
	audit.AddEventParameterAuditable(auditRec, "remote_cluster_frame", &frame)
	defer c.LogAuditRec(auditRec)

	remoteId := c.GetRemoteID(r)
	if remoteId != frame.RemoteId {
		c.SetInvalidRemoteIdError(frame.RemoteId)
		return
	}

	rc, appErr := c.App.GetRemoteCluster(frame.RemoteId, false)
	if appErr != nil {
		c.SetInvalidRemoteIdError(frame.RemoteId)
		return
	}
	audit.AddEventParameterAuditable(auditRec, "remote_cluster", rc)

	// pass message to Remote Cluster Service and write response
	resp := service.ReceiveIncomingMsg(rc, frame.Msg)

	b, err := json.Marshal(resp)
	if err != nil {
		c.Err = model.NewAppError("remoteClusterAcceptMessage", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func remoteClusterConfirmInvite(c *Context, w http.ResponseWriter, r *http.Request) {
	// make sure remote cluster service is running.
	rcs, appErr := c.App.GetRemoteClusterService()
	if appErr != nil {
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
	audit.AddEventParameterAuditable(auditRec, "remote_cluster_frame", &frame)
	defer c.LogAuditRec(auditRec)

	remoteId := c.GetRemoteID(r)
	if remoteId != frame.RemoteId {
		c.SetInvalidRemoteIdError(frame.RemoteId)
		return
	}

	rc, err := c.App.GetRemoteCluster(frame.RemoteId, false)
	if err != nil {
		c.SetInvalidRemoteIdError(frame.RemoteId)
		return
	}
	audit.AddEventParameterAuditable(auditRec, "remote_cluster", rc)

	// check if the invitation has expired
	if time.Since(model.GetTimeForMillis(rc.CreateAt)) > remotecluster.InviteExpiresAfter {
		c.Err = model.NewAppError("remoteClusterAcceptMessage", "api.context.invitation_expired.error", nil, "", http.StatusBadRequest)
		return
	}

	var confirm model.RemoteClusterInvite
	if jsonErr := json.Unmarshal(frame.Msg.Payload, &confirm); jsonErr != nil {
		c.SetInvalidParam("msg.payload")
		return
	}

	if _, rcsErr := rcs.ReceiveInviteConfirmation(confirm); rcsErr != nil {
		c.Err = model.NewAppError("remoteClusterConfirmInvite", "api.command_remote.confirm_invitation.error",
			map[string]any{"Error": rcsErr.Error()}, "", http.StatusInternalServerError)
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
	audit.AddEventParameter(auditRec, "upload_id", c.Params.UploadId)

	c.AppContext = c.AppContext.With(app.RequestContextWithMaster)
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
	defer func() {
		if _, err := io.Copy(io.Discard, r.Body); err != nil {
			c.Logger.Warn("Error while reading request body", mlog.Err(err))
		}
	}()

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
		c.Err = model.NewAppError("remoteUploadProfileImage", "api.user.upload_profile_user.parse.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
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
		audit.AddEventParameter(auditRec, "filename", imageArray[0].Filename)
	}

	user, err := c.App.GetUser(c.Params.UserId)
	if err != nil || !user.IsRemote() {
		c.SetInvalidURLParam("user_id")
		return
	}

	// ensure the user being modified belongs to the remote requesting the change.
	requesterRemoteID := c.GetRemoteID(r)
	if user.GetRemoteID() != requesterRemoteID {
		c.Err = model.NewAppError("remoteSetProfileImage", "api.context.remote_id_mismatch.app_error",
			nil, "", http.StatusUnauthorized)
		return
	}

	audit.AddEventParameterAuditable(auditRec, "user", user)

	imageData := imageArray[0]
	if err := c.App.SetProfileImage(c.AppContext, c.Params.UserId, imageData); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("")

	ReturnStatusOK(w)
}

func getRemoteClusters(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSecureConnections) {
		c.SetPermissionError(model.PermissionManageSecureConnections)
		return
	}

	// make sure remote cluster service is enabled.
	if _, appErr := c.App.GetRemoteClusterService(); appErr != nil {
		c.Err = appErr
		return
	}

	filter := model.RemoteClusterQueryFilter{
		ExcludeOffline: c.Params.ExcludeOffline,
		InChannel:      c.Params.InChannel,
		NotInChannel:   c.Params.NotInChannel,
		Topic:          c.Params.Topic,
		CreatorId:      c.Params.CreatorId,
		OnlyConfirmed:  c.Params.OnlyConfirmed,
		PluginID:       c.Params.PluginId,
		OnlyPlugins:    c.Params.OnlyPlugins,
		ExcludePlugins: c.Params.ExcludePlugins,
		IncludeDeleted: c.Params.IncludeDeleted,
	}

	rcs, appErr := c.App.GetAllRemoteClusters(c.Params.Page, c.Params.PerPage, filter)
	if appErr != nil {
		c.Err = appErr
		return
	}

	for _, rc := range rcs {
		rc.Sanitize()
	}

	b, err := json.Marshal(rcs)
	if err != nil {
		c.Err = model.NewAppError("getRemoteClusters", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func createRemoteCluster(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSecureConnections) {
		c.SetPermissionError(model.PermissionManageSecureConnections)
		return
	}

	// make sure remote cluster service is enabled.
	if _, appErr := c.App.GetRemoteClusterService(); appErr != nil {
		c.Err = appErr
		return
	}

	auditRec := c.MakeAuditRecord("createRemoteCluster", audit.Fail)
	defer c.LogAuditRec(auditRec)

	var rcWithTeamAndPassword model.RemoteClusterWithPassword
	if jsonErr := json.NewDecoder(r.Body).Decode(&rcWithTeamAndPassword); jsonErr != nil {
		c.SetInvalidParamWithErr("remoteCluster", jsonErr)
		return
	}

	url := c.App.GetSiteURL()
	if url == "" {
		c.Err = model.NewAppError("createRemoteCluster", "api.get_site_url_error", nil, "", http.StatusUnprocessableEntity)
		return
	}

	if rcWithTeamAndPassword.DefaultTeamId == "" {
		c.SetInvalidParam("remote_cluster.default_team_id")
		return
	}

	if rcWithTeamAndPassword.DisplayName == "" {
		rcWithTeamAndPassword.DisplayName = rcWithTeamAndPassword.Name
	}

	token := model.NewId()
	rc := &model.RemoteCluster{
		Name:          rcWithTeamAndPassword.Name,
		DisplayName:   rcWithTeamAndPassword.DisplayName,
		SiteURL:       model.SiteURLPending + model.NewId(),
		DefaultTeamId: rcWithTeamAndPassword.DefaultTeamId,
		Token:         token,
		CreatorId:     c.AppContext.Session().UserId,
	}

	audit.AddEventParameterAuditable(auditRec, "remotecluster", rc)

	rcSaved, appErr := c.App.AddRemoteCluster(rc)
	if appErr != nil {
		c.Err = appErr
		return
	}
	rcSaved.Sanitize()

	password := rcWithTeamAndPassword.Password
	if password == "" {
		password = utils.SecureRandString(16)
	}

	inviteCode, iErr := c.App.CreateRemoteClusterInvite(rcSaved.RemoteId, url, token, password)
	if iErr != nil {
		c.Err = iErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(rcSaved)
	auditRec.AddEventObjectType("remotecluster")

	resp := model.RemoteClusterWithInvite{RemoteCluster: rcSaved, Invite: inviteCode}
	if rcWithTeamAndPassword.Password == "" {
		resp.Password = password
	}

	b, err := json.Marshal(resp)
	if err != nil {
		c.Err = model.NewAppError("createRemoteCluster", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.WriteHeader(http.StatusCreated)
	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func remoteClusterAcceptInvite(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSecureConnections) {
		c.SetPermissionError(model.PermissionManageSecureConnections)
		return
	}

	// make sure remote cluster service is enabled.
	rcs, appErr := c.App.GetRemoteClusterService()
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec := c.MakeAuditRecord("remoteClusterAcceptInvite", audit.Fail)
	defer c.LogAuditRec(auditRec)

	var rcAcceptInvite model.RemoteClusterAcceptInvite
	if jsonErr := json.NewDecoder(r.Body).Decode(&rcAcceptInvite); jsonErr != nil {
		c.SetInvalidParamWithErr("remoteCluster", jsonErr)
		return
	}

	if rcAcceptInvite.DefaultTeamId == "" {
		c.SetInvalidParam("remoteCluster.default_team_id")
		return
	}

	if _, teamErr := c.App.GetTeam(rcAcceptInvite.DefaultTeamId); teamErr != nil {
		c.SetInvalidParamWithErr("remoteCluster.default_team_id", teamErr)
		return
	}

	audit.AddEventParameter(auditRec, "name", rcAcceptInvite.Name)
	audit.AddEventParameter(auditRec, "display_name", rcAcceptInvite.DisplayName)

	if rcAcceptInvite.DisplayName == "" {
		rcAcceptInvite.DisplayName = rcAcceptInvite.Name
	}

	invite, dErr := c.App.DecryptRemoteClusterInvite(rcAcceptInvite.Invite, rcAcceptInvite.Password)
	if dErr != nil {
		c.Err = dErr
		return
	}

	audit.AddEventParameter(auditRec, "site_url", invite.SiteURL)

	url := c.App.GetSiteURL()
	if url == "" {
		c.Err = model.NewAppError("remoteClusterAcceptInvite", "api.get_site_url_error", nil, "", http.StatusUnprocessableEntity)
		return
	}

	rc, aErr := rcs.AcceptInvitation(invite, rcAcceptInvite.Name, rcAcceptInvite.DisplayName, c.AppContext.Session().UserId, url, rcAcceptInvite.DefaultTeamId)
	if aErr != nil {
		c.Err = model.NewAppError("remoteClusterAcceptInvite", "api.remote_cluster.accept_invitation_error", nil, "", http.StatusInternalServerError).Wrap(aErr)
		if appErr, ok := aErr.(*model.AppError); ok {
			c.Err = appErr
		}
		return
	}
	rc.Sanitize()

	auditRec.Success()
	auditRec.AddEventResultState(rc)
	auditRec.AddEventObjectType("remotecluster")

	b, err := json.Marshal(rc)
	if err != nil {
		c.Err = model.NewAppError("remoteClusterAcceptInvite", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.WriteHeader(http.StatusCreated)
	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func generateRemoteClusterInvite(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireRemoteId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSecureConnections) {
		c.SetPermissionError(model.PermissionManageSecureConnections)
		return
	}

	// make sure remote cluster service is enabled.
	if _, appErr := c.App.GetRemoteClusterService(); appErr != nil {
		c.Err = appErr
		return
	}

	auditRec := c.MakeAuditRecord("generateRemoteClusterInvite", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "remote_id", c.Params.RemoteId)

	props := model.MapFromJSON(r.Body)
	password := props["password"]
	if password == "" {
		c.SetInvalidParam("password")
		return
	}

	url := c.App.GetSiteURL()
	if url == "" {
		c.Err = model.NewAppError("generateRemoteClusterInvite", "api.get_site_url_error", nil, "", http.StatusUnprocessableEntity)
		return
	}

	rc, appErr := c.App.GetRemoteCluster(c.Params.RemoteId, false)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if rc.IsConfirmed() {
		c.Err = model.NewAppError("generateRemoteClusterInvite", "api.remote_cluster.generate_invite_cluster_is_confirmed", nil, "", http.StatusBadRequest)
		return
	}

	inviteCode, invErr := c.App.CreateRemoteClusterInvite(rc.RemoteId, url, rc.Token, password)
	if invErr != nil {
		c.Err = invErr
	}

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(inviteCode); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getRemoteCluster(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSecureConnections) {
		c.SetPermissionError(model.PermissionManageSecureConnections)
		return
	}

	c.RequireRemoteId()
	if c.Err != nil {
		return
	}

	// make sure remote cluster service is enabled.
	if _, appErr := c.App.GetRemoteClusterService(); appErr != nil {
		c.Err = appErr
		return
	}

	rc, err := c.App.GetRemoteCluster(c.Params.RemoteId, true)
	if err != nil {
		c.Err = err
		return
	}
	rc.Sanitize()

	if err := json.NewEncoder(w).Encode(rc); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func patchRemoteCluster(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSecureConnections) {
		c.SetPermissionError(model.PermissionManageSecureConnections)
		return
	}

	c.RequireRemoteId()
	if c.Err != nil {
		return
	}

	// make sure remote cluster service is enabled.
	if _, appErr := c.App.GetRemoteClusterService(); appErr != nil {
		c.Err = appErr
		return
	}

	var patch model.RemoteClusterPatch
	if jsonErr := json.NewDecoder(r.Body).Decode(&patch); jsonErr != nil {
		c.SetInvalidParamWithErr("remotecluster", jsonErr)
		return
	}

	auditRec := c.MakeAuditRecord("patchRemoteCluster", audit.Fail)
	audit.AddEventParameter(auditRec, "remote_id", c.Params.RemoteId)
	audit.AddEventParameterAuditable(auditRec, "remotecluster_patch", &patch)
	defer c.LogAuditRec(auditRec)

	orc, err := c.App.GetRemoteCluster(c.Params.RemoteId, false)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.AddEventPriorState(orc)
	auditRec.AddEventObjectType("remotecluster")

	updatedRC, err := c.App.PatchRemoteCluster(c.Params.RemoteId, &patch)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(updatedRC)

	if err := json.NewEncoder(w).Encode(updatedRC); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deleteRemoteCluster(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireRemoteId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSecureConnections) {
		c.SetPermissionError(model.PermissionManageSecureConnections)
		return
	}

	// make sure remote cluster service is enabled.
	if _, appErr := c.App.GetRemoteClusterService(); appErr != nil {
		c.Err = appErr
		return
	}

	auditRec := c.MakeAuditRecord("deleteRemoteCluster", audit.Fail)
	audit.AddEventParameter(auditRec, "remote_id", c.Params.RemoteId)
	defer c.LogAuditRec(auditRec)

	orc, err := c.App.GetRemoteCluster(c.Params.RemoteId, false)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.AddEventPriorState(orc)
	auditRec.AddEventObjectType("remotecluster")

	deleted, err := c.App.DeleteRemoteCluster(c.Params.RemoteId)
	if err != nil {
		c.Err = err
		return
	}
	if !deleted {
		c.Err = model.NewAppError("deleteRemoteCluster", "api.remote_cluster.cluster_not_deleted", nil, "", http.StatusInternalServerError)
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}
