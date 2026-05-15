// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// initChannelJoinRequestRoutes registers the discoverable-private-channel
// join request endpoints. The route group is split into its own file so the
// handlers stay isolated from the rest of api4/channel.go.
func (api *API) initChannelJoinRequestRoutes() {
	if !api.srv.Config().FeatureFlags.DiscoverableChannels {
		return
	}

	api.BaseRoutes.Channel.Handle("/join_request", api.APISessionRequired(requestJoinChannel)).Methods(http.MethodPost)
	api.BaseRoutes.Channel.Handle("/join_request", api.APISessionRequired(getMyChannelJoinRequest)).Methods(http.MethodGet)
	api.BaseRoutes.Channel.Handle("/join_request", api.APISessionRequired(withdrawMyChannelJoinRequest)).Methods(http.MethodDelete)

	api.BaseRoutes.Channel.Handle("/join_requests", api.APISessionRequired(getChannelJoinRequests)).Methods(http.MethodGet)
	api.BaseRoutes.Channel.Handle("/join_requests/count", api.APISessionRequired(countPendingChannelJoinRequests)).Methods(http.MethodGet)
	api.BaseRoutes.Channel.Handle("/join_requests/{request_id:[A-Za-z0-9]+}", api.APISessionRequired(patchChannelJoinRequest)).Methods(http.MethodPatch)

	api.BaseRoutes.User.Handle("/channel_join_requests", api.APISessionRequired(getMyChannelJoinRequests)).Methods(http.MethodGet)
}

// channelJoinRequestBody is the POST body shape for /channels/{id}/join_request.
type channelJoinRequestBody struct {
	Message string `json:"message"`
}

func requireDiscoverableChannelsEnabled(c *Context, where string) bool {
	if !c.App.Config().FeatureFlags.DiscoverableChannels {
		c.Err = model.NewAppError(where, "api.channel.discoverable_join_request.feature_disabled.app_error", nil, "", http.StatusNotFound)
		return false
	}
	return true
}

func requestJoinChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}
	if !requireDiscoverableChannelsEnabled(c, "requestJoinChannel") {
		return
	}

	var body channelJoinRequestBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		c.SetInvalidParamWithErr("body", err)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventCreateChannelJoinRequest, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "channel_id", c.Params.ChannelId)
	model.AddEventParameterToAuditRec(auditRec, "user_id", c.AppContext.Session().UserId)

	joined, req, appErr := c.App.RequestJoinChannel(c.AppContext, c.AppContext.Session().UserId, c.Params.ChannelId, body.Message)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	if req != nil {
		auditRec.AddEventResultState(req)
	}

	if joined {
		// Mirror the membership endpoint's "no body, just status" semantics
		// when the user was added directly via the ABAC fast path.
		w.WriteHeader(http.StatusCreated)
		if err := json.NewEncoder(w).Encode(map[string]string{"status": model.ChannelJoinRequestStatusApproved}); err != nil {
			c.Logger.Warn("Error while writing response", mlog.Err(err))
		}
		return
	}

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(req); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getMyChannelJoinRequest(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}
	if !requireDiscoverableChannelsEnabled(c, "getMyChannelJoinRequest") {
		return
	}

	req, appErr := c.App.GetMyChannelJoinRequest(c.AppContext, c.AppContext.Session().UserId, c.Params.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if req == nil {
		// Mirror REST conventions: not-found instead of an explicit `null`
		// so clients can distinguish "no pending request" from "service down".
		w.WriteHeader(http.StatusNotFound)
		return
	}

	if err := json.NewEncoder(w).Encode(req); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func withdrawMyChannelJoinRequest(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}
	if !requireDiscoverableChannelsEnabled(c, "withdrawMyChannelJoinRequest") {
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventWithdrawChannelJoinRequest, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "channel_id", c.Params.ChannelId)
	model.AddEventParameterToAuditRec(auditRec, "user_id", c.AppContext.Session().UserId)

	req, appErr := c.App.GetMyChannelJoinRequest(c.AppContext, c.AppContext.Session().UserId, c.Params.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}
	if req == nil {
		c.Err = model.NewAppError("withdrawMyChannelJoinRequest", "app.channel.join_request.not_found.app_error", nil, "channel_id="+c.Params.ChannelId, http.StatusNotFound)
		return
	}

	updated, appErr := c.App.WithdrawChannelJoinRequest(c.AppContext, req.Id, c.AppContext.Session().UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(updated)

	if err := json.NewEncoder(w).Encode(updated); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getChannelJoinRequests(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}
	if !requireDiscoverableChannelsEnabled(c, "getChannelJoinRequests") {
		return
	}

	if ok, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionManageChannelJoinRequests); !ok {
		c.SetPermissionError(model.PermissionManageChannelJoinRequests)
		return
	}

	opts := model.GetChannelJoinRequestsOpts{
		Status:  r.URL.Query().Get("status"),
		Page:    c.Params.Page,
		PerPage: c.Params.PerPage,
	}

	list, appErr := c.App.GetChannelJoinRequests(c.AppContext, c.Params.ChannelId, opts)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(list); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func countPendingChannelJoinRequests(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}
	if !requireDiscoverableChannelsEnabled(c, "countPendingChannelJoinRequests") {
		return
	}

	if ok, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionManageChannelJoinRequests); !ok {
		c.SetPermissionError(model.PermissionManageChannelJoinRequests)
		return
	}

	count, appErr := c.App.CountPendingChannelJoinRequests(c.AppContext, c.Params.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(map[string]int64{"count": count}); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func patchChannelJoinRequest(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}
	if !requireDiscoverableChannelsEnabled(c, "patchChannelJoinRequest") {
		return
	}
	if !model.IsValidId(c.Params.RequestId) {
		c.SetInvalidURLParam("request_id")
		return
	}

	if ok, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionManageChannelJoinRequests); !ok {
		c.SetPermissionError(model.PermissionManageChannelJoinRequests)
		return
	}

	var patch model.ChannelJoinRequestPatch
	if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
		c.SetInvalidParamWithErr("channel_join_request_patch", err)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventUpdateChannelJoinRequest, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "channel_id", c.Params.ChannelId)
	model.AddEventParameterToAuditRec(auditRec, "request_id", c.Params.RequestId)
	model.AddEventParameterToAuditRec(auditRec, "status", patch.Status)
	// Capture only the presence of a denial reason in the audit log; the
	// free-text contents are intentionally excluded.
	model.AddEventParameterToAuditRec(auditRec, "has_denial_reason", strconv.FormatBool(patch.DenialReason != nil && *patch.DenialReason != ""))

	updated, appErr := c.App.UpdateChannelJoinRequest(c.AppContext, c.Params.RequestId, c.Params.ChannelId, &patch, c.AppContext.Session().UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(updated)

	if err := json.NewEncoder(w).Encode(updated); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getMyChannelJoinRequests(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}
	if !requireDiscoverableChannelsEnabled(c, "getMyChannelJoinRequests") {
		return
	}

	// Only the calling user can list their own requests; admins should use
	// the per-channel queue endpoint.
	if c.Params.UserId != c.AppContext.Session().UserId {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	opts := model.GetChannelJoinRequestsOpts{
		Status:  r.URL.Query().Get("status"),
		Page:    c.Params.Page,
		PerPage: c.Params.PerPage,
	}

	list, appErr := c.App.GetMyChannelJoinRequests(c.AppContext, c.AppContext.Session().UserId, opts)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(list); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
