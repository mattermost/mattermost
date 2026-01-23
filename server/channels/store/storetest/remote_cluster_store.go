// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRemoteClusterStore(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("RemoteClusterGetAllInChannel", func(t *testing.T) { testRemoteClusterGetAllInChannel(t, rctx, ss) })
	t.Run("RemoteClusterGetAllNotInChannel", func(t *testing.T) { testRemoteClusterGetAllNotInChannel(t, rctx, ss) })
	t.Run("RemoteClusterSave", func(t *testing.T) { testRemoteClusterSave(t, rctx, ss) })
	t.Run("RemoteClusterDelete", func(t *testing.T) { testRemoteClusterDelete(t, rctx, ss) })
	t.Run("RemoteClusterGet", func(t *testing.T) { testRemoteClusterGet(t, rctx, ss) })
	t.Run("RemoteClusterGetByPluginID", func(t *testing.T) { testRemoteClusterGetByPluginID(t, rctx, ss) })
	t.Run("RemoteClusterGetAll", func(t *testing.T) { testRemoteClusterGetAll(t, rctx, ss) })
	t.Run("RemoteClusterGetByTopic", func(t *testing.T) { testRemoteClusterGetByTopic(t, rctx, ss) })
	t.Run("RemoteClusterUpdateTopics", func(t *testing.T) { testRemoteClusterUpdateTopics(t, rctx, ss) })
}

func makeSiteURL() string {
	return "www.example.com/" + model.NewId()
}

func testRemoteClusterSave(t *testing.T, _ request.CTX, ss store.Store) {
	t.Run("Save", func(t *testing.T) {
		rc := &model.RemoteCluster{
			Name:      "some_remote",
			SiteURL:   makeSiteURL(),
			CreatorId: model.NewId(),
			PluginID:  model.NewId(),
		}

		rcSaved, err := ss.RemoteCluster().Save(rc)
		require.NoError(t, err)
		require.Equal(t, rc.Name, rcSaved.Name)
		require.Equal(t, rc.SiteURL, rcSaved.SiteURL)
		require.Greater(t, rc.CreateAt, int64(0))
		require.Equal(t, rc.LastPingAt, int64(0))
		require.Equal(t, rc.PluginID, rcSaved.PluginID)
		require.Equal(t, rc.Options, model.Bitmask(0))
	})

	t.Run("Save missing display name", func(t *testing.T) {
		rc := &model.RemoteCluster{
			SiteURL:   makeSiteURL(),
			CreatorId: model.NewId(),
		}
		_, err := ss.RemoteCluster().Save(rc)
		require.Error(t, err)
	})

	t.Run("Save missing creator id", func(t *testing.T) {
		rc := &model.RemoteCluster{
			Name:    "some_remote_2",
			SiteURL: makeSiteURL(),
		}
		_, err := ss.RemoteCluster().Save(rc)
		require.Error(t, err)
	})

	t.Run("Save pluginID collision", func(t *testing.T) {
		const testPluginID = "com.example.collision"

		rc := &model.RemoteCluster{
			Name:      "some_remote",
			SiteURL:   makeSiteURL(),
			CreatorId: model.NewId(),
			PluginID:  testPluginID,
		}
		_, err := ss.RemoteCluster().Save(rc)
		require.NoError(t, err)

		rc2 := &model.RemoteCluster{
			Name:      "another_remote",
			SiteURL:   makeSiteURL(),
			CreatorId: model.NewId(),
			PluginID:  testPluginID,
		}

		rcSaved, err := ss.RemoteCluster().Save(rc2)
		require.NoError(t, err)
		require.NotNil(t, rcSaved)

		// original remotecluster should be returned
		require.Equal(t, rc.Name, rcSaved.Name)
		require.Equal(t, rc.SiteURL, rcSaved.SiteURL)
		require.Greater(t, rc.CreateAt, int64(0))
		require.Equal(t, rc.PluginID, rcSaved.PluginID)
	})

	t.Run("Save multiple with blank pluginID", func(t *testing.T) {
		rc := &model.RemoteCluster{
			Name:      model.NewId(),
			SiteURL:   makeSiteURL(),
			CreatorId: model.NewId(),
		}
		_, err := ss.RemoteCluster().Save(rc)
		require.NoError(t, err)

		rc2 := &model.RemoteCluster{
			Name:      model.NewId(),
			SiteURL:   makeSiteURL(),
			CreatorId: model.NewId(),
		}
		_, err = ss.RemoteCluster().Save(rc2)
		require.NoError(t, err)
	})

	t.Run("Save for plugin with options", func(t *testing.T) {
		rc := &model.RemoteCluster{
			Name:      "plugin_remote",
			SiteURL:   makeSiteURL(),
			CreatorId: model.NewId(),
			PluginID:  model.NewId(),
			Options:   model.BitflagOptionAutoShareDMs,
		}

		rcSaved, err := ss.RemoteCluster().Save(rc)
		require.NoError(t, err)
		require.Equal(t, rc.PluginID, rcSaved.PluginID)
		require.Equal(t, model.BitflagOptionAutoShareDMs, rcSaved.Options)
		require.True(t, rcSaved.IsOptionFlagSet(model.BitflagOptionAutoShareDMs))

		rc.Name = "plugin_remote_2"
		rc.SiteURL = makeSiteURL()
		rc.PluginID = model.NewId()
		rc.SiteURL = "plugin2.example.com"
		rc.UnsetOptionFlag(model.BitflagOptionAutoShareDMs)

		rcSaved, err = ss.RemoteCluster().Save(rc)
		require.NoError(t, err)
		require.Equal(t, rc.PluginID, rcSaved.PluginID)
		require.Equal(t, model.Bitmask(0), rcSaved.Options)
		require.False(t, rcSaved.IsOptionFlagSet(model.BitflagOptionAutoShareDMs))
	})
}

