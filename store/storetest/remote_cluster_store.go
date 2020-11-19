// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRemoteClusterStore(t *testing.T, ss store.Store) {
	t.Run("RemoteClusterGetAllNotInChannel", func(t *testing.T) { testRemoteClusterGetAllNotInChannel(t, ss) })
	t.Run("RemoteClusterSave", func(t *testing.T) { testRemoteClusterSave(t, ss) })
	t.Run("RemoteClusterDelete", func(t *testing.T) { testRemoteClusterDelete(t, ss) })
	t.Run("RemoteClusterGet", func(t *testing.T) { testRemoteClusterGet(t, ss) })
	t.Run("RemoteClusterGetAll", func(t *testing.T) { testRemoteClusterGetAll(t, ss) })
	t.Run("RemoteClusterGetByTopic", func(t *testing.T) { testRemoteClusterGetByTopic(t, ss) })
	t.Run("RemoteClusterUpdateTopics", func(t *testing.T) { testRemoteClusterUpdateTopics(t, ss) })
}

func testRemoteClusterSave(t *testing.T, ss store.Store) {

	t.Run("Save", func(t *testing.T) {
		rc := &model.RemoteCluster{
			ClusterName: "some remote",
			Hostname:    "somewhere.com",
		}

		rcSaved, err := ss.RemoteCluster().Save(rc)
		require.Nil(t, err)
		require.Equal(t, rc.ClusterName, rcSaved.ClusterName)
		require.Equal(t, rc.Hostname, rcSaved.Hostname)
		require.Greater(t, rc.CreateAt, int64(0))
		require.Greater(t, rc.LastPingAt, int64(0))
	})

	t.Run("Save missing cluster name", func(t *testing.T) {
		rc := &model.RemoteCluster{
			Hostname: "somewhere.com",
		}
		_, err := ss.RemoteCluster().Save(rc)
		require.NotNil(t, err)
	})

	t.Run("Save missing host name", func(t *testing.T) {
		rc := &model.RemoteCluster{
			ClusterName: "some remote",
		}
		_, err := ss.RemoteCluster().Save(rc)
		require.NotNil(t, err)
	})
}

func testRemoteClusterDelete(t *testing.T, ss store.Store) {
	t.Run("Delete", func(t *testing.T) {
		rc := &model.RemoteCluster{
			ClusterName: "shortlived remote",
			Hostname:    "nowhere.com",
		}
		rcSaved, err := ss.RemoteCluster().Save(rc)
		require.Nil(t, err)

		deleted, err := ss.RemoteCluster().Delete(rcSaved.Id)
		require.Nil(t, err)
		require.True(t, deleted)
	})

	t.Run("Delete nonexistent", func(t *testing.T) {
		deleted, err := ss.RemoteCluster().Delete(model.NewId())
		require.Nil(t, err)
		require.False(t, deleted)
	})
}

func testRemoteClusterGet(t *testing.T, ss store.Store) {
	t.Run("Get", func(t *testing.T) {
		rc := &model.RemoteCluster{
			ClusterName: "shortlived remote",
			Hostname:    "nowhere.com",
		}
		rcSaved, err := ss.RemoteCluster().Save(rc)
		require.Nil(t, err)

		rcGet, err := ss.RemoteCluster().Get(rcSaved.Id)
		require.Nil(t, err)
		require.Equal(t, rcSaved.Id, rcGet.Id)
	})

	t.Run("Get not found", func(t *testing.T) {
		_, err := ss.RemoteCluster().Get(model.NewId())
		require.NotNil(t, err)
	})
}

