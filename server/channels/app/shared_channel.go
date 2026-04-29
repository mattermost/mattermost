// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// isNotFoundError returns true if the error represents a not-found condition,
// checking both sql.ErrNoRows and store.ErrNotFound.
func isNotFoundError(err error) bool {
	if errors.Is(err, sql.ErrNoRows) {
		return true
	}
	var nfErr *store.ErrNotFound
	return errors.As(err, &nfErr)
}

func (a *App) getSharedChannelsService(ensureIsActive bool) (SharedChannelServiceIFace, error) {
	scService := a.Srv().GetSharedChannelSyncService()
	if scService == nil {
		return nil, model.NewAppError("getSharedChannelsService", "api.command_share.service_disabled",
			nil, "", http.StatusBadRequest)
	}
	if ensureIsActive && !scService.Active() {
		return nil, model.NewAppError("getSharedChannelsService", "api.command_share.service_inactive",
			nil, "", http.StatusInternalServerError)
	}
	return scService, nil
}

func (a *App) checkChannelNotShared(rctx request.CTX, channelId string) error {
	// check that channel exists.
	if _, appErr := a.GetChannel(rctx, channelId); appErr != nil {
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
			return fmt.Errorf("%w: %v", model.ErrChannelNotShared, err)
		}
		return fmt.Errorf("cannot find channel: %w", err)
	}
	return nil
}

func (a *App) CheckCanInviteToSharedChannel(channelId string) error {
	scService, err := a.getSharedChannelsService(false)
	if err != nil {
		return err
	}
	return scService.CheckCanInviteToSharedChannel(channelId)
}

// SharedChannels

