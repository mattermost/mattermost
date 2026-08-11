// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"database/sql"
	"encoding/base64"
	"fmt"
	"net/http"
	"time"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/v8/channels/store/sqlstore"
	"github.com/mattermost/mattermost/server/v8/platform/services/remotecluster"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// pluginRemoteInitialPingDelay is how long the framework waits after
// RegisterPluginForSharedChannels returns before firing the first ping to
// the newly created or restored plugin remote. The delay gives the
// calling plugin a chance to record the returned RemoteId in its own
// state, so the synchronous OnSharedChannelsPing hook the framework
// invokes can resolve the remote. Without the delay, the first ping for
// every freshly registered SiteURL fails and the remote stays offline
// until the periodic pingLoop refreshes it (up to PingFreq, default 1
// minute). Declared as a var, not const, so tests can shorten it.
var pluginRemoteInitialPingDelay = 5 * time.Second

// schedulePluginRemoteInitialPing schedules a single deferred ping for a
// freshly registered or restored plugin remote. The goroutine is launched
// via Server.Go so it cannot outlive the server. The remote is re-read
// before the ping fires because the plugin may have unregistered it
// inside the delay window; pinging a soft-deleted row is harmless but
// produces a stray "ping failed" warning.
func (a *App) schedulePluginRemoteInitialPing(rcService remotecluster.RemoteClusterServiceIFace, rc *model.RemoteCluster) {
	a.Srv().Go(func() {
		time.Sleep(pluginRemoteInitialPingDelay)
		current, err := a.Srv().Store().RemoteCluster().Get(rc.RemoteId, true)
		if err != nil || current.DeleteAt != 0 {
			return
		}
		rcService.PingNow(current)
	})
}

func (a *App) RegisterPluginForSharedChannels(rctx request.CTX, opts model.RegisterPluginOpts) (remoteID string, err error) {
	// When SiteURL is empty, fall back to the legacy single-remote behavior
	// using the "plugin_" prefix. This preserves compatibility for older plugins
	// that haven't been updated to provide a SiteURL.
	if opts.SiteURL == "" {
		opts.SiteURL = model.SiteURLPlugin + opts.PluginID
	}

	// Check if this SiteURL is already registered.
	rc, err := a.Srv().Store().RemoteCluster().GetBySiteURL(opts.SiteURL)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return "", err
	}

	if rc != nil {
		// SiteURL exists. Verify it belongs to this plugin.
		if rc.PluginID != opts.PluginID {
			return "", fmt.Errorf("SiteURL %q is already in use by remote %s (plugin %q)", opts.SiteURL, rc.RemoteId, rc.PluginID)
		}

		// Same plugin, same SiteURL: idempotent re-registration.
		if rc.DeleteAt != 0 {
			rctx.Logger().Debug("Restoring plugin registration for Shared Channels",
				mlog.String("plugin_id", opts.PluginID),
				mlog.String("remote_id", rc.RemoteId),
			)
			rc.DeleteAt = 0
		} else {
			rctx.Logger().Debug("Plugin already registered for Shared Channels",
				mlog.String("plugin_id", opts.PluginID),
				mlog.String("remote_id", rc.RemoteId),
			)
		}

		rc.DisplayName = opts.Displayname
		rc.Options = opts.GetOptionFlags()

		if _, err = a.Srv().Store().RemoteCluster().Update(rc); err != nil {
			return "", err
		}

		// Ping the restored plugin remote so its LastPingAt is refreshed
		// before sync attempts. Deferred via a goroutine (see
		// schedulePluginRemoteInitialPing) so the caller has a chance
		// to record the returned RemoteId before the synchronous
		// OnSharedChannelsPing hook fires. Without this the restored
		// remote stays offline until the next pingLoop iteration (up to
		// PingFreq), causing transient sync failures.
		rcService, _ := a.GetRemoteClusterService()
		if rcService != nil {
			a.schedulePluginRemoteInitialPing(rcService, rc)
		}
		return rc.RemoteId, nil
	}

	// New connection. Name must satisfy the slug-style regex enforced by
	// RemoteCluster.IsValid, so derive it from Displayname; the original
	// human-readable label is preserved on DisplayName.
	rc = &model.RemoteCluster{
		Name:        model.CleanRemoteName(opts.Displayname),
		DisplayName: opts.Displayname,
		SiteURL:     opts.SiteURL,
		Token:       model.NewId(),
		CreatorId:   opts.CreatorID,
		PluginID:    opts.PluginID,
		Options:     opts.GetOptionFlags(),
	}

	rcSaved, err := a.Srv().Store().RemoteCluster().Save(rc)
	if err != nil {
		return "", err
	}

	rctx.Logger().Debug("Registered new plugin for Shared Channels",
		mlog.String("plugin_id", opts.PluginID),
		mlog.String("remote_id", rcSaved.RemoteId),
		mlog.String("site_url", opts.SiteURL),
	)

	// Ping the new plugin remote, deferred via a goroutine so the
	// calling plugin has a chance to record the returned RemoteId
	// before the synchronous OnSharedChannelsPing hook fires for the
	// first time. A synchronous ping here would invoke the hook
	// before the caller's return statement, the plugin would fail to
	// resolve the new RemoteId, the ping would be recorded as failed,
	// and the remote would stay offline until the next pingLoop
	// iteration (up to PingFreq, default 1 minute). If the service is
	// not yet running the ping will fire from the periodic pingLoop
	// once the service starts.
	rcService, _ := a.GetRemoteClusterService()
	if rcService != nil {
		a.schedulePluginRemoteInitialPing(rcService, rcSaved)
	}

	return rcSaved.RemoteId, nil
}