func testRemoteClusterGetAll(t *testing.T, ss store.Store) {
	data := []*model.RemoteCluster{
		{ClusterName: "offline remote", Hostname: "somewhere.com", LastPingAt: model.GetMillis() - (model.RemoteOfflineAfterMillis * 2)},
		{ClusterName: "some remote", Hostname: "nowhere.com", LastPingAt: 0},
		{ClusterName: "another remote", Hostname: "underwhere.com", LastPingAt: 0},
		{ClusterName: "another offline remote", Hostname: "knowhere.com", LastPingAt: model.GetMillis() - (model.RemoteOfflineAfterMillis * 3)},
	}

	idsAll := make([]string, 0)
	idsOnline := make([]string, 0)
	idsOffline := make([]string, 0)

	for _, item := range data {
		online := item.LastPingAt == 0
		saved, err := ss.RemoteCluster().Save(item)
		require.Nil(t, err)
		idsAll = append(idsAll, saved.Id)
		if online {
			idsOnline = append(idsOnline, saved.Id)
		} else {
			idsOffline = append(idsOffline, saved.Id)
		}
	}

	t.Run("GetAll", func(t *testing.T) {
		remotes, err := ss.RemoteCluster().GetAll(true)
		require.Nil(t, err)
		// make sure all the test data remotes were returned.
		ids := getIds(remotes)
		require.Subset(t, ids, idsAll)
	})

	t.Run("GetAll online only", func(t *testing.T) {
		remotes, err := ss.RemoteCluster().GetAll(false)
		require.Nil(t, err)
		// make sure all the online remotes were returned.
		ids := getIds(remotes)
		require.Subset(t, ids, idsOnline)
		// make sure no offline remotes were returned.
		require.NotSubset(t, ids, idsOffline)
	})
}

func testRemoteClusterGetAllNotInChannel(t *testing.T, ss store.Store) {
	channel1, err := createTestChannel(ss, "channel_1")
	require.Nil(t, err)

	channel2, err := createTestChannel(ss, "channel_2")
	require.Nil(t, err)

	channel3, err := createTestChannel(ss, "channel_3")
	require.Nil(t, err)

	// Create shared channels
	scData := []*model.SharedChannel{
		{ChannelId: channel1.Id, TeamId: model.NewId(), Home: true, ShareName: "test_chan_1", CreatorId: model.NewId()},
		{ChannelId: channel2.Id, TeamId: model.NewId(), Home: true, ShareName: "test_chan_2", CreatorId: model.NewId()},
		{ChannelId: channel3.Id, TeamId: model.NewId(), Home: true, ShareName: "test_chan_3", CreatorId: model.NewId()},
	}
	for _, item := range scData {
		_, err := ss.Channel().SaveSharedChannel(item)
		require.Nil(t, err)
	}

	// Create some remote clusters
	rcData := []*model.RemoteCluster{
		{ClusterName: "AAAA Inc", Hostname: "aaaa.com", Id: model.NewId()},
		{ClusterName: "BBBB Inc", Hostname: "bbbb.com", Id: model.NewId()},
		{ClusterName: "CCCC Inc", Hostname: "cccc.com", Id: model.NewId()},
		{ClusterName: "DDDD Inc", Hostname: "dddd.com", Id: model.NewId()},
		{ClusterName: "EEEE Inc", Hostname: "eeee.com", Id: model.NewId()},
	}
	for _, item := range rcData {
		_, err := ss.RemoteCluster().Save(item)
		require.Nil(t, err)
	}

	// Create some shared channel remotes
	scrData := []*model.SharedChannelRemote{
		{ChannelId: channel1.Id, Description: "AAA Inc Share", Token: model.NewId(), RemoteClusterId: rcData[0].Id, CreatorId: model.NewId()},
		{ChannelId: channel1.Id, Description: "BBB Inc Share", Token: model.NewId(), RemoteClusterId: rcData[1].Id, CreatorId: model.NewId()},
		{ChannelId: channel2.Id, Description: "CCC Inc Share", Token: model.NewId(), RemoteClusterId: rcData[2].Id, CreatorId: model.NewId()},
		{ChannelId: channel2.Id, Description: "DDD Inc Share", Token: model.NewId(), RemoteClusterId: rcData[3].Id, CreatorId: model.NewId()},
		{ChannelId: channel3.Id, Description: "EEE Inc Share", Token: model.NewId(), RemoteClusterId: rcData[4].Id, CreatorId: model.NewId()},
	}
	for _, item := range scrData {
		_, err := ss.Channel().SaveSharedChannelRemote(item)
		require.Nil(t, err)
	}

	t.Run("Channel 1", func(t *testing.T) {
		list, err := ss.RemoteCluster().GetAllNotInChannel(channel1.Id, true)
		require.Nil(t, err)
		require.Len(t, list, 3, "channel 1 should have 3 remote clusters that are not already members")
		require.Subset(t, []string{rcData[2].ClusterName, rcData[3].ClusterName, rcData[4].ClusterName},
			[]string{list[0].ClusterName, list[1].ClusterName, list[2].ClusterName})
	})

	t.Run("Channel 2", func(t *testing.T) {
		list, err := ss.RemoteCluster().GetAllNotInChannel(channel2.Id, true)
		require.Nil(t, err)
		require.Len(t, list, 3, "channel 2 should have 3 remote clusters that are not already members")
		require.Subset(t, []string{rcData[0].ClusterName, rcData[1].ClusterName, rcData[4].ClusterName},
			[]string{list[0].ClusterName, list[1].ClusterName, list[2].ClusterName})
	})

	t.Run("Channel 3", func(t *testing.T) {
		list, err := ss.RemoteCluster().GetAllNotInChannel(channel3.Id, true)
		require.Nil(t, err)
		require.Len(t, list, 4, "channel 3 should have 4 remote clusters that are not already members")
		require.Subset(t, []string{rcData[0].ClusterName, rcData[1].ClusterName, rcData[2].ClusterName, rcData[3].ClusterName},
			[]string{list[0].ClusterName, list[1].ClusterName, list[2].ClusterName, list[3].ClusterName})
	})

	t.Run("Channel with no share remotes", func(t *testing.T) {
		list, err := ss.RemoteCluster().GetAllNotInChannel(model.NewId(), true)
		require.Nil(t, err)
		require.Len(t, list, 5, "should have 5 remote clusters that are not already members")
		require.Subset(t, []string{rcData[0].ClusterName, rcData[1].ClusterName, rcData[2].ClusterName, rcData[3].ClusterName, rcData[4].ClusterName},
			[]string{list[0].ClusterName, list[1].ClusterName, list[2].ClusterName, list[3].ClusterName})
	})

}