func testRemoteClusterDelete(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("Delete", func(t *testing.T) {
		rc := &model.RemoteCluster{
			Name:      "shortlived_remote",
			SiteURL:   makeSiteURL(),
			CreatorId: model.NewId(),
		}
		rcSaved, err := ss.RemoteCluster().Save(rc)
		require.NoError(t, err)

		deleted, err := ss.RemoteCluster().Delete(rcSaved.RemoteId)
		require.NoError(t, err)
		require.True(t, deleted)

		deletedRC, err := ss.RemoteCluster().Get(rcSaved.RemoteId, true)
		require.NoError(t, err)
		require.NotZero(t, deletedRC.DeleteAt)
	})

	t.Run("Delete with shared channel remotes", func(t *testing.T) {
		rc := &model.RemoteCluster{
			Name:      "shortlived_remote",
			SiteURL:   makeSiteURL(),
			CreatorId: model.NewId(),
		}
		rcSaved, err := ss.RemoteCluster().Save(rc)
		require.NoError(t, err)

		// we create a shared channel remote for the remote cluster
		channel, err := createTestChannel(ss, rctx, "test_delete")
		require.NoError(t, err)

		sc := &model.SharedChannel{
			ChannelId: channel.Id,
			TeamId:    channel.TeamId,
			CreatorId: model.NewId(),
			ShareName: "testshare",
			RemoteId:  model.NewId(),
		}

		_, err = ss.SharedChannel().Save(sc)
		require.NoError(t, err, "couldn't save shared channel", err)

		scr := &model.SharedChannelRemote{
			ChannelId: channel.Id,
			CreatorId: model.NewId(),
			RemoteId:  rc.RemoteId,
		}
		scrSaved, err := ss.SharedChannel().SaveRemote(scr)
		require.NoError(t, err)

		// and then we delete the cluster, expecting the shared
		// channel remote to be deleted as well
		deleted, err := ss.RemoteCluster().Delete(rcSaved.RemoteId)
		require.NoError(t, err)
		require.True(t, deleted)

		deletedRC, err := ss.RemoteCluster().Get(rcSaved.RemoteId, true)
		require.NoError(t, err)
		require.NotZero(t, deletedRC.DeleteAt)

		deletedSCR, err := ss.SharedChannel().GetRemote(scrSaved.Id)
		require.NoError(t, err)
		require.NotZero(t, deletedSCR.DeleteAt)
	})

	t.Run("Delete nonexistent", func(t *testing.T) {
		deleted, err := ss.RemoteCluster().Delete(model.NewId())
		require.NoError(t, err)
		require.False(t, deleted)
	})
}

