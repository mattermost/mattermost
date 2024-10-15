// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/audit"
)

func (api *API) InitSharedChannels() {
	api.BaseRoutes.SharedChannels.Handle("/{team_id:[A-Za-z0-9]+}", api.APISessionRequired(getSharedChannels)).Methods(http.MethodGet)
	api.BaseRoutes.SharedChannels.Handle("/remote_info/{remote_id:[A-Za-z0-9]+}", api.APISessionRequired(getRemoteClusterInfo)).Methods(http.MethodGet)

	api.BaseRoutes.SharedChannelRemotes.Handle("", api.APISessionRequired(getSharedChannelRemotesByRemoteCluster)).Methods(http.MethodGet)
	api.BaseRoutes.ChannelForRemote.Handle("/invite", api.APISessionRequired(inviteRemoteClusterToChannel)).Methods(http.MethodPost)
	api.BaseRoutes.ChannelForRemote.Handle("/uninvite", api.APISessionRequired(uninviteRemoteClusterToChannel)).Methods(http.MethodPost)
}

func getSharedChannels(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	// make sure remote cluster service is enabled.
	if _, appErr := c.App.GetRemoteClusterService(); appErr != nil {
		c.Err = appErr
		return
	}

	// make sure user has access to the team.
	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
		return
	}

	opts := model.SharedChannelFilterOpts{
		TeamId: c.Params.TeamId,
	}

	// only return channels the user is a member of, unless they are a shared channels manager.
	if !c.App.HasPermissionTo(c.AppContext.Session().UserId, model.PermissionManageSharedChannels) {
		opts.MemberId = c.AppContext.Session().UserId
	}

	channels, appErr := c.App.GetSharedChannels(c.Params.Page, c.Params.PerPage, opts)
	if appErr != nil {
		c.Err = appErr
		return
	}

	b, err := json.Marshal(channels)
	if err != nil {
		c.SetJSONEncodingError(err)
		return
	}

	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getRemoteClusterInfo(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireRemoteId()
	if c.Err != nil {
		return
	}

	// make sure remote cluster service is enabled.
	if _, appErr := c.App.GetRemoteClusterService(); appErr != nil {
		c.Err = appErr
		return
	}

	// GetRemoteClusterForUser will only return a remote if the user is a member of at
	// least one channel shared by the remote. All other cases return error.
	rc, appErr := c.App.GetRemoteClusterForUser(c.Params.RemoteId, c.AppContext.Session().UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	remoteInfo := rc.ToRemoteClusterInfo()

	b, err := json.Marshal(remoteInfo)
	if err != nil {
		c.SetJSONEncodingError(err)
		return
	}
	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getSharedChannelRemotesByRemoteCluster(c *Context, w http.ResponseWriter, r *http.Request) {
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

	if _, appErr := c.App.GetRemoteCluster(c.Params.RemoteId, true); appErr != nil {
		c.Err = appErr
		return
	}

	filter := model.SharedChannelRemoteFilterOpts{
		RemoteId:           c.Params.RemoteId,
		IncludeUnconfirmed: c.Params.IncludeUnconfirmed,
		ExcludeConfirmed:   c.Params.ExcludeConfirmed,
		ExcludeHome:        c.Params.ExcludeHome,
		ExcludeRemote:      c.Params.ExcludeRemote,
		IncludeDeleted:     c.Params.IncludeDeleted,
	}
	sharedChannelRemotes, err := c.App.GetSharedChannelRemotes(c.Params.Page, c.Params.PerPage, filter)
	if err != nil {
		c.Err = model.NewAppError("getSharedChannelRemotesByRemoteCluster", "api.shared_channel.get_shared_channel_remotes_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if err := json.NewEncoder(w).Encode(sharedChannelRemotes); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func inviteRemoteClusterToChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireRemoteId()
	if c.Err != nil {
		return
	}

	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSecureConnections) {
		c.SetPermissionError(model.PermissionManageSharedChannels)
		return
	}

	// make sure remote cluster service is enabled.
	if _, appErr := c.App.GetRemoteClusterService(); appErr != nil {
		c.Err = appErr
		return
	}

	if _, appErr := c.App.GetRemoteCluster(c.Params.RemoteId, false); appErr != nil {
		c.SetInvalidRemoteIdError(c.Params.RemoteId)
		return
	}

	if _, appErr := c.App.GetChannel(c.AppContext, c.Params.ChannelId); appErr != nil {
		c.SetInvalidURLParam("channel_id")
		return
	}

	auditRec := c.MakeAuditRecord("inviteRemoteClusterToChannel", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "remote_id", c.Params.RemoteId)
	audit.AddEventParameter(auditRec, "channel_id", c.Params.ChannelId)
	audit.AddEventParameter(auditRec, "user_id", c.AppContext.Session().UserId)

	if err := c.App.InviteRemoteToChannel(c.Params.ChannelId, c.Params.RemoteId, c.AppContext.Session().UserId, true); err != nil {
		if appErr, ok := err.(*model.AppError); ok {
			c.Err = appErr
		} else {
			c.Err = model.NewAppError("inviteRemoteClusterToChannel", "api.shared_channel.invite_remote_to_channel_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func uninviteRemoteClusterToChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireRemoteId()
	if c.Err != nil {
		return
	}

	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSecureConnections) {
		c.SetPermissionError(model.PermissionManageSharedChannels)
		return
	}

	// make sure remote cluster service is enabled.
	if _, appErr := c.App.GetRemoteClusterService(); appErr != nil {
		c.Err = appErr
		return
	}

	if _, appErr := c.App.GetRemoteCluster(c.Params.RemoteId, false); appErr != nil {
		c.SetInvalidRemoteIdError(c.Params.RemoteId)
		return
	}

	if _, appErr := c.App.GetChannel(c.AppContext, c.Params.ChannelId); appErr != nil {
		c.SetInvalidURLParam("channel_id")
		return
	}

	auditRec := c.MakeAuditRecord("uninviteRemoteClusterToChannel", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "remote_id", c.Params.RemoteId)
	audit.AddEventParameter(auditRec, "channel_id", c.Params.ChannelId)

	hasRemote, err := c.App.HasRemote(c.Params.ChannelId, c.Params.RemoteId)
	if err != nil {
		c.Err = model.NewAppError("uninviteRemoteClusterToChannel", "api.shared_channel.has_remote_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	// if the channel is not shared with the remote, we return early
	if !hasRemote {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	if err := c.App.UninviteRemoteFromChannel(c.Params.ChannelId, c.Params.RemoteId); err != nil {
		c.Err = model.NewAppError("uninviteRemoteClusterToChannel", "api.shared_channel.uninvite_remote_to_channel_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}