func getIds(remotes []*model.RemoteCluster) []string {
	ids := make([]string, 0, len(remotes))
	for _, r := range remotes {
		ids = append(ids, r.Id)
	}
	return ids
}

func testRemoteClusterGetByTopic(t *testing.T, ss store.Store) {
	rcData := []*model.RemoteCluster{
		{ClusterName: "AAAA Inc", Hostname: "aaaa.com", Id: model.NewId(), Topics: ""},
		{ClusterName: "BBBB Inc", Hostname: "bbbb.com", Id: model.NewId(), Topics: " share "},
		{ClusterName: "CCCC Inc", Hostname: "cccc.com", Id: model.NewId(), Topics: " incident share "},
		{ClusterName: "DDDD Inc", Hostname: "dddd.com", Id: model.NewId(), Topics: " bogus "},
		{ClusterName: "EEEE Inc", Hostname: "eeee.com", Id: model.NewId(), Topics: " logs share incident "},
		{ClusterName: "FFFF Inc", Hostname: "ffff.com", Id: model.NewId(), Topics: " bogus incident "},
		{ClusterName: "GGGG Inc", Hostname: "gggg.com", Id: model.NewId(), Topics: "*"},
	}
	for _, item := range rcData {
		_, err := ss.RemoteCluster().Save(item)
		require.Nil(t, err)
	}

	testData := []struct {
		topic         string
		expectedCount int
		expectError   bool
	}{
		{topic: "", expectedCount: 0, expectError: true},
		{topic: " ", expectedCount: 0, expectError: true},
		{topic: "share", expectedCount: 4},
		{topic: " share ", expectedCount: 4},
		{topic: "bogus", expectedCount: 3},
		{topic: "non-existent", expectedCount: 1},
		{topic: "*", expectedCount: 0, expectError: true}, // can't query with wildcard
	}

	for _, tt := range testData {
		list, err := ss.RemoteCluster().GetByTopic(tt.topic)
		if tt.expectError {
			assert.Error(t, err)
		} else {
			assert.NoError(t, err)
		}
		assert.Lenf(t, list, tt.expectedCount, "topic="+tt.topic)
	}
}

func testRemoteClusterUpdateTopics(t *testing.T, ss store.Store) {
	remoteId := model.NewId()
	rc := &model.RemoteCluster{
		ClusterName: "Blap Inc",
		Hostname:    "blap.com",
		Id:          remoteId,
		Topics:      "",
	}

	_, err := ss.RemoteCluster().Save(rc)
	require.Nil(t, err)

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

		rcUpdated, err := ss.RemoteCluster().Get(remoteId)
		require.NoError(t, err)

		require.Equal(t, tt.expected, rcUpdated.Topics)
	}
}