// UnregisterPluginForSharedChannels unregisters all remotes for the specified plugin.
// Used in OnDeactivate for bulk cleanup.
func (a *App) UnregisterPluginForSharedChannels(pluginID string) error {
	remotes, err := a.Srv().Store().RemoteCluster().GetAllByPluginID(pluginID)
	if err != nil {
		return err
	}

	for _, rc := range remotes {
		if _, appErr := a.DeleteRemoteCluster(rc.RemoteId); appErr != nil {
			return appErr
		}
	}
	return nil
}

// UnregisterPluginRemoteForSharedChannels unregisters a specific remote by its remoteID.
// The pluginID is validated against the remote's PluginID to ensure a plugin can only
// unregister its own remotes.
func (a *App) UnregisterPluginRemoteForSharedChannels(pluginID, remoteID string) error {
	rc, err := a.Srv().Store().RemoteCluster().Get(remoteID, true)
	if err != nil {
		return err
	}

	if rc.PluginID != pluginID {
		return fmt.Errorf("remote %s does not belong to plugin %s", remoteID, pluginID)
	}

	if rc.DeleteAt != 0 {
		return nil
	}

	_, appErr := a.DeleteRemoteCluster(rc.RemoteId)
	if appErr != nil {
		return appErr
	}
	return nil
}