func testRemoteClusterGet(t *testing.T, _ request.CTX, ss store.Store) {
	t.Run("Get", func(t *testing.T) {
		rc := &model.RemoteCluster{
			Name:      "shortlived_remote_2",
			SiteURL:   makeSiteURL(),
			CreatorId: model.NewId(),
			PluginID:  model.NewId(),
		}
		rc.SetOptionFlag(model.BitflagOptionAutoShareDMs)
		rcSaved, err := ss.RemoteCluster().Save(rc)
		require.NoError(t, err)

		rcGet, err := ss.RemoteCluster().Get(rcSaved.RemoteId, false)
		require.NoError(t, err)
		require.Equal(t, rcSaved.RemoteId, rcGet.RemoteId)
		require.Equal(t, rcSaved.PluginID, rcGet.PluginID)
		require.True(t, rcGet.IsOptionFlagSet(model.BitflagOptionAutoShareDMs))
	})

	t.Run("Get deleted", func(t *testing.T) {
		rc := &model.RemoteCluster{
			Name:      "shortlived_remote_3",
			SiteURL:   makeSiteURL(),
			CreatorId: model.NewId(),
			PluginID:  model.NewId(),
			DeleteAt:  123,
		}
		rc.SetOptionFlag(model.BitflagOptionAutoShareDMs)
		rcSaved, err := ss.RemoteCluster().Save(rc)
		require.NoError(t, err)

		rcGet, err := ss.RemoteCluster().Get(rcSaved.RemoteId, false)
		require.Error(t, err)
		require.Empty(t, rcGet)

		rcGetDeleted, err := ss.RemoteCluster().Get(rcSaved.RemoteId, true)
		require.NoError(t, err)
		require.Equal(t, rcSaved.RemoteId, rcGetDeleted.RemoteId)
		require.Equal(t, rcSaved.PluginID, rcGetDeleted.PluginID)
		require.True(t, rcGetDeleted.IsOptionFlagSet(model.BitflagOptionAutoShareDMs))
	})

	t.Run("Get not found", func(t *testing.T) {
		_, err := ss.RemoteCluster().Get(model.NewId(), false)
		require.Error(t, err)
	})
}

func testRemoteClusterGetByPluginID(t *testing.T, _ request.CTX, ss store.Store) {
	const pluginID = "com.acme.bogus.plugin"

	t.Run("GetByPluginID", func(t *testing.T) {
		rc := &model.RemoteCluster{
			Name:      "shortlived_remote_4",
			SiteURL:   makeSiteURL(),
			CreatorId: model.NewId(),
			PluginID:  pluginID,
		}
		rcSaved, err := ss.RemoteCluster().Save(rc)
		require.NoError(t, err)

		rcGet, err := ss.RemoteCluster().GetByPluginID(pluginID)
		require.NoError(t, err)
		require.Equal(t, rcSaved.RemoteId, rcGet.RemoteId)
		require.Equal(t, pluginID, rcGet.PluginID)
	})

	t.Run("GetByPluginID not found", func(t *testing.T) {
		_, err := ss.RemoteCluster().GetByPluginID(model.NewId())
		require.Error(t, err)
	})
}

