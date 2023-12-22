// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

var (
	errNotFound = errors.New("not found")
)

func (a *App) checkChannelNotShared(c request.CTX, channelId string) error {
	// check that channel exists.
	if _, err := a.GetChannel(c, channelId); err != nil {
		return fmt.Errorf("cannot share this channel: %w", err)
	}

	// Check channel is not already shared.
	if _, err := a.GetSharedChannel(channelId); err == nil {
		var errNotFound *store.ErrNotFound
		if errors.As(err, &errNotFound) {
			return fmt.Errorf("channel is already shared: %w", err)
		}
		return fmt.Errorf("cannot find channel: %w", err)
	}
	return nil
}

func (a *App) checkChannelIsShared(channelId string) error {
	if _, err := a.GetSharedChannel(channelId); err != nil {
		var errNotFound *store.ErrNotFound
		if errors.As(err, &errNotFound) {
			return fmt.Errorf("channel is not shared: %w", err)
		}
		return fmt.Errorf("cannot find channel: %w", err)
	}
	return nil
}

func (a *App) CheckCanInviteToSharedChannel(channelId string) error {
	sc, err := a.GetSharedChannel(channelId)
	if err != nil {
		var errNotFound *store.ErrNotFound
		if errors.As(err, &errNotFound) {
			return fmt.Errorf("channel is not shared: %w", err)
		}
		return fmt.Errorf("cannot find channel: %w", err)
	}

	if !sc.Home {
		return errors.New("channel is homed on a remote cluster")
	}
	return nil
}

func (a *App) notifyClientsForSharedChannelUpdate(teamID, channelID string) {
	messageWs := model.NewWebSocketEvent(model.WebsocketEventChannelConverted, teamID, "", "", nil, "")
	messageWs.Add("channel_id", channelID)
	a.Publish(messageWs)
}

// SharedChannels

func (a *App) ShareChannel(c request.CTX, sc *model.SharedChannel) (*model.SharedChannel, error) {
	if err := a.checkChannelNotShared(c, sc.ChannelId); err != nil {
		return nil, err
	}

	// stores a SharedChannel and set the share flag on the channel.
	scNew, err := a.Srv().Store().SharedChannel().Save(sc)
	if err != nil {
		return nil, err
	}

	a.notifyClientsForSharedChannelUpdate(scNew.TeamId, scNew.ChannelId)
	return scNew, nil
}

func (a *App) GetSharedChannel(channelID string) (*model.SharedChannel, error) {
	return a.Srv().Store().SharedChannel().Get(channelID)
}

func (a *App) HasSharedChannel(channelID string) (bool, error) {
	return a.Srv().Store().SharedChannel().HasChannel(channelID)
}

