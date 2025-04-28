// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func (a *App) getSharedChannelsService() (SharedChannelServiceIFace, error) {
	scService := a.Srv().GetSharedChannelSyncService()
	if scService == nil || !scService.Active() {
		return nil, model.NewAppError("getSharedChannelsService", "api.command_share.service_disabled",
			nil, "", http.StatusBadRequest)
	}
	return scService, nil
}

func (a *App) checkChannelNotShared(c request.CTX, channelId string) error {
	// check that channel exists.
	if _, appErr := a.GetChannel(c, channelId); appErr != nil {
		return fmt.Errorf("cannot find channel: %w", appErr)
	}

	// Check channel is not already shared.
	if _, err := a.GetSharedChannel(channelId); err == nil {
		return model.ErrChannelAlreadyShared
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
	scService, err := a.getSharedChannelsService()
	if err != nil {
		return err
	}
	return scService.CheckCanInviteToSharedChannel(channelId)
}

// SharedChannels

func (a *App) ShareChannel(c request.CTX, sc *model.SharedChannel) (*model.SharedChannel, error) {
	scService, err := a.getSharedChannelsService()
	if err != nil {
		return nil, err
	}
	return scService.ShareChannel(sc)
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

func (a *App) GetSharedChannelsWithRemotes(page int, perPage int, opts model.SharedChannelFilterOpts) ([]*model.SharedChannelWithRemotes, *model.AppError) {
	channels, appErr := a.GetSharedChannels(page, perPage, opts)
	if appErr != nil {
		return nil, appErr
	}

	result := make([]*model.SharedChannelWithRemotes, 0, len(channels))

	// Create a map of channel IDs -> channel for faster access
	channelMap := make(map[string]*model.SharedChannel)

	// Map to collect unique remote IDs to fetch in a single batch
	remoteIDs := make(map[string]bool)

	// Track channels that need remotes data
	homeChannels := make([]string, 0, len(channels))

	// First pass - organize channels and collect remote IDs from non-home channels
	for _, channel := range channels {
		channelMap[channel.ChannelId] = channel
		if channel.Home {
			homeChannels = append(homeChannels, channel.ChannelId)
		} else if channel.RemoteId != "" {
			remoteIDs[channel.RemoteId] = true
		}
	}

	// Batch fetch all remotes for home channels
	allRemotes := make([]*model.SharedChannelRemote, 0)
	if len(homeChannels) > 0 {
		// Get remotes for each home channel
		for _, channelID := range homeChannels {
			remoteOpts := model.SharedChannelRemoteFilterOpts{
				ChannelId: channelID,
			}

			// Get the remotes for this channel
			channelRemotes, err := a.GetSharedChannelRemotes(0, 100, remoteOpts)
			if err != nil {
				a.Log().Warn("Error getting remotes for shared channel",
					mlog.String("channel_id", channelID),
					mlog.Err(err),
				)
				continue
			}

			allRemotes = append(allRemotes, channelRemotes...)

			// Collect remote IDs for batch fetching
			for _, remote := range channelRemotes {
				remoteIDs[remote.RemoteId] = true
			}
		}
	}

	// Fetch all remote clusters at once
	remoteClusters := make(map[string]*model.RemoteCluster)
	for remoteID := range remoteIDs {
		rc, err := a.GetRemoteCluster(remoteID, true)
		if err != nil {
			a.Log().Warn("Error getting remote cluster",
				mlog.String("remote_id", remoteID),
				mlog.Err(err),
			)
			continue
		}
		remoteClusters[remoteID] = rc
	}

	// Now build the results
	for _, channel := range channels {
		scwr := &model.SharedChannelWithRemotes{
			SharedChannel: channel,
			Remotes:       make([]model.RemoteClusterInfo, 0),
		}

		if channel.Home {
			// Find remotes for this channel from our batch fetch
			for _, remote := range allRemotes {
				if remote.ChannelId == channel.ChannelId {
					if rc, ok := remoteClusters[remote.RemoteId]; ok {
						scwr.Remotes = append(scwr.Remotes, rc.ToRemoteClusterInfo())
					}
				}
			}
		} else if channel.RemoteId != "" {
			// Add remote for non-home channel
			if rc, ok := remoteClusters[channel.RemoteId]; ok {
				scwr.Remotes = append(scwr.Remotes, rc.ToRemoteClusterInfo())
			}
		}

		result = append(result, scwr)
	}

	return result, nil
}

func (a *App) GetSharedChannelsCount(opts model.SharedChannelFilterOpts) (int64, error) {
	return a.Srv().Store().SharedChannel().GetAllCount(opts)
}

func (a *App) UpdateSharedChannel(sc *model.SharedChannel) (*model.SharedChannel, error) {
	scService, err := a.getSharedChannelsService()
	if err != nil {
		return nil, err
	}
	return scService.UpdateSharedChannel(sc)
}

func (a *App) UnshareChannel(channelID string) (bool, error) {
	scService, err := a.getSharedChannelsService()
	if err != nil {
		return false, err
	}
	return scService.UnshareChannel(channelID)
}

// SharedChannelRemotes

func (a *App) InviteRemoteToChannel(channelID, remoteID, userID string, shareIfNotShared bool) error {
	ssService, err := a.getSharedChannelsService()
	if err != nil {
		return err
	}
	return ssService.InviteRemoteToChannel(channelID, remoteID, userID, shareIfNotShared)
}

func (a *App) UninviteRemoteFromChannel(channelID, remoteID string) error {
	ssService, err := a.getSharedChannelsService()
	if err != nil {
		return err
	}
	return ssService.UninviteRemoteFromChannel(channelID, remoteID)
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

func (a *App) GetSharedChannelRemotes(page, perPage int, opts model.SharedChannelRemoteFilterOpts) ([]*model.SharedChannelRemote, error) {
	return a.Srv().Store().SharedChannel().GetRemotes(page*perPage, perPage, opts)
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
	a.sendUpdatedUserEvent(user)
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

var ErrPluginUnavailable = errors.New("plugin unavailable")

func getPluginHooks(env *plugin.Environment, pluginID string) (plugin.Hooks, error) {
	if env == nil {
		return nil, ErrPluginUnavailable
	}
	return env.HooksForPlugin(pluginID)
}

// OnSharedChannelsSyncMsg is called by the Shared Channels service for a registered plugin when there is new content
// that needs to be synchronized.
func (a *App) OnSharedChannelsSyncMsg(msg *model.SyncMsg, rc *model.RemoteCluster) (model.SyncResponse, error) {
	pluginHooks, err := getPluginHooks(a.GetPluginsEnvironment(), rc.PluginID)
	if err != nil {
		return model.SyncResponse{}, fmt.Errorf("cannot deliver sync msg to plugin %s: %w", rc.PluginID, err)
	}

	return pluginHooks.OnSharedChannelsSyncMsg(msg, rc)
}

// OnSharedChannelsPing is called by the Shared Channels service for a registered plugin to check that the plugin
// is still responding and has a connection to any upstream services it needs (e.g. MS Graph API).
func (a *App) OnSharedChannelsPing(rc *model.RemoteCluster) bool {
	pluginHooks, err := getPluginHooks(a.GetPluginsEnvironment(), rc.PluginID)
	if err != nil {
		// plugin was likely uninstalled. Issue a warning once per hour, with instructions how to clean up if this is
		// intentional.
		if time.Now().Minute() == 0 {
			msg := "Cannot find plugin for shared channels ping; if the plugin was intentionally uninstalled, "
			msg = msg + "stop this warning using  `/secure-connection remove --connectionID %s`"
			a.Log().Warn(fmt.Sprintf(msg, rc.RemoteId),
				mlog.String("plugin_id", rc.PluginID),
				mlog.Err(err),
			)
		}
		return false
	}

	return pluginHooks.OnSharedChannelsPing(rc)
}

// OnSharedChannelsAttachmentSyncMsg is called by the Shared Channels service for a registered plugin when a file attachment
// needs to be synchronized.
func (a *App) OnSharedChannelsAttachmentSyncMsg(fi *model.FileInfo, post *model.Post, rc *model.RemoteCluster) error {
	pluginHooks, err := getPluginHooks(a.GetPluginsEnvironment(), rc.PluginID)
	if err != nil {
		return fmt.Errorf("cannot deliver file attachment sync msg to plugin %s: %w", rc.PluginID, err)
	}

	return pluginHooks.OnSharedChannelsAttachmentSyncMsg(fi, post, rc)
}

// OnSharedChannelsProfileImageSyncMsg is called by the Shared Channels service for a registered plugin when a user's
// profile image needs to be synchronized.
func (a *App) OnSharedChannelsProfileImageSyncMsg(user *model.User, rc *model.RemoteCluster) error {
	pluginHooks, err := getPluginHooks(a.GetPluginsEnvironment(), rc.PluginID)
	if err != nil {
		return fmt.Errorf("cannot deliver user profile image sync msg to plugin %s: %w", rc.PluginID, err)
	}

	return pluginHooks.OnSharedChannelsProfileImageSyncMsg(user, rc)
}
