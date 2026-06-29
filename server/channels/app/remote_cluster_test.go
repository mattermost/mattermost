// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
	"github.com/mattermost/mattermost/server/v8/platform/services/remotecluster"
)

// Shorten the deferred initial ping for tests so RegisterPluginForSharedChannels
// teardown does not block on a 5s goroutine. No test in this package needs the
// production headroom. The value is large enough that even a slow runner where
// RegisterPluginForSharedChannels takes a couple hundred milliseconds still
// has comfortable margin before the deferred goroutine fires.
func init() {
	pluginRemoteInitialPingDelay = 500 * time.Millisecond
}

// pingTrackingRCService wraps a real RemoteClusterServiceIFace and records the
// time of every PingNow call without forwarding it. Embedding the interface
// satisfies the other methods by delegation.
type pingTrackingRCService struct {
	remotecluster.RemoteClusterServiceIFace
	pings chan time.Time
}

func (p *pingTrackingRCService) PingNow(rc *model.RemoteCluster) {
	select {
	case p.pings <- time.Now():
	default:
	}
}

func setupRemoteCluster(tb testing.TB) *TestHelper {
	return SetupConfig(tb, func(cfg *model.Config) {
		*cfg.ConnectedWorkspacesSettings.EnableRemoteClusterService = true
		*cfg.ConnectedWorkspacesSettings.EnableSharedChannels = true
	})
}

// TestSharedChannelServicesAvailableBeforePluginActivation guards the fix for
// MM-68622. Plugins that call shared channels APIs from OnActivate previously
// failed with "Shared Channels Service is disabled" because
// startInterClusterServices ran after Channels().Start() initialized plugins.
// Server.Start now starts the inter-cluster services first, so the services
// must be available by the time plugin initialization begins.
func TestSharedChannelServicesAvailableBeforePluginActivation(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupRemoteCluster(t).InitBasic(t)

	require.NotNil(t, th.Server.GetRemoteClusterService(),
		"remote cluster service must be initialized after Server.Start")
	require.NotNil(t, th.Server.GetSharedChannelSyncService(),
		"shared channel sync service must be initialized after Server.Start")

	// Order check: scs.resume() logs "Shared Channel Service active" from
	// scs.Start(), and initPlugins logs "Starting up plugins" from
	// Channels().Start(). The first must precede the second, otherwise plugin
	// OnActivate would observe a nil service.
	require.NoError(t, th.TestLogger.Flush())
	entries := testlib.ParseLogEntries(t, strings.NewReader(th.LogBuffer.String()))

	scsActiveIdx, pluginInitIdx := -1, -1
	for i, e := range entries {
		if scsActiveIdx == -1 && e.Msg == "Shared Channel Service active" {
			scsActiveIdx = i
		}
		if pluginInitIdx == -1 && e.Msg == "Starting up plugins" {
			pluginInitIdx = i
		}
	}
	require.NotEqual(t, -1, scsActiveIdx,
		"expected log message 'Shared Channel Service active' from scs.resume()")
	require.NotEqual(t, -1, pluginInitIdx,
		"expected log message 'Starting up plugins' from initPlugins")
	require.Less(t, scsActiveIdx, pluginInitIdx,
		"shared channel service must activate before plugin initialization (MM-68622)")

	// Plugin entry path: this is the App-layer call a plugin would make from
	// OnActivate. Before MM-68622 it would return "Shared Channels Service is
	// disabled" because GetSharedChannelSyncService() was still nil.
	pluginID := "com.test.startup-" + model.NewId()
	_, err := th.App.RegisterPluginForSharedChannels(th.Context, model.RegisterPluginOpts{
		Displayname: "startup test plugin",
		PluginID:    pluginID,
		CreatorID:   th.BasicUser.Id,
	})
	require.NoError(t, err,
		"RegisterPluginForSharedChannels must succeed when shared channels is enabled")
}

