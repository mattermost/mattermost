// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"sync"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// Backoff bounds for the guard-cache reload retry. Package vars (not consts) so tests can shrink
// them via t.Cleanup-restored override.
var (
	guardCacheRetryInitialDelay = 1 * time.Second
	guardCacheRetryMaxDelay     = 5 * time.Minute
)

const clusterEventInvalidateChannelGuardCache = model.ClusterEvent("inv_channel_guards")

// reloadGuardCache scans the ChannelGuards table and atomically replaces the in-memory cache with
// the result. Used both at startup (from NewChannels) and from the cluster invalidation handler.
// Forces a master read because all callers (post-write reload, cluster invalidation) can race with
// replica lag.
func (ch *Channels) reloadGuardCache(rctx request.CTX, s store.Store) error {
	guards, err := s.ChannelGuard().GetAll(store.RequestContextWithMaster(rctx))
	if err != nil {
		return err
	}

	fresh := &sync.Map{}
	grouped := map[string][]*store.ChannelGuard{}
	for _, g := range guards {
		grouped[g.ChannelId] = append(grouped[g.ChannelId], g)
	}
	for channelID, slice := range grouped {
		fresh.Store(channelID, slice)
	}

	ch.guardCache.Store(fresh)
	return nil
}

// getGuardsForChannel returns the cached guard slice for a channel, or nil if none.
func (ch *Channels) getGuardsForChannel(channelID string) []*store.ChannelGuard {
	m := ch.guardCache.Load()
	if m == nil {
		return nil
	}
	v, ok := m.Load(channelID)
	if !ok {
		return nil
	}
	guards, _ := v.([]*store.ChannelGuard)
	return guards
}

// clusterInvalidateGuardCacheHandler is registered as the receive-side handler for
// clusterEventInvalidateChannelGuardCache. The handler refetches the entire table.
func (ch *Channels) clusterInvalidateGuardCacheHandler(msg *model.ClusterMessage) {
	rctx := request.EmptyContext(ch.srv.Log())
	if err := ch.reloadGuardCache(rctx, ch.srv.Store()); err != nil {
		ch.srv.Log().Warn(
			"Failed to reload channel guard cache after cluster invalidation; retry scheduled",
			mlog.String("event", string(msg.Event)),
			mlog.Err(err),
		)
		ch.scheduleGuardCacheReloadRetry()
	}
}

// broadcastChannelGuardInvalidation tells the rest of the cluster to refetch their guard caches.
// The payload is intentionally empty.
func (ch *Channels) broadcastChannelGuardInvalidation() {
	cluster := ch.srv.platform.Cluster()
	if cluster == nil {
		return
	}

	msg := &model.ClusterMessage{
		Event:            clusterEventInvalidateChannelGuardCache,
		SendType:         model.ClusterSendReliable,
		WaitForAllToSend: true,
	}
	cluster.SendClusterMessage(msg)
}

// RegisterChannelGuard records that pluginID claims channelID. The caller's pluginID is expected to
// be lowercased.
func (a *App) RegisterChannelGuard(rctx request.CTX, channelID, pluginID string) *model.AppError {
	if channelID == "" {
		return model.NewAppError("RegisterChannelGuard", "app.channel_guard.register.empty_channel.app_error", nil, "", http.StatusBadRequest)
	}
	if !model.IsValidId(channelID) {
		return model.NewAppError("RegisterChannelGuard", "app.channel_guard.invalid_channel.app_error", nil, "", http.StatusBadRequest)
	}

	guard := &store.ChannelGuard{
		ChannelId: channelID,
		PluginId:  pluginID,
		CreatedAt: model.GetMillis(),
	}
	if err := a.Srv().Store().ChannelGuard().Save(rctx, guard); err != nil {
		return model.NewAppError("RegisterChannelGuard", "app.channel_guard.register.app_error", nil, err.Error(), http.StatusInternalServerError).Wrap(err)
	}

	ch := a.Channels()
	if err := ch.reloadGuardCache(rctx, a.Srv().Store()); err != nil {
		a.Srv().Log().Warn(
			"Failed to reload channel guard cache after Register; retry scheduled",
			mlog.String("channel_id", channelID),
			mlog.String("plugin_id", pluginID),
			mlog.Err(err),
		)
		ch.scheduleGuardCacheReloadRetry()
	}
	ch.broadcastChannelGuardInvalidation()
	return nil
}

