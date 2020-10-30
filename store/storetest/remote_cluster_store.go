// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"

	"github.com/stretchr/testify/require"
)

func TestRemoteClusterStore(t *testing.T, ss store.Store) {
	t.Run("RemoteClusterSave", func(t *testing.T) { testRemoteClusterSave(t, ss) })
	t.Run("RemoteClusterDelete", func(t *testing.T) { testRemoteClusterDelete(t, ss) })
	t.Run("RemoteClusterGetAll", func(t *testing.T) { testRemoteClusterGetAll(t, ss) })
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

func getIds(remotes []*model.RemoteCluster) []string {
	ids := make([]string, 0, len(remotes))
	for _, r := range remotes {
		ids = append(ids, r.Id)
	}
	return ids
}