func (a *App) AddRemoteCluster(rc *model.RemoteCluster) (*model.RemoteCluster, *model.AppError) {
	rc, err := a.Srv().Store().RemoteCluster().Save(rc)
	if err != nil {
		if sqlstore.IsUniqueConstraintError(errors.Cause(err), []string{sqlstore.RemoteClusterSiteURLUniqueIndex}) {
			return nil, model.NewAppError("AddRemoteCluster", "api.remote_cluster.save_not_unique.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		return nil, model.NewAppError("AddRemoteCluster", "api.remote_cluster.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return rc, nil
}

func (a *App) PatchRemoteCluster(rcId string, patch *model.RemoteClusterPatch) (*model.RemoteCluster, *model.AppError) {
	rc, err := a.GetRemoteCluster(rcId, false)
	if err != nil {
		return nil, err
	}

	rc.Patch(patch)

	updatedRC, err := a.UpdateRemoteCluster(rc)
	if err != nil {
		return nil, err
	}

	return updatedRC, nil
}

func (a *App) UpdateRemoteCluster(rc *model.RemoteCluster) (*model.RemoteCluster, *model.AppError) {
	rc, err := a.Srv().Store().RemoteCluster().Update(rc)
	if err != nil {
		if sqlstore.IsUniqueConstraintError(errors.Cause(err), []string{sqlstore.RemoteClusterSiteURLUniqueIndex}) {
			return nil, model.NewAppError("UpdateRemoteCluster", "api.remote_cluster.update_not_unique.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		return nil, model.NewAppError("UpdateRemoteCluster", "api.remote_cluster.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return rc, nil
}

const sharedChannelRemotesPageSize = 10000

// sharedChannelIDsWithActiveRemotesForRemote returns channel IDs that have a non-deleted
// SharedChannelRemote row for the given remote cluster.
func (a *App) sharedChannelIDsWithActiveRemotesForRemote(remoteClusterID string) ([]string, error) {
	ss := a.Srv().Store()
	var channelIDs []string
	offset := 0
	for {
		remotes, err := ss.SharedChannel().GetRemotes(offset, sharedChannelRemotesPageSize, model.SharedChannelRemoteFilterOpts{
			RemoteId:           remoteClusterID,
			IncludeUnconfirmed: true,
		})
		if err != nil {
			return nil, err
		}
		for _, r := range remotes {
			channelIDs = append(channelIDs, r.ChannelId)
		}
		if len(remotes) < sharedChannelRemotesPageSize {
			break
		}
		offset += sharedChannelRemotesPageSize
	}
	return channelIDs, nil
}

// unshareSharedChannelsIfNoRemotes unshares each channel in channelIDs that has no remaining
// SharedChannelRemote rows. The check matches sharedchannel.Service.unshareChannelIfNoActiveRemotes
// (GetRemotes with IncludeUnconfirmed: true). If the shared channel sync service is not
// running, the shared channel row is removed via the store instead of UnshareChannel.
func (a *App) unshareSharedChannelsIfNoRemotes(channelIDs []string) {
	ss := a.Srv().Store()
	scService := a.Srv().GetSharedChannelSyncService()

	for _, channelID := range channelIDs {
		remotes, err := ss.SharedChannel().GetRemotes(0, 1, model.SharedChannelRemoteFilterOpts{ChannelId: channelID, IncludeUnconfirmed: true})
		if err != nil {
			a.Log().Error("Failed to check remaining shared channel remotes after remote cluster delete",
				mlog.String("channel_id", channelID),
				mlog.Err(err),
			)
			continue
		}
		if len(remotes) > 0 {
			continue
		}
		if scService != nil {
			if _, err := scService.UnshareChannel(channelID); err != nil {
				a.Log().Error("Failed to unshare channel with no remaining remotes",
					mlog.String("channel_id", channelID),
					mlog.Err(err),
				)
			}
			continue
		}
		if _, err := ss.SharedChannel().Delete(channelID); err != nil {
			a.Log().Error("Failed to unshare channel via store after remote cluster delete",
				mlog.String("channel_id", channelID),
				mlog.Err(err),
			)
		}
	}
}

func (a *App) DeleteRemoteCluster(remoteClusterId string) (bool, *model.AppError) {
	affectedChannelIDs, listErr := a.sharedChannelIDsWithActiveRemotesForRemote(remoteClusterId)
	if listErr != nil {
		a.Log().Warn("Could not list shared channel remotes before deleting remote cluster; skipping orphan shared-channel cleanup",
			mlog.String("remote_id", remoteClusterId),
			mlog.Err(listErr),
		)
	}

	deleted, err := a.Srv().Store().RemoteCluster().Delete(remoteClusterId)
	if err != nil {
		return false, model.NewAppError("DeleteRemoteCluster", "api.remote_cluster.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if deleted && listErr == nil {
		a.unshareSharedChannelsIfNoRemotes(affectedChannelIDs)
	}
	return deleted, nil
}

func (a *App) GetRemoteCluster(remoteClusterId string, includeDeleted bool) (*model.RemoteCluster, *model.AppError) {
	rc, err := a.Srv().Store().RemoteCluster().Get(remoteClusterId, includeDeleted)
	if err != nil {
		switch {
		case errors.Is(err, sql.ErrNoRows):
			return nil, model.NewAppError("GetRemoteCluster", "api.remote_cluster.get.not_found", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetRemoteCluster", "api.remote_cluster.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return rc, nil
}

func (a *App) GetAllRemoteClusters(page, perPage int, filter model.RemoteClusterQueryFilter) ([]*model.RemoteCluster, *model.AppError) {
	list, err := a.Srv().Store().RemoteCluster().GetAll(page*perPage, perPage, filter)
	if err != nil {
		return nil, model.NewAppError("GetAllRemoteClusters", "api.remote_cluster.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, nil
}

func (a *App) UpdateRemoteClusterTopics(remoteClusterId string, topics string) (*model.RemoteCluster, *model.AppError) {
	rc, err := a.Srv().Store().RemoteCluster().UpdateTopics(remoteClusterId, topics)
	if err != nil {
		return nil, model.NewAppError("UpdateRemoteClusterTopics", "api.remote_cluster.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return rc, nil
}

func (a *App) SetRemoteClusterLastPingAt(remoteClusterId string) *model.AppError {
	err := a.Srv().Store().RemoteCluster().SetLastPingAt(remoteClusterId)
	if err != nil {
		return model.NewAppError("SetRemoteClusterLastPingAt", "api.remote_cluster.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

func (a *App) GetRemoteClusterService() (remotecluster.RemoteClusterServiceIFace, *model.AppError) {
	service := a.Srv().GetRemoteClusterService()
	if service == nil {
		return nil, model.NewAppError("GetRemoteClusterService", "api.remote_cluster.service_not_enabled.app_error", nil, "", http.StatusNotImplemented)
	}
	return service, nil
}

func (a *App) CreateRemoteClusterInvite(remoteId, siteURL, token, password string) (string, *model.AppError) {
	invite := &model.RemoteClusterInvite{
		RemoteId: remoteId,
		SiteURL:  siteURL,
		Token:    token,
		Version:  3,
	}

	if err := invite.IsValid(); err != nil {
		return "", model.NewAppError("CreateRemoteClusterInvite", "api.remote_cluster.create_invite_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	encrypted, err := invite.Encrypt(password)
	if err != nil {
		return "", model.NewAppError("CreateRemoteClusterInvite", "api.remote_cluster.encrypt_invite_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return base64.URLEncoding.EncodeToString(encrypted), nil
}

func (a *App) DecryptRemoteClusterInvite(inviteCode, password string) (*model.RemoteClusterInvite, *model.AppError) {
	decoded, err := base64.URLEncoding.DecodeString(inviteCode)
	if err != nil {
		return nil, model.NewAppError("DecryptRemoteClusterInvite", "api.remote_cluster.base64_decode_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	invite := &model.RemoteClusterInvite{}
	if dErr := invite.Decrypt(decoded, password); dErr != nil {
		return nil, model.NewAppError("DecryptRemoteClusterInvite", "api.remote_cluster.invite_decrypt_error", nil, "", http.StatusBadRequest).Wrap(dErr)
	}

	return invite, nil
}