// UnregisterChannelGuard removes pluginID's claim on channelID. If pluginID has no claim on the
// channel, this is a no-op (returns nil). The store-level DELETE matches by both ChannelId and
// PluginId, so other plugins' claims on the same channel are left untouched.
func (a *App) UnregisterChannelGuard(rctx request.CTX, channelID, pluginID string) *model.AppError {
	if channelID == "" {
		return model.NewAppError("UnregisterChannelGuard", "app.channel_guard.unregister.empty_channel.app_error", nil, "", http.StatusBadRequest)
	}
	if !model.IsValidId(channelID) {
		return model.NewAppError("UnregisterChannelGuard", "app.channel_guard.invalid_channel.app_error", nil, "", http.StatusBadRequest)
	}

	rowsAffected, err := a.Srv().Store().ChannelGuard().Delete(rctx, channelID, pluginID)
	if err != nil {
		return model.NewAppError("UnregisterChannelGuard", "app.channel_guard.unregister.app_error", nil, err.Error(), http.StatusInternalServerError).Wrap(err)
	}
	if rowsAffected == 0 {
		a.Srv().Log().Warn(
			"UnregisterChannelGuard removed no rows; pluginID does not match any guard for this channel",
			mlog.String("error_id", "unregister_no_matching_guard"),
			mlog.String("channel_id", channelID),
			mlog.String("plugin_id", pluginID),
		)
	}

	ch := a.Channels()
	if err := ch.reloadGuardCache(rctx, a.Srv().Store()); err != nil {
		a.Srv().Log().Warn(
			"Failed to reload channel guard cache after Unregister; retry scheduled",
			mlog.String("channel_id", channelID),
			mlog.String("plugin_id", pluginID),
			mlog.Err(err),
		)
		ch.scheduleGuardCacheReloadRetry()
	}
	ch.broadcastChannelGuardInvalidation()
	return nil
}

// scheduleGuardCacheReloadRetry kicks off a single in-flight retry goroutine that calls
// reloadGuardCache with exponential backoff until success or until the server is shutting down.
// Multiple concurrent calls collapse to a single retry — useful when Register, Unregister, the
// cluster handler, and the startup loader can all see the same DB outage simultaneously.
//
// Returns true if a new retry goroutine was scheduled, false if one was already in flight. Call
// sites can ignore the return value; tests use it to assert single-flight semantics.
func (ch *Channels) scheduleGuardCacheReloadRetry() bool {
	if !ch.guardCacheRetryInFlight.CompareAndSwap(false, true) {
		return false
	}
	go ch.runGuardCacheReloadRetry()
	return true
}

func (ch *Channels) runGuardCacheReloadRetry() {
	defer ch.guardCacheRetryInFlight.Store(false)
	rctx := request.EmptyContext(ch.srv.Log())

	delay := guardCacheRetryInitialDelay
	for attempt := 1; ; attempt++ {
		timer := time.NewTimer(delay)
		select {
		case <-ch.interruptQuitChan:
			timer.Stop()
			ch.srv.Log().Info(
				"Channel guard cache reload retry cancelled by shutdown",
				mlog.Int("attempt", attempt),
			)
			return
		case <-timer.C:
		}

		if err := ch.reloadGuardCache(rctx, ch.srv.Store()); err != nil {
			ch.srv.Log().Info(
				"Channel guard cache reload retry attempt failed; will retry",
				mlog.Int("attempt", attempt),
				mlog.Err(err),
			)
			delay *= 2
			if delay > guardCacheRetryMaxDelay {
				delay = guardCacheRetryMaxDelay
			}
			continue
		}

		ch.srv.Log().Info(
			"Channel guard cache reload retry succeeded",
			mlog.Int("attempt", attempt),
		)
		return
	}
}