func testRemoteClusterGetAll(t *testing.T, _ request.CTX, ss store.Store) {
	ss.DropAllTables()

	userId := model.NewId()
	now := model.GetMillis()
	pingLongAgo := model.GetMillis() - (model.RemoteOfflineAfterMillis * 3)

	data := []*model.RemoteCluster{
		{Name: "offline_remote", CreatorId: userId, SiteURL: makeSiteURL(), LastPingAt: pingLongAgo, Topics: " shared incident "},
		{Name: "some_online_remote", CreatorId: userId, SiteURL: makeSiteURL(), LastPingAt: now, Topics: " shared incident "},
		{Name: "another_online_remote", CreatorId: model.NewId(), SiteURL: makeSiteURL(), LastPingAt: now, Topics: ""},
		{Name: "another_offline_remote", CreatorId: model.NewId(), SiteURL: makeSiteURL(), LastPingAt: pingLongAgo, Topics: " shared "},
		{Name: "brand_new_offline_remote", CreatorId: userId, SiteURL: "", LastPingAt: 0, Topics: " bogus shared stuff "},
		{Name: "offline_plugin_remote", CreatorId: model.NewId(), SiteURL: makeSiteURL(), PluginID: model.NewId(), LastPingAt: 0, Topics: " pluginshare "},
		{Name: "online_plugin_remote", CreatorId: model.NewId(), SiteURL: makeSiteURL(), PluginID: model.NewId(), LastPingAt: now, Topics: " pluginshare "},
		{Name: "deleted_remote", CreatorId: model.NewId(), SiteURL: "", LastPingAt: 0, DeleteAt: 123},
	}

	idsAll := make([]string, 0)
	idsNotDeleted := make([]string, 0)
	idsOnline := make([]string, 0)
	idsShareTopic := make([]string, 0)
	idsPlugin := make([]string, 0)
	idsNotPlugin := make([]string, 0)
	idsConfirmed := make([]string, 0)

	for _, item := range data {
		online := item.LastPingAt == now
		saved, err := ss.RemoteCluster().Save(item)
		require.NoError(t, err)
		idsAll = append(idsAll, saved.RemoteId)
		if item.DeleteAt == 0 {
			idsNotDeleted = append(idsNotDeleted, saved.RemoteId)

			// only include non-deleted items in other counts
			if online {
				idsOnline = append(idsOnline, saved.RemoteId)
			}
			if strings.Contains(saved.Topics, " shared ") {
				idsShareTopic = append(idsShareTopic, saved.RemoteId)
			}
			if item.PluginID != "" {
				idsPlugin = append(idsPlugin, saved.RemoteId)
			} else {
				idsNotPlugin = append(idsNotPlugin, saved.RemoteId)
			}
			if item.SiteURL != "" {
				idsConfirmed = append(idsConfirmed, saved.RemoteId)
			}
		}
	}

	t.Run("GetAll", func(t *testing.T) {
		filter := model.RemoteClusterQueryFilter{IncludeDeleted: true}
		remotes, err := ss.RemoteCluster().GetAll(0, 999999, filter)
		require.NoError(t, err)
		// make sure all the test data remotes were returned.
		ids := getIds(remotes)
		assert.ElementsMatch(t, ids, idsAll)
	})

	t.Run("GetAllNotDeleted", func(t *testing.T) {
		filter := model.RemoteClusterQueryFilter{}
		remotes, err := ss.RemoteCluster().GetAll(0, 999999, filter)
		require.NoError(t, err)
		// make sure all the test data remotes were returned.
		ids := getIds(remotes)
		assert.ElementsMatch(t, ids, idsNotDeleted)
	})

	t.Run("GetAll online only", func(t *testing.T) {
		filter := model.RemoteClusterQueryFilter{
			ExcludeOffline: true,
		}
		remotes, err := ss.RemoteCluster().GetAll(0, 999999, filter)
		require.NoError(t, err)
		// make sure all the online remotes were returned.
		ids := getIds(remotes)
		assert.ElementsMatch(t, ids, idsOnline)
	})

	t.Run("GetAll by topic", func(t *testing.T) {
		filter := model.RemoteClusterQueryFilter{
			Topic: "shared",
		}
		remotes, err := ss.RemoteCluster().GetAll(0, 999999, filter)
		require.NoError(t, err)
		// make sure only correct topic returned
		ids := getIds(remotes)
		assert.ElementsMatch(t, ids, idsShareTopic)
	})

	t.Run("GetAll online by topic", func(t *testing.T) {
		filter := model.RemoteClusterQueryFilter{
			ExcludeOffline: true,
			Topic:          "shared",
		}
		remotes, err := ss.RemoteCluster().GetAll(0, 999999, filter)
		require.NoError(t, err)
		// make sure only online remotes were returned.
		ids := getIds(remotes)
		assert.Subset(t, idsOnline, ids)
		// make sure correct topic returned
		assert.Subset(t, idsShareTopic, ids)
		assert.Len(t, ids, 1)
	})

	t.Run("GetAll by Creator", func(t *testing.T) {
		filter := model.RemoteClusterQueryFilter{
			CreatorId: userId,
		}
		remotes, err := ss.RemoteCluster().GetAll(0, 999999, filter)
		require.NoError(t, err)
		// make sure only correct creator returned
		assert.Len(t, remotes, 3)
		for _, rc := range remotes {
			assert.Equal(t, userId, rc.CreatorId)
		}
	})

	t.Run("GetAll by Confirmed", func(t *testing.T) {
		filter := model.RemoteClusterQueryFilter{
			OnlyConfirmed: true,
		}
		remotes, err := ss.RemoteCluster().GetAll(0, 999999, filter)
		require.NoError(t, err)
		// make sure only confirmed returned
		for _, rc := range remotes {
			assert.NotEmpty(t, rc.SiteURL)
		}
		// make sure all confirmed returned
		ids := getIds(remotes)
		assert.ElementsMatch(t, ids, idsConfirmed)
	})

	t.Run("GetAll only plugins", func(t *testing.T) {
		filter := model.RemoteClusterQueryFilter{
			OnlyPlugins: true,
		}
		remotes, err := ss.RemoteCluster().GetAll(0, 999999, filter)
		require.NoError(t, err)
		// make sure only plugin remotes returned
		for _, rc := range remotes {
			assert.NotEmpty(t, rc.PluginID)
			assert.True(t, rc.IsPlugin())
		}
		// make sure all the plugin remotes were returned.
		ids := getIds(remotes)
		assert.ElementsMatch(t, ids, idsPlugin)
	})

	t.Run("GetAll excluding plugins", func(t *testing.T) {
		filter := model.RemoteClusterQueryFilter{
			ExcludePlugins: true,
		}
		remotes, err := ss.RemoteCluster().GetAll(0, 999999, filter)
		require.NoError(t, err)
		// make sure only non plugin remotes returned
		for _, rc := range remotes {
			assert.Empty(t, rc.PluginID)
			assert.False(t, rc.IsPlugin())
		}
		// make sure all of the non plugin remotes were returned.
		ids := getIds(remotes)
		assert.ElementsMatch(t, ids, idsNotPlugin)
	})
}