func (a *App) GetSharedChannels(page int, perPage int, opts model.SharedChannelFilterOpts) ([]*model.SharedChannel, *model.AppError) {
	channels, err := a.Srv().Store().SharedChannel().GetAll(page*perPage, perPage, opts)
	if err != nil {
		return nil, model.NewAppError("GetSharedChannels", "app.channel.get_channels.not_found.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return channels, nil
}

func (a *App) GetSharedChannelsCount(opts model.SharedChannelFilterOpts) (int64, error) {
	return a.Srv().Store().SharedChannel().GetAllCount(opts)
}

func (a *App) UpdateSharedChannel(sc *model.SharedChannel) (*model.SharedChannel, error) {
	scUpdated, err := a.Srv().Store().SharedChannel().Update(sc)
	if err != nil {
		return nil, err
	}
	a.notifyClientsForSharedChannelUpdate(scUpdated.TeamId, scUpdated.ChannelId)
	return scUpdated, nil
}

func (a *App) UnshareChannel(channelID string) (bool, error) {
	// fetch the SharedChannel first
	sc, err := a.GetSharedChannel(channelID)
	if err != nil {
		return false, err
	}

	// deletes the ShareChannel, unsets the share flag on the channel, deletes all remotes for the channel
	deleted, err := a.Srv().Store().SharedChannel().Delete(channelID)
	if err != nil {
		return false, err
	}
	a.notifyClientsForSharedChannelUpdate(sc.TeamId, sc.ChannelId)
	return deleted, nil
}

// SharedChannelRemotes

func (a *App) InviteRemoteToChannel(channelID, remoteID, userID string) error {
	syncService := a.Srv().GetSharedChannelSyncService()
	if syncService == nil || !syncService.Active() {
		return model.NewAppError("InviteRemoteToChannel", "api.command_share.service_disabled",
			nil, "", http.StatusBadRequest)
	}

	hasRemote, err := a.HasRemote(channelID, remoteID)
	if err != nil {
		return model.NewAppError("InviteRemoteToChannel", "api.command_share.fetch_remote.error",
			map[string]any{"Error": err.Error()}, "", http.StatusBadRequest)
	}
	if hasRemote {
		// already invited
		return nil
	}

	// Check if channel is shared or not.
	hasChan, err := a.HasSharedChannel(channelID)
	if err != nil {
		return model.NewAppError("InviteRemoteToChannel", "api.command_share.check_channel_exist.error",
			map[string]any{"ChannelID": channelID, "Error": err.Error()}, "", http.StatusBadRequest)
	}
	if !hasChan {
		return model.NewAppError("InviteRemoteToChannel", "api.command_share.channel_not_shared.error",
			map[string]any{"ChannelID": channelID}, "", http.StatusBadRequest)
	}

	// don't allow invitation to shared channel originating from remote.
	// (also blocks cyclic invitations)
	if err := a.CheckCanInviteToSharedChannel(channelID); err != nil {
		return model.NewAppError("InviteRemoteToChannel", "api.command_share.channel_invite_not_home.error", nil, "", http.StatusBadRequest)
	}

	rc, appErr := a.GetRemoteCluster(remoteID)
	if appErr != nil {
		return model.NewAppError("InviteRemoteToChannel", "api.command_share.remote_id_invalid.error",
			map[string]any{"Error": appErr.Error()}, "", http.StatusBadRequest).Wrap(appErr)
	}

	channel, errApp := a.GetChannel(request.EmptyContext(a.Log()), channelID)
	if errApp != nil {
		return model.NewAppError("InviteRemoteToChannel", "api.command_share.channel_invite.error",
			map[string]any{"Name": rc.DisplayName, "Error": errApp.Error()}, "", http.StatusBadRequest).Wrap(appErr)
	}
	// send channel invite to remote cluster. Will notify clients of channel change.
	if err := syncService.SendChannelInvite(channel, userID, rc); err != nil {
		return model.NewAppError("InviteRemoteToChannel", "api.command_share.channel_invite.error",
			map[string]any{"Name": rc.DisplayName, "Error": err.Error()}, "", http.StatusBadRequest).Wrap(err)
	}
	return nil
}

func (a *App) UninviteRemoteFromChannel(channelID, remoteID string) error {
	scr, err := a.GetSharedChannelRemoteByIds(channelID, remoteID)
	if err != nil || scr.ChannelId != channelID {
		return model.NewAppError("UninviteRemoteFromChannel", "api.command_share.channel_remote_id_not_exists",
			map[string]any{"RemoteId": remoteID}, "", http.StatusBadRequest)
	}

	deleted, err := a.Srv().Store().SharedChannel().DeleteRemote(scr.Id)
	if err != nil || !deleted {
		if err == nil {
			err = errNotFound
		}
		return model.NewAppError("UninviteRemoteFromChannel", "api.command_share.could_not_uninvite.error",
			map[string]any{"RemoteId": remoteID, "Error": err.Error()}, "", http.StatusBadRequest)
	}
	return nil
}

func (a *App) SaveSharedChannelRemote(remote *model.SharedChannelRemote) (*model.SharedChannelRemote, error) {
	if err := a.checkChannelIsShared(remote.ChannelId); err != nil {
		return nil, err
	}
	return a.Srv().Store().SharedChannel().SaveRemote(remote)
}

func (a *App) GetSharedChannelRemote(id string) (*model.SharedChannelRemote, error) {
	return a.Srv().Store().SharedChannel().GetRemote(id)
}

func (a *App) GetSharedChannelRemoteByIds(channelID string, remoteID string) (*model.SharedChannelRemote, error) {
	return a.Srv().Store().SharedChannel().GetRemoteByIds(channelID, remoteID)
}

func (a *App) GetSharedChannelRemotes(opts model.SharedChannelRemoteFilterOpts) ([]*model.SharedChannelRemote, error) {
	return a.Srv().Store().SharedChannel().GetRemotes(opts)
}

// HasRemote returns whether a given channelID is present in the channel remotes or not.
func (a *App) HasRemote(channelID string, remoteID string) (bool, error) {
	return a.Srv().Store().SharedChannel().HasRemote(channelID, remoteID)
}

func (a *App) GetRemoteClusterForUser(remoteID string, userID string) (*model.RemoteCluster, *model.AppError) {
	rc, err := a.Srv().Store().SharedChannel().GetRemoteForUser(remoteID, userID)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetRemoteClusterForUser", "api.context.remote_id_invalid.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetRemoteClusterForUser", "api.context.remote_id_invalid.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return rc, nil
}

func (a *App) UpdateSharedChannelRemoteCursor(id string, cursor model.GetPostsSinceForSyncCursor) error {
	return a.Srv().Store().SharedChannel().UpdateRemoteCursor(id, cursor)
}

func (a *App) DeleteSharedChannelRemote(id string) (bool, error) {
	return a.Srv().Store().SharedChannel().DeleteRemote(id)
}

func (a *App) GetSharedChannelRemotesStatus(channelID string) ([]*model.SharedChannelRemoteStatus, error) {
	if err := a.checkChannelIsShared(channelID); err != nil {
		return nil, err
	}
	return a.Srv().Store().SharedChannel().GetRemotesStatus(channelID)
}

// SharedChannelUsers

func (a *App) NotifySharedChannelUserUpdate(user *model.User) {
	a.sendUpdatedUserEvent(*user)
}

// onUserProfileChange is called when a user's profile has changed
// (username, email, profile image, ...)
func (a *App) onUserProfileChange(userID string) {
	syncService := a.Srv().GetSharedChannelSyncService()
	if syncService == nil || !syncService.Active() {
		return
	}
	syncService.NotifyUserProfileChanged(userID)
}

// Sync

// UpdateSharedChannelCursor updates the cursor for the specified channelID and remoteID.
// This can be used to manually set the point of last sync, either forward to skip older posts,
// or backward to re-sync history.
// This call by itself does not force a re-sync - a change to channel contents or a call to
// SyncSharedChannel are needed to force a sync.
func (a *App) UpdateSharedChannelCursor(channelID, remoteID string, cursor model.GetPostsSinceForSyncCursor) error {
	src, err := a.Srv().Store().SharedChannel().GetRemoteByIds(channelID, remoteID)
	if err != nil {
		return fmt.Errorf("cursor update failed - cannot fetch shared channel remote: %w", err)
	}
	return a.Srv().Store().SharedChannel().UpdateRemoteCursor(src.Id, cursor)
}

// SyncSharedChannel forces a shared channel to send any changed content to all remote clusters.
func (a *App) SyncSharedChannel(channelID string) error {
	syncService := a.Srv().GetSharedChannelSyncService()
	if syncService == nil || !syncService.Active() {
		return model.NewAppError("InviteRemoteToChannel", "api.command_share.service_disabled",
			nil, "", http.StatusBadRequest)
	}

	syncService.NotifyChannelChanged(channelID)
	return nil
}

// Hooks

var ErrPluginUnavailable = errors.New("plugin unavialable")

// OnSharedChannelsSyncMsg is called by the Shared Channels service for a registered plugin when there is new content
// that needs to be synchronized.
func (a *App) OnSharedChannelsSyncMsg(msg *model.SyncMsg, rc *model.RemoteCluster) (model.SyncResponse, error) {
	pluginsEnvironment := a.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return model.SyncResponse{}, fmt.Errorf("cannot deliver sync msg to plugin %s: %w", rc.PluginID, ErrPluginUnavailable)
	}

	pluginHooks, err := pluginsEnvironment.HooksForPlugin(rc.PluginID)
	if err != nil {
		return model.SyncResponse{}, fmt.Errorf("cannot deliver sync msg to plugin %s: %w", rc.PluginID, err)
	}

	return pluginHooks.OnSharedChannelsSyncMsg(msg, rc)
}

// OnSharedChannelsPing is called by the Shared Channels service for a registered plugin wto check that the plugin
// is still responding and has a connection to any upstream services it needs (e.g. MS Graph API).
func (a *App) OnSharedChannelsPing(rc *model.RemoteCluster) bool {
	pluginsEnvironment := a.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return false
	}

	pluginHooks, err := pluginsEnvironment.HooksForPlugin(rc.PluginID)
	if err != nil {
		return false
	}

	return pluginHooks.OnSharedChannelsPing(rc)
}