func (a *App) ShareChannel(rctx request.CTX, sc *model.SharedChannel) (*model.SharedChannel, error) {
	scService, err := a.getSharedChannelsService(false)
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

func (a *App) GetSharedChannelsCount(opts model.SharedChannelFilterOpts) (int64, error) {
	return a.Srv().Store().SharedChannel().GetAllCount(opts)
}

func (a *App) UpdateSharedChannel(sc *model.SharedChannel) (*model.SharedChannel, error) {
	scService, err := a.getSharedChannelsService(false)
	if err != nil {
		return nil, err
	}
	return scService.UpdateSharedChannel(sc)
}

func (a *App) UnshareChannel(channelID string) (bool, error) {
	scService, err := a.getSharedChannelsService(false)
	if err != nil {
		return false, err
	}
	return scService.UnshareChannel(channelID)
}

// SharedChannelRemotes

func (a *App) InviteRemoteToChannel(channelID, remoteID, userID string, shareIfNotShared bool) error {
	ssService, err := a.getSharedChannelsService(false)
	if err != nil {
		return err
	}
	return ssService.InviteRemoteToChannel(channelID, remoteID, userID, shareIfNotShared)
}

func (a *App) UninviteRemoteFromChannel(channelID, remoteID string) error {
	ssService, err := a.getSharedChannelsService(false)
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

func (a *App) GetRemoteClusterForUser(remoteID string, userID string, includeDeleted bool) (*model.RemoteCluster, *model.AppError) {
	rc, err := a.Srv().Store().SharedChannel().GetRemoteForUser(remoteID, userID, includeDeleted)
	if err != nil {
		if isNotFoundError(err) {
			return nil, model.NewAppError("GetRemoteClusterForUser", "api.context.remote_id_invalid.app_error", nil, "", http.StatusNotFound).Wrap(err)
		}
		return nil, model.NewAppError("GetRemoteClusterForUser", "api.context.remote_id_invalid.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
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

// Plugin inbound sync APIs

// ReceiveSharedChannelSyncMsg processes an inbound sync message from a plugin remote.
// The pluginID is server-injected (from api.id) for ownership validation; remoteID
// is the caller-supplied remote identifier returned by RegisterPluginForSharedChannels.
func (a *App) ReceiveSharedChannelSyncMsg(rctx request.CTX, pluginID, remoteID string, msg *model.SyncMsg) (model.SyncResponse, error) {
	if msg == nil {
		return model.SyncResponse{}, fmt.Errorf("SyncMsg must not be nil")
	}

	scService, err := a.getSharedChannelsService(true)
	if err != nil {
		return model.SyncResponse{}, err
	}

	rc, err := a.Srv().Store().RemoteCluster().Get(remoteID, false)
	if err != nil {
		if isNotFoundError(err) {
			return model.SyncResponse{}, fmt.Errorf("remote %s not found: %w", remoteID, err)
		}
		return model.SyncResponse{}, fmt.Errorf("error looking up remote %s: %w", remoteID, err)
	}
	if rc.PluginID != pluginID {
		return model.SyncResponse{}, fmt.Errorf("remote %s does not belong to plugin %s", remoteID, pluginID)
	}

	return scService.ProcessSyncMessage(rctx, msg, rc)
}

// ReceiveSharedChannelAttachmentSyncMsg receives a file attachment from a plugin remote.
// The server constructs the file path, the plugin provides the FileInfo metadata and
// raw file bytes, but does not control where the file is stored.
// The pluginID is server-injected for ownership validation; remoteID is caller-supplied.
func (a *App) ReceiveSharedChannelAttachmentSyncMsg(rctx request.CTX, pluginID, remoteID, channelID string, fi *model.FileInfo, data io.Reader) (*model.FileInfo, error) {
	if fi == nil {
		return nil, model.NewAppError("ReceiveSharedChannelAttachmentSyncMsg",
			"api.shared_channel.attachment.file_info_required.app_error", nil, "", http.StatusBadRequest)
	}
	if data == nil {
		return nil, model.NewAppError("ReceiveSharedChannelAttachmentSyncMsg",
			"api.shared_channel.attachment.data_required.app_error", nil, "", http.StatusBadRequest)
	}
	if fi.CreatorId == "" {
		return nil, model.NewAppError("ReceiveSharedChannelAttachmentSyncMsg",
			"api.shared_channel.attachment.creator_id_required.app_error", nil, "", http.StatusBadRequest)
	}
	if fi.Name == "" {
		return nil, model.NewAppError("ReceiveSharedChannelAttachmentSyncMsg",
			"api.shared_channel.attachment.filename_required.app_error", nil, "", http.StatusBadRequest)
	}

	if _, err := a.getSharedChannelsService(true); err != nil {
		return nil, err
	}

	rc, err := a.Srv().Store().RemoteCluster().Get(remoteID, false)
	if err != nil {
		if isNotFoundError(err) {
			return nil, fmt.Errorf("remote %s not found: %w", remoteID, err)
		}
		return nil, fmt.Errorf("error looking up remote %s: %w", remoteID, err)
	}
	if rc.PluginID != pluginID {
		return nil, fmt.Errorf("remote %s does not belong to plugin %s", remoteID, pluginID)
	}

	// Validate channel is shared with this remote
	exists, err := a.Srv().Store().SharedChannel().HasRemote(channelID, rc.RemoteId)
	if err != nil {
		return nil, fmt.Errorf("error checking channel share state: %w", err)
	}
	if !exists {
		return nil, fmt.Errorf("channel %s is not shared with remote %s", channelID, rc.RemoteId)
	}

	// Validate the file creator belongs to this remote
	creator, creatorErr := a.Srv().Store().User().Get(rctx.Context(), fi.CreatorId)
	if creatorErr != nil {
		if isNotFoundError(creatorErr) {
			return nil, fmt.Errorf("creator %s not found: %w", fi.CreatorId, creatorErr)
		}
		return nil, fmt.Errorf("error looking up creator %s: %w", fi.CreatorId, creatorErr)
	}
	if creator.GetRemoteID() != rc.RemoteId {
		return nil, fmt.Errorf("creator %s does not belong to remote %s", fi.CreatorId, rc.RemoteId)
	}

	// Validate file attachments are enabled and size is within limits
	if !*a.Config().FileSettings.EnableFileAttachments {
		return nil, model.NewAppError("ReceiveSharedChannelAttachmentSyncMsg",
			"api.file.attachments.disabled.app_error", nil, "", http.StatusNotImplemented)
	}
	if a.Config().FileSettings.MaxFileSize != nil && fi.Size > *a.Config().FileSettings.MaxFileSize {
		return nil, model.NewAppError("ReceiveSharedChannelAttachmentSyncMsg",
			"api.upload.create.upload_too_large.app_error",
			map[string]any{"channelId": channelID}, "", http.StatusRequestEntityTooLarge)
	}

	// Create an upload session — this constructs the file path server-side
	us := &model.UploadSession{
		Id:        model.NewId(),
		Type:      model.UploadTypeAttachment,
		UserId:    fi.CreatorId,
		ChannelId: channelID,
		Filename:  fi.Name,
		FileSize:  fi.Size,
		RemoteId:  rc.RemoteId,
	}

	us, appErr := a.CreateUploadSession(rctx, us)
	if appErr != nil {
		return nil, fmt.Errorf("error creating upload session: %w", appErr)
	}

	// Upload the file data through the standard upload path
	saved, appErr := a.UploadData(rctx, us, data)
	if appErr != nil {
		return nil, fmt.Errorf("error uploading attachment data: %w", appErr)
	}

	// Save a SharedChannelAttachment record for cursor tracking
	sca := &model.SharedChannelAttachment{
		FileId:   saved.Id,
		RemoteId: rc.RemoteId,
	}
	if _, err := a.Srv().Store().SharedChannel().UpsertAttachment(sca); err != nil {
		rctx.Logger().Warn("Error saving shared channel attachment record",
			mlog.String("file_id", saved.Id),
			mlog.String("remote_id", rc.RemoteId),
			mlog.Err(err),
		)
	}

	return saved, nil
}

// ReceiveSharedChannelProfileImageSyncMsg receives a profile image from a plugin remote.
// The pluginID is server-injected for ownership validation; remoteID is caller-supplied.
func (a *App) ReceiveSharedChannelProfileImageSyncMsg(rctx request.CTX, pluginID, remoteID, userID string, image []byte) error {
	if _, err := a.getSharedChannelsService(true); err != nil {
		return err
	}

	rc, err := a.Srv().Store().RemoteCluster().Get(remoteID, false)
	if err != nil {
		if isNotFoundError(err) {
			return fmt.Errorf("remote %s not found: %w", remoteID, err)
		}
		return fmt.Errorf("error looking up remote %s: %w", remoteID, err)
	}
	if rc.PluginID != pluginID {
		return fmt.Errorf("remote %s does not belong to plugin %s", remoteID, pluginID)
	}

	// Validate user exists and belongs to this remote
	user, userErr := a.Srv().Store().User().Get(rctx.Context(), userID)
	if userErr != nil {
		if isNotFoundError(userErr) {
			return fmt.Errorf("user %s not found: %w", userID, userErr)
		}
		return fmt.Errorf("error looking up user %s: %w", userID, userErr)
	}
	if user.GetRemoteID() != rc.RemoteId {
		return fmt.Errorf("user %s does not belong to remote %s", userID, rc.RemoteId)
	}

	// Validate image size
	if a.Config().FileSettings.MaxFileSize != nil && int64(len(image)) > *a.Config().FileSettings.MaxFileSize {
		return model.NewAppError("ReceiveSharedChannelProfileImageSyncMsg",
			"api.user.upload_profile_user.too_large.app_error", nil, "", http.StatusRequestEntityTooLarge)
	}

	// Save profile image
	if appErr := a.SetProfileImageFromFile(rctx, userID, bytes.NewReader(image)); appErr != nil {
		return fmt.Errorf("error setting profile image: %w", appErr)
	}

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