func testRemoteClusterGetAllInChannel(t *testing.T, rctx request.CTX, ss store.Store) {
	const (
		testPluginID_1 = "com.sample.blap"
		testPluginID_2 = "com.sample.bloop"
	)

	ss.DropAllTables()
	now := model.GetMillis()

	userId := model.NewId()

	channel1, err := createTestChannel(ss, rctx, "channel_1")
	require.NoError(t, err)

	channel2, err := createTestChannel(ss, rctx, "channel_2")
	require.NoError(t, err)

	channel3, err := createTestChannel(ss, rctx, "channel_3")
	require.NoError(t, err)

	// Create shared channels
	scData := []*model.SharedChannel{
		{ChannelId: channel1.Id, TeamId: model.NewId(), Home: true, ShareName: "test_chan_1", CreatorId: model.NewId()},
		{ChannelId: channel2.Id, TeamId: model.NewId(), Home: true, ShareName: "test_chan_2", CreatorId: model.NewId()},
		{ChannelId: channel3.Id, TeamId: model.NewId(), Home: true, ShareName: "test_chan_3", CreatorId: model.NewId()},
	}
	for _, item := range scData {
		_, err := ss.SharedChannel().Save(item)
		require.NoError(t, err)
	}

	// Create some remote clusters
	rcData := []*model.RemoteCluster{
		{Name: "AAAA_Inc", CreatorId: userId, SiteURL: "aaaa.com", RemoteId: model.NewId(), LastPingAt: now, PluginID: testPluginID_1},
		{Name: "BBBB_Inc", CreatorId: userId, SiteURL: "bbbb.com", RemoteId: model.NewId(), LastPingAt: 0, PluginID: testPluginID_2},
		{Name: "CCCC_Inc", CreatorId: userId, SiteURL: "cccc.com", RemoteId: model.NewId(), LastPingAt: now},
		{Name: "DDDD_Inc", CreatorId: userId, SiteURL: "dddd.com", RemoteId: model.NewId(), LastPingAt: now},
		{Name: "EEEE_Inc", CreatorId: userId, SiteURL: "eeee.com", RemoteId: model.NewId(), LastPingAt: 0},
	}
	for _, item := range rcData {
		_, err := ss.RemoteCluster().Save(item)
		require.NoError(t, err)
	}

	// Create some shared channel remotes
	scrData := []*model.SharedChannelRemote{
		{ChannelId: channel1.Id, RemoteId: rcData[0].RemoteId, CreatorId: model.NewId()},
		{ChannelId: channel1.Id, RemoteId: rcData[1].RemoteId, CreatorId: model.NewId()},
		{ChannelId: channel2.Id, RemoteId: rcData[2].RemoteId, CreatorId: model.NewId()},
		{ChannelId: channel2.Id, RemoteId: rcData[3].RemoteId, CreatorId: model.NewId()},
		{ChannelId: channel2.Id, RemoteId: rcData[4].RemoteId, CreatorId: model.NewId()},
	}
	for _, item := range scrData {
		_, err := ss.SharedChannel().SaveRemote(item)
		require.NoError(t, err)
	}

	t.Run("Channel 1", func(t *testing.T) {
		filter := model.RemoteClusterQueryFilter{
			InChannel: channel1.Id,
		}
		list, err := ss.RemoteCluster().GetAll(0, 999999, filter)
		require.NoError(t, err)
		require.Len(t, list, 2, "channel 1 should have 2 remote clusters")
		ids := getIds(list)
		require.ElementsMatch(t, []string{rcData[0].RemoteId, rcData[1].RemoteId}, ids)
		require.Equal(t, testPluginID_1, rcData[0].PluginID)
		require.Equal(t, testPluginID_2, rcData[1].PluginID)
	})

	t.Run("Channel 1 online only", func(t *testing.T) {
		filter := model.RemoteClusterQueryFilter{
			ExcludeOffline: true,
			InChannel:      channel1.Id,
		}
		list, err := ss.RemoteCluster().GetAll(0, 999999, filter)
		require.NoError(t, err)
		require.Len(t, list, 1, "channel 1 should have 1 online remote clusters")
		ids := getIds(list)
		require.ElementsMatch(t, []string{rcData[0].RemoteId}, ids)
	})

	t.Run("Channel 2", func(t *testing.T) {
		filter := model.RemoteClusterQueryFilter{
			InChannel: channel2.Id,
		}
		list, err := ss.RemoteCluster().GetAll(0, 999999, filter)
		require.NoError(t, err)
		require.Len(t, list, 3, "channel 2 should have 3 remote clusters")
		ids := getIds(list)
		require.ElementsMatch(t, []string{rcData[2].RemoteId, rcData[3].RemoteId, rcData[4].RemoteId}, ids)
	})

	t.Run("Channel 2 online only", func(t *testing.T) {
		filter := model.RemoteClusterQueryFilter{
			ExcludeOffline: true,
			InChannel:      channel2.Id,
		}
		list, err := ss.RemoteCluster().GetAll(0, 999999, filter)
		require.NoError(t, err)
		require.Len(t, list, 2, "channel 2 should have 2 online remote clusters")
		ids := getIds(list)
		require.ElementsMatch(t, []string{rcData[2].RemoteId, rcData[3].RemoteId}, ids)
	})

	t.Run("Channel 3", func(t *testing.T) {
		filter := model.RemoteClusterQueryFilter{
			InChannel: channel3.Id,
		}
		list, err := ss.RemoteCluster().GetAll(0, 999999, filter)
		require.NoError(t, err)
		require.Empty(t, list, "channel 3 should have 0 remote clusters")
	})
}