func TestAddRemoteCluster(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupRemoteCluster(t).InitBasic(t)

	t.Run("adding remote cluster with duplicate site url", func(t *testing.T) {
		remoteCluster := &model.RemoteCluster{
			Name:        "test1",
			SiteURL:     "http://www1.example.com:8065",
			Token:       model.NewId(),
			RemoteToken: model.NewId(),
			Topics:      "",
			CreatorId:   th.BasicUser.Id,
		}

		_, err := th.App.AddRemoteCluster(remoteCluster)
		require.Nil(t, err, "Adding a remote cluster should not error")

		remoteCluster.RemoteId = model.NewId()
		_, err = th.App.AddRemoteCluster(remoteCluster)
		require.Nil(t, err, "Adding a duplicate remote cluster should work fine")
	})
}

func TestUpdateRemoteCluster(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupRemoteCluster(t).InitBasic(t)

	t.Run("update remote cluster with an already existing site url", func(t *testing.T) {
		remoteCluster := &model.RemoteCluster{
			Name:        "test3",
			SiteURL:     "http://www3.example.com:8065",
			Token:       model.NewId(),
			RemoteToken: model.NewId(),
			Topics:      "",
			CreatorId:   th.BasicUser.Id,
		}

		otherRemoteCluster := &model.RemoteCluster{
			Name:        "test4",
			SiteURL:     "http://www4.example.com:8066",
			Token:       model.NewId(),
			RemoteToken: model.NewId(),
			Topics:      "",
			CreatorId:   th.BasicUser.Id,
		}

		_, err := th.App.AddRemoteCluster(remoteCluster)
		require.Nil(t, err, "Adding a remote cluster should not error")

		savedRemoteClustered, err := th.App.AddRemoteCluster(otherRemoteCluster)
		require.Nil(t, err, "Adding a remote cluster should not error")

		savedRemoteClustered.SiteURL = remoteCluster.SiteURL
		_, err = th.App.UpdateRemoteCluster(savedRemoteClustered)
		require.Nil(t, err, "Updating remote cluster with duplicate site url should work fine")
	})

	t.Run("update remote cluster with an already existing site url, is not allowed", func(t *testing.T) {
		remoteCluster := &model.RemoteCluster{
			Name:        "test5",
			SiteURL:     "http://www5.example.com:8065",
			Token:       model.NewId(),
			RemoteToken: model.NewId(),
			Topics:      "",
			CreatorId:   th.BasicUser.Id,
		}

		otherRemoteCluster := &model.RemoteCluster{
			Name:        "test6",
			SiteURL:     "http://www6.example.com:8065",
			Token:       model.NewId(),
			RemoteToken: model.NewId(),
			Topics:      "",
			CreatorId:   th.BasicUser.Id,
		}

		existingRemoteCluster, err := th.App.AddRemoteCluster(remoteCluster)
		require.Nil(t, err, "Adding a remote cluster should not error")

		anotherExistingRemoteClustered, err := th.App.AddRemoteCluster(otherRemoteCluster)
		require.Nil(t, err, "Adding a remote cluster should not error")

		// Same site url
		anotherExistingRemoteClustered.SiteURL = existingRemoteCluster.SiteURL
		_, err = th.App.UpdateRemoteCluster(anotherExistingRemoteClustered)
		require.Nil(t, err, "Updating remote cluster should work fine")
	})
}

