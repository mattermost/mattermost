// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func setupRemoteCluster(tb testing.TB) *TestHelper {
	return SetupConfig(tb, func(cfg *model.Config) {
		*cfg.ConnectedWorkspacesSettings.EnableRemoteClusterService = true
		*cfg.ConnectedWorkspacesSettings.EnableSharedChannels = true
	})
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