func testRemoteClusterGetAllNotInChannel(t *testing.T, rctx request.CTX, ss store.Store) {
	ss.DropAllTables()

	userId := model.NewId()

	channel1, err := createTestChannel(ss, rctx, "channel_1")
	require.NoError(t, err)

	channel2, err := createTestChannel(ss, rctx, "channel_2")
	require.NoError(t, err)

	channel3, err := createTestChannel(ss, rctx, "channel_3")
	require.NoError(t, err)

	// Create shared channels
	scData := []*model.SharedChannel{
		{ChannelId: channel1.Id, TeamId: model.NewId(), Home: true, ShareName: "test_chan_1", CreatorId: model.NewId()},
		{ChannelId: channel2.Id, TeamId: model.NewId(), Home: true, ShareName: "test_chan_2", CreatorId: model.NewId()},
		{ChannelId: channel3.Id, TeamId: model.NewId(), Home: true, ShareName: "test_chan_3", CreatorId: model.NewId()},
	}
	for _, item := range scData {
		_, err := ss.SharedChannel().Save(item)
		require.NoError(t, err)
	}

	// Create some remote clusters
	rcData := []*model.RemoteCluster{
		{Name: "AAAA_Inc", CreatorId: userId, SiteURL: "aaaa.com", RemoteId: model.NewId()},
		{Name: "BBBB_Inc", CreatorId: userId, SiteURL: "bbbb.com", RemoteId: model.NewId()},
		{Name: "CCCC_Inc", CreatorId: userId, SiteURL: "cccc.com", RemoteId: model.NewId()},
		{Name: "DDDD_Inc", CreatorId: userId, SiteURL: "dddd.com", RemoteId: model.NewId()},
		{Name: "EEEE_Inc", CreatorId: userId, SiteURL: "eeee.com", RemoteId: model.NewId()},
	}
	for _, item := range rcData {
		_, err := ss.RemoteCluster().Save(item)
		require.NoError(t, err)
	}

	// Create some shared channel remotes
	scrData := []*model.SharedChannelRemote{
		{ChannelId: channel1.Id, RemoteId: rcData[0].RemoteId, CreatorId: model.NewId()},
		{ChannelId: channel1.Id, RemoteId: rcData[1].RemoteId, CreatorId: model.NewId()},
		{ChannelId: channel2.Id, RemoteId: rcData[2].RemoteId, CreatorId: model.NewId()},
		{ChannelId: channel2.Id, RemoteId: rcData[3].RemoteId, CreatorId: model.NewId()},
		{ChannelId: channel3.Id, RemoteId: rcData[4].RemoteId, CreatorId: model.NewId()},
	}
	for _, item := range scrData {
		_, err := ss.SharedChannel().SaveRemote(item)
		require.NoError(t, err)
	}

	t.Run("Channel 1", func(t *testing.T) {
		filter := model.RemoteClusterQueryFilter{
			NotInChannel: channel1.Id,
		}
		list, err := ss.RemoteCluster().GetAll(0, 999999, filter)
		require.NoError(t, err)
		require.Len(t, list, 3, "channel 1 should have 3 remote clusters that are not already members")
		ids := getIds(list)
		require.ElementsMatch(t, []string{rcData[2].RemoteId, rcData[3].RemoteId, rcData[4].RemoteId}, ids)
	})

	t.Run("Channel 2", func(t *testing.T) {
		filter := model.RemoteClusterQueryFilter{
			NotInChannel: channel2.Id,
		}
		list, err := ss.RemoteCluster().GetAll(0, 999999, filter)
		require.NoError(t, err)
		require.Len(t, list, 3, "channel 2 should have 3 remote clusters that are not already members")
		ids := getIds(list)
		require.ElementsMatch(t, []string{rcData[0].RemoteId, rcData[1].RemoteId, rcData[4].RemoteId}, ids)
	})

	t.Run("Channel 3", func(t *testing.T) {
		filter := model.RemoteClusterQueryFilter{
			NotInChannel: channel3.Id,
		}
		list, err := ss.RemoteCluster().GetAll(0, 999999, filter)
		require.NoError(t, err)
		require.Len(t, list, 4, "channel 3 should have 4 remote clusters that are not already members")
		ids := getIds(list)
		require.ElementsMatch(t, []string{rcData[0].RemoteId, rcData[1].RemoteId, rcData[2].RemoteId, rcData[3].RemoteId}, ids)
	})

	t.Run("Channel with no share remotes", func(t *testing.T) {
		filter := model.RemoteClusterQueryFilter{
			NotInChannel: model.NewId(),
		}
		list, err := ss.RemoteCluster().GetAll(0, 999999, filter)
		require.NoError(t, err)
		require.Len(t, list, 5, "should have 5 remote clusters that are not already members")
		ids := getIds(list)
		require.ElementsMatch(t, []string{rcData[0].RemoteId, rcData[1].RemoteId, rcData[2].RemoteId, rcData[3].RemoteId,
			rcData[4].RemoteId}, ids)
	})
}