func TestRegisterPluginForSharedChannels(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupRemoteCluster(t).InitBasic(t)

	t.Run("empty SiteURL defaults to plugin prefix", func(t *testing.T) {
		pluginID := "com.test.legacy-" + model.NewId()
		remoteID, err := th.App.RegisterPluginForSharedChannels(th.Context, model.RegisterPluginOpts{
			Displayname: "legacy plugin",
			PluginID:    pluginID,
			CreatorID:   th.BasicUser.Id,
		})
		require.NoError(t, err)

		rc, err := th.App.Srv().Store().RemoteCluster().Get(remoteID, false)
		require.NoError(t, err)
		require.Equal(t, "plugin_"+pluginID, rc.SiteURL)
	})

	t.Run("cross-plugin SiteURL collision returns error", func(t *testing.T) {
		siteURL := "nats://shared-" + model.NewId()

		_, err := th.App.RegisterPluginForSharedChannels(th.Context, model.RegisterPluginOpts{
			Displayname: "plugin A",
			PluginID:    "com.test.pluginA-" + model.NewId(),
			CreatorID:   th.BasicUser.Id,
			SiteURL:     siteURL,
		})
		require.NoError(t, err)

		_, err = th.App.RegisterPluginForSharedChannels(th.Context, model.RegisterPluginOpts{
			Displayname: "plugin B",
			PluginID:    "com.test.pluginB-" + model.NewId(),
			CreatorID:   th.BasicUser.Id,
			SiteURL:     siteURL,
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "already in use")
	})

	t.Run("idempotent re-registration returns same remoteID", func(t *testing.T) {
		pluginID := "com.test.idempotent-" + model.NewId()
		siteURL := "nats://idempotent-" + model.NewId()

		id1, err := th.App.RegisterPluginForSharedChannels(th.Context, model.RegisterPluginOpts{
			Displayname: "first call",
			PluginID:    pluginID,
			CreatorID:   th.BasicUser.Id,
			SiteURL:     siteURL,
		})
		require.NoError(t, err)

		id2, err := th.App.RegisterPluginForSharedChannels(th.Context, model.RegisterPluginOpts{
			Displayname: "second call",
			PluginID:    pluginID,
			CreatorID:   th.BasicUser.Id,
			SiteURL:     siteURL,
		})
		require.NoError(t, err)
		require.Equal(t, id1, id2)
	})

	t.Run("re-registering a soft-deleted SiteURL restores the row and pings the remote (MM-68838)", func(t *testing.T) {
		pluginID := "com.test.restore-" + model.NewId()
		siteURL := "nats://restore-" + model.NewId()

		// 1. Initial registration.
		id1, err := th.App.RegisterPluginForSharedChannels(th.Context, model.RegisterPluginOpts{
			Displayname: "restore test plugin",
			PluginID:    pluginID,
			CreatorID:   th.BasicUser.Id,
			SiteURL:     siteURL,
		})
		require.NoError(t, err)

		// 2. Unregister soft-deletes the row.
		require.NoError(t, th.App.UnregisterPluginRemoteForSharedChannels(pluginID, id1))

		rcDeleted, err := th.App.Srv().Store().RemoteCluster().Get(id1, true)
		require.NoError(t, err)
		require.NotZero(t, rcDeleted.DeleteAt, "row should be soft-deleted after unregister")

		// 3. Re-register the same SiteURL. The restore path must run.
		id2, err := th.App.RegisterPluginForSharedChannels(th.Context, model.RegisterPluginOpts{
			Displayname: "restore test plugin",
			PluginID:    pluginID,
			CreatorID:   th.BasicUser.Id,
			SiteURL:     siteURL,
		})
		require.NoError(t, err)
		require.Equal(t, id1, id2, "restore path must reuse the existing remoteID")

		// 4. The row must be restored (DeleteAt cleared). PingNow is called
		// inside the restore branch; the actual ping fails in unit tests
		// because no plugin process is loaded to answer OnSharedChannelsPing,
		// so we cannot assert on LastPingAt here. The presence of the call
		// is what fixes MM-68838 (offline-for-PingFreq window on restart).
		rcRestored, err := th.App.Srv().Store().RemoteCluster().Get(id2, false)
		require.NoError(t, err)
		require.Zero(t, rcRestored.DeleteAt, "row should be restored after re-register")
	})

	t.Run("multi-remote registration returns distinct remoteIDs", func(t *testing.T) {
		pluginID := "com.test.multi-" + model.NewId()

		id1, err := th.App.RegisterPluginForSharedChannels(th.Context, model.RegisterPluginOpts{
			Displayname: "remote 1",
			PluginID:    pluginID,
			CreatorID:   th.BasicUser.Id,
			SiteURL:     "nats://remote1-" + model.NewId(),
		})
		require.NoError(t, err)

		id2, err := th.App.RegisterPluginForSharedChannels(th.Context, model.RegisterPluginOpts{
			Displayname: "remote 2",
			PluginID:    pluginID,
			CreatorID:   th.BasicUser.Id,
			SiteURL:     "nats://remote2-" + model.NewId(),
		})
		require.NoError(t, err)
		require.NotEqual(t, id1, id2)
	})
}

func TestUnregisterPluginRemoteForSharedChannels(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupRemoteCluster(t).InitBasic(t)

	t.Run("successful removal of own remote", func(t *testing.T) {
		pluginID := "com.test.unregister-" + model.NewId()
		remoteID, err := th.App.RegisterPluginForSharedChannels(th.Context, model.RegisterPluginOpts{
			Displayname: "my remote",
			PluginID:    pluginID,
			CreatorID:   th.BasicUser.Id,
			SiteURL:     "nats://unregister-" + model.NewId(),
		})
		require.NoError(t, err)

		err = th.App.UnregisterPluginRemoteForSharedChannels(pluginID, remoteID)
		require.NoError(t, err)

		// Verify the remote is actually deleted
		rc, storeErr := th.App.Srv().Store().RemoteCluster().Get(remoteID, false)
		require.Error(t, storeErr, "deleted remote should not be found with includeDeleted=false")
		require.Nil(t, rc)

		// Second call should be a no-op (idempotent)
		err = th.App.UnregisterPluginRemoteForSharedChannels(pluginID, remoteID)
		require.NoError(t, err)
	})

	t.Run("removing another plugins remote returns error", func(t *testing.T) {
		pluginID := "com.test.owner-" + model.NewId()
		remoteID, err := th.App.RegisterPluginForSharedChannels(th.Context, model.RegisterPluginOpts{
			Displayname: "owned remote",
			PluginID:    pluginID,
			CreatorID:   th.BasicUser.Id,
			SiteURL:     "nats://owner-" + model.NewId(),
		})
		require.NoError(t, err)

		err = th.App.UnregisterPluginRemoteForSharedChannels("com.test.other-plugin", remoteID)
		require.Error(t, err)
		require.Contains(t, err.Error(), "does not belong to plugin")
	})

	t.Run("removing non-existent remoteID returns error", func(t *testing.T) {
		err := th.App.UnregisterPluginRemoteForSharedChannels("com.test.any", model.NewId())
		require.Error(t, err)
	})
}

func TestUnregisterPluginForSharedChannelsBulk(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupRemoteCluster(t).InitBasic(t)

	pluginID := "com.test.bulk-" + model.NewId()

	id1, err := th.App.RegisterPluginForSharedChannels(th.Context, model.RegisterPluginOpts{
		Displayname: "bulk remote 1",
		PluginID:    pluginID,
		CreatorID:   th.BasicUser.Id,
		SiteURL:     "nats://bulk1-" + model.NewId(),
	})
	require.NoError(t, err)

	id2, err := th.App.RegisterPluginForSharedChannels(th.Context, model.RegisterPluginOpts{
		Displayname: "bulk remote 2",
		PluginID:    pluginID,
		CreatorID:   th.BasicUser.Id,
		SiteURL:     "nats://bulk2-" + model.NewId(),
	})
	require.NoError(t, err)
	require.NotEqual(t, id1, id2)

	err = th.App.UnregisterPluginForSharedChannels(pluginID)
	require.NoError(t, err)

	// Both should be deleted
	remotes, err := th.App.Srv().Store().RemoteCluster().GetAllByPluginID(pluginID)
	require.NoError(t, err)
	require.Empty(t, remotes)
}

// TestRegisterPluginForSharedChannelsPingIsDeferred guards the race fix.
// A synchronous PingNow inside RegisterPluginForSharedChannels invoked the
// plugin's OnSharedChannelsPing hook before the calling plugin could record
// the returned RemoteId, so the very first ping always failed and the remote
// stayed offline for ~PingFreq (1 minute). The fix is to defer the initial
// ping to a goroutine. Both the new-row branch and the soft-delete-restore
// branch must defer.
func TestRegisterPluginForSharedChannelsPingIsDeferred(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupRemoteCluster(t).InitBasic(t)

	tracker := &pingTrackingRCService{
		RemoteClusterServiceIFace: th.Server.remoteClusterService,
		pings:                     make(chan time.Time, 8),
	}
	original := th.Server.remoteClusterService
	th.Server.remoteClusterService = tracker
	t.Cleanup(func() { th.Server.remoteClusterService = original })

	// Generous upper bound on real wall-time variance under load: the
	// production delay is 5s; init() overrides to 100ms; we wait up to
	// delay + 2s for the ping to actually arrive.
	const arrivalGrace = 2 * time.Second
	delay := pluginRemoteInitialPingDelay

	// drain consumes any pending ping timestamps so a later sub-case does
	// not see a stale one from an earlier sub-case.
	drain := func(ch <-chan time.Time) {
		for {
			select {
			case <-ch:
			default:
				return
			}
		}
	}

	assertDeferred := func(t *testing.T, registerStart time.Time) {
		t.Helper()
		// Phase 1: no ping in the first half of the delay (proves async).
		var prematurePing bool
		select {
		case <-tracker.pings:
			prematurePing = true
		case <-time.After(delay / 2):
		}
		require.False(t, prematurePing, "PingNow fired synchronously inside RegisterPluginForSharedChannels; the deferral is broken")
		// Phase 2: a ping arrives within delay + grace, and not before delay.
		var pingAt time.Time
		var pingArrived bool
		select {
		case pingAt = <-tracker.pings:
			pingArrived = true
		case <-time.After(delay + arrivalGrace):
		}
		require.True(t, pingArrived, "expected PingNow to fire within delay + grace, but it never did")
		elapsed := pingAt.Sub(registerStart)
		require.GreaterOrEqual(t, elapsed, delay,
			"PingNow fired %s after Register returned, before the configured delay of %s", elapsed, delay)
	}

	t.Run("new-row branch defers the initial ping", func(t *testing.T) {
		drain(tracker.pings)

		start := time.Now()
		_, err := th.App.RegisterPluginForSharedChannels(th.Context, model.RegisterPluginOpts{
			Displayname: "deferred ping plugin",
			PluginID:    "com.test.deferred-" + model.NewId(),
			CreatorID:   th.BasicUser.Id,
			SiteURL:     "nats://deferred-" + model.NewId(),
		})
		require.NoError(t, err)
		assertDeferred(t, start)
	})

	t.Run("soft-delete restore branch defers the ping (MM-68838)", func(t *testing.T) {
		drain(tracker.pings)

		pluginID := "com.test.restore-defer-" + model.NewId()
		siteURL := "nats://restore-defer-" + model.NewId()

		// Initial register to create the row; consume its deferred ping.
		id1, err := th.App.RegisterPluginForSharedChannels(th.Context, model.RegisterPluginOpts{
			Displayname: "restore defer plugin",
			PluginID:    pluginID,
			CreatorID:   th.BasicUser.Id,
			SiteURL:     siteURL,
		})
		require.NoError(t, err)
		var initialPingArrived bool
		select {
		case <-tracker.pings:
			initialPingArrived = true
		case <-time.After(delay + arrivalGrace):
		}
		require.True(t, initialPingArrived, "initial register's deferred ping never arrived")

		// Unregister soft-deletes the row.
		require.NoError(t, th.App.UnregisterPluginRemoteForSharedChannels(pluginID, id1))
		drain(tracker.pings)

		// Re-register: the restore branch must also defer.
		start := time.Now()
		_, err = th.App.RegisterPluginForSharedChannels(th.Context, model.RegisterPluginOpts{
			Displayname: "restore defer plugin",
			PluginID:    pluginID,
			CreatorID:   th.BasicUser.Id,
			SiteURL:     siteURL,
		})
		require.NoError(t, err)
		assertDeferred(t, start)
	})
}
