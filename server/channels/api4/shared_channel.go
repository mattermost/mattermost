// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (api *API) InitSharedChannels() {
	api.BaseRoutes.SharedChannels.Handle("/{team_id:[A-Za-z0-9]+}", api.APISessionRequired(getSharedChannels)).Methods(http.MethodGet)
	api.BaseRoutes.SharedChannels.Handle("/remote_info/{remote_id:[A-Za-z0-9]+}", api.APISessionRequired(getRemoteClusterInfo)).Methods(http.MethodGet)
	api.BaseRoutes.SharedChannels.Handle("/{channel_id:[A-Za-z0-9]+}/remotes", api.APISessionRequired(getSharedChannelRemotes)).Methods(http.MethodGet)
	api.BaseRoutes.SharedChannels.Handle("/users/{user_id:[A-Za-z0-9]+}/can_dm/{other_user_id:[A-Za-z0-9]+}", api.APISessionRequired(canUserDirectMessage)).Methods(http.MethodGet)

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

	auditRec := c.MakeAuditRecord(model.AuditEventInviteRemoteClusterToChannel, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "remote_id", c.Params.RemoteId)
	model.AddEventParameterToAuditRec(auditRec, "channel_id", c.Params.ChannelId)
	model.AddEventParameterToAuditRec(auditRec, "user_id", c.AppContext.Session().UserId)

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

	auditRec := c.MakeAuditRecord(model.AuditEventUninviteRemoteClusterToChannel, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "remote_id", c.Params.RemoteId)
	model.AddEventParameterToAuditRec(auditRec, "channel_id", c.Params.ChannelId)

	hasRemote, err := c.App.HasRemote(c.Params.ChannelId, c.Params.RemoteId)
	if err != nil {
		c.Err = model.NewAppError("uninviteRemoteClusterToChannel", "api.shared_channel.has_remote_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	// if the channel is not shared with the remote, we return early
	if !hasRemote {
		auditRec.Success()
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

// getSharedChannelRemotes returns info about remote clusters for a shared channel
func getSharedChannelRemotes(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	// make sure remote cluster service is enabled.
	if _, appErr := c.App.GetRemoteClusterService(); appErr != nil {
		c.Err = appErr
		return
	}

	if ok, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionReadChannel); !ok {
		c.SetPermissionError(model.PermissionReadChannel)
		return
	}

	// Get the remotes status
	remoteStatuses, err := c.App.GetSharedChannelRemotesStatus(c.Params.ChannelId)
	if err != nil {
		c.Err = model.NewAppError("getSharedChannelRemotes", "api.command_share.fetch_remote_status.error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	// For each remote status, get the RemoteClusterInfo
	remoteInfos := make([]*model.RemoteClusterInfo, 0, len(remoteStatuses))
	for _, status := range remoteStatuses {
		// Use GetRemoteCluster to get the full remote cluster
		remoteCluster, appErr := c.App.GetRemoteCluster(status.ChannelId, false)
		if appErr == nil && remoteCluster != nil {
			info := remoteCluster.ToRemoteClusterInfo()
			remoteInfos = append(remoteInfos, &info)
		} else {
			// If we can't find the detailed info, create a basic RemoteClusterInfo from the status
			remoteInfos = append(remoteInfos, &model.RemoteClusterInfo{
				Name:        status.ChannelId,
				DisplayName: status.DisplayName,
				LastPingAt:  status.LastPingAt,
			})
		}
	}

	if err := json.NewEncoder(w).Encode(remoteInfos); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func canUserDirectMessage(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId().RequireOtherUserId()
	if c.Err != nil {
		return
	}

	// Check if the user can see the other user at all
	canSee, err := c.App.UserCanSeeOtherUser(c.AppContext, c.Params.UserId, c.Params.OtherUserId)
	if err != nil {
		c.Err = err
		return
	}
	if !canSee {
		result := map[string]bool{"can_dm": false}
		if err := json.NewEncoder(w).Encode(result); err != nil {
			c.Logger.Warn("Error encoding JSON response", mlog.Err(err))
		}
		return
	}

	canDM := true

	// Get shared channel sync service for remote user checks
	scs := c.App.Srv().GetSharedChannelSyncService()
	if scs != nil {
		otherUser, otherErr := c.App.GetUser(c.Params.OtherUserId)
		if otherErr != nil {
			canDM = false
		} else {
			originalRemoteId := otherUser.GetOriginalRemoteID()

			// Check if the other user is from a remote cluster
			if otherUser.IsRemote() {
				// If original remote ID is unknown, fall back to current RemoteId as best guess
				if originalRemoteId == model.UserOriginalRemoteIdUnknown {
					originalRemoteId = otherUser.GetRemoteID()
				}

				// For DMs, we require a direct connection to the ORIGINAL remote cluster
				isDirectlyConnected := scs.IsRemoteClusterDirectlyConnected(originalRemoteId)

				if !isDirectlyConnected {
					canDM = false
				}
			}
		}
	}

	result := map[string]bool{"can_dm": canDM}
	if err := json.NewEncoder(w).Encode(result); err != nil {
		c.Logger.Warn("Error encoding JSON response", mlog.Err(err))
	}
}