func getIds(remotes []*model.RemoteCluster) []string {
	ids := make([]string, 0, len(remotes))
	for _, r := range remotes {
		ids = append(ids, r.RemoteId)
	}
	return ids
}

func testRemoteClusterGetByTopic(t *testing.T, _ request.CTX, ss store.Store) {
	ss.DropAllTables()

	rcData := []*model.RemoteCluster{
		{Name: "AAAA_Inc", CreatorId: model.NewId(), SiteURL: "aaaa.com", RemoteId: model.NewId(), Topics: ""},
		{Name: "BBBB_Inc", CreatorId: model.NewId(), SiteURL: "bbbb.com", RemoteId: model.NewId(), Topics: " share "},
		{Name: "CCCC_Inc", CreatorId: model.NewId(), SiteURL: "cccc.com", RemoteId: model.NewId(), Topics: " incident share "},
		{Name: "DDDD_Inc", CreatorId: model.NewId(), SiteURL: "dddd.com", RemoteId: model.NewId(), Topics: " bogus "},
		{Name: "EEEE_Inc", CreatorId: model.NewId(), SiteURL: "eeee.com", RemoteId: model.NewId(), Topics: " logs share incident "},
		{Name: "FFFF_Inc", CreatorId: model.NewId(), SiteURL: "ffff.com", RemoteId: model.NewId(), Topics: " bogus incident "},
		{Name: "GGGG_Inc", CreatorId: model.NewId(), SiteURL: "gggg.com", RemoteId: model.NewId(), Topics: "*"},
	}
	for _, item := range rcData {
		_, err := ss.RemoteCluster().Save(item)
		require.NoError(t, err)
	}

	testData := []struct {
		topic         string
		expectedCount int
		expectError   bool
	}{
		{topic: "", expectedCount: 7, expectError: false},
		{topic: " ", expectedCount: 0, expectError: true},
		{topic: "share", expectedCount: 4},
		{topic: " share ", expectedCount: 4},
		{topic: "bogus", expectedCount: 3},
		{topic: "non-existent", expectedCount: 1},
		{topic: "*", expectedCount: 0, expectError: true}, // can't query with wildcard
	}

	for _, tt := range testData {
		filter := model.RemoteClusterQueryFilter{
			Topic: tt.topic,
		}
		list, err := ss.RemoteCluster().GetAll(0, 999999, filter)
		if tt.expectError {
			assert.Errorf(t, err, "expected error for topic=%s", tt.topic)
		} else {
			assert.NoErrorf(t, err, "expected no error for topic=%s", tt.topic)
		}
		assert.Lenf(t, list, tt.expectedCount, "topic=%s", tt.topic)
	}
}

func testRemoteClusterUpdateTopics(t *testing.T, _ request.CTX, ss store.Store) {
	remoteId := model.NewId()
	rc := &model.RemoteCluster{
		DisplayName: "Blap Inc",
		Name:        "blap",
		SiteURL:     "blap.com",
		RemoteId:    remoteId,
		Topics:      "",
		CreatorId:   model.NewId(),
	}

	_, err := ss.RemoteCluster().Save(rc)
	require.NoError(t, err)

	testData := []struct {
		topics   string
		expected string
	}{
		{topics: "", expected: ""},
		{topics: " ", expected: ""},
		{topics: "share", expected: " share "},
		{topics: " share ", expected: " share "},
		{topics: "share incident", expected: " share incident "},
		{topics: "  share    incident   ", expected: " share incident "},
	}

	for _, tt := range testData {
		_, err = ss.RemoteCluster().UpdateTopics(remoteId, tt.topics)
		require.NoError(t, err)

		rcUpdated, err := ss.RemoteCluster().Get(remoteId, false)
		require.NoError(t, err)

		require.Equal(t, tt.expected, rcUpdated.Topics)
	}
}
