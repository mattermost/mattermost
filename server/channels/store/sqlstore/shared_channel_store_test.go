// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
)

func TestSharedChannelStore(t *testing.T) {
	StoreTestWithSqlStore(t, storetest.TestSharedChannelStore)
}

// TestGetRemoteByIdsFromMasterIgnoresLaggingReplica points the replica at a separate database
// seeded with the same rows, then changes only master to simulate replica lag.
func TestGetRemoteByIdsFromMasterIgnoresLaggingReplica(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping test in short mode")
	}

	logger := mlog.CreateTestLogger(t)
	rctx := request.EmptyContext(logger)

	masterSettings, err := makeSqlSettings(model.DatabaseDriverPostgres)
	if err != nil {
		t.Skip(err)
	}
	defer storetest.CleanupSqlSettings(masterSettings)

	replicaSettings, err := makeSqlSettings(model.DatabaseDriverPostgres)
	if err != nil {
		t.Skip(err)
	}
	defer storetest.CleanupSqlSettings(replicaSettings)

	replicaStore, err := New(*replicaSettings, logger, nil)
	require.NoError(t, err)
	defer replicaStore.Close()

	masterSettings.DataSourceReplicas = []string{*replicaSettings.DataSource}

	ss, err := New(*masterSettings, logger, nil)
	require.NoError(t, err)
	defer ss.Close()

	// Without a license, GetReplica() falls back to master and the test could not tell the reads apart.
	ss.UpdateLicense(&model.License{})
	require.NotSame(t, ss.GetMaster(), ss.GetReplica(), "replica must be a distinct connection for this test to be meaningful")

	saveOnBoth := func(t *testing.T) (*model.Channel, *model.SharedChannelRemote) {
		t.Helper()
		channel := &model.Channel{
			Id:          model.NewId(),
			TeamId:      model.NewId(),
			DisplayName: "Shared",
			Name:        "shared-" + model.NewId(),
			Type:        model.ChannelTypeOpen,
			Shared:      model.NewPointer(true),
		}
		remote := &model.SharedChannelRemote{
			Id:        model.NewId(),
			ChannelId: channel.Id,
			CreatorId: model.NewId(),
			RemoteId:  model.NewId(),
		}

		// The replica is seeded first because SaveRemote on master checks the channel through the replica.
		replicaChannel, replicaRemote := *channel, *remote
		_, err := replicaStore.Channel().Save(rctx, &replicaChannel, -1)
		require.NoError(t, err)
		_, err = replicaStore.SharedChannel().SaveRemote(&replicaRemote)
		require.NoError(t, err)

		_, err = ss.Channel().Save(rctx, channel, -1)
		require.NoError(t, err)
		_, err = ss.SharedChannel().SaveRemote(remote)
		require.NoError(t, err)
		return channel, remote
	}

	t.Run("returns the cursor written to master", func(t *testing.T) {
		_, remote := saveOnBoth(t)
		cursor := model.GetPostsSinceForSyncCursor{
			LastPostUpdateAt: 1000,
			LastPostUpdateID: model.NewId(),
			LastPostCreateAt: 2000,
			LastPostCreateID: model.NewId(),
		}
		require.NoError(t, ss.SharedChannel().UpdateRemoteCursor(remote.Id, cursor))

		stale, err := ss.SharedChannel().GetRemoteByIds(remote.ChannelId, remote.RemoteId)
		require.NoError(t, err)
		require.Zero(t, stale.LastPostUpdateAt, "replica should still hold the old cursor")

		got, err := ss.SharedChannel().GetRemoteByIdsFromMaster(remote.ChannelId, remote.RemoteId)
		require.NoError(t, err)
		require.Equal(t, cursor.LastPostUpdateAt, got.LastPostUpdateAt)
		require.Equal(t, cursor.LastPostUpdateID, got.LastPostUpdateID)
		require.Equal(t, cursor.LastPostCreateAt, got.LastPostCreateAt)
		require.Equal(t, cursor.LastPostCreateID, got.LastPostCreateID)
	})

	t.Run("rejects a channel permanently deleted on master only", func(t *testing.T) {
		channel, remote := saveOnBoth(t)
		require.NoError(t, ss.Channel().PermanentDelete(rctx, channel.Id))

		_, err := ss.Channel().Get(channel.Id, false)
		require.NoError(t, err, "replica should still hold the channel")

		r, err := ss.SharedChannel().GetRemoteByIdsFromMaster(remote.ChannelId, remote.RemoteId)
		var nfErr *store.ErrNotFound
		require.ErrorAs(t, err, &nfErr)
		require.Nil(t, r)
	})
}
