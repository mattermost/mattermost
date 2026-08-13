// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
)

func TestScheduledPostStore(t *testing.T) {
	StoreTestWithSqlStore(t, storetest.TestScheduledPostStore)
}

// TestGetPendingScheduledPostsReadsFromMaster verifies that the scheduled post job reads its
// pending posts from the master database rather than a read replica. The job deletes processed
// posts and then fetches the next page, so reading from a lagging replica could surface
// already-processed posts again. The test points the replica at a separate, empty database so
// that a read from the replica would return nothing, proving the read targets master.
func TestGetPendingScheduledPostsReadsFromMaster(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping test in short mode")
	}

	logger := mlog.CreateTestLogger(t)

	masterSettings, err := makeSqlSettings(model.DatabaseDriverPostgres)
	if err != nil {
		t.Skip(err)
	}
	defer storetest.CleanupSqlSettings(masterSettings)

	// The replica lives in its own database. We migrate it so the ScheduledPosts table exists
	// but leave it empty: the row under test will only ever exist on master.
	replicaSettings, err := makeSqlSettings(model.DatabaseDriverPostgres)
	if err != nil {
		t.Skip(err)
	}
	defer storetest.CleanupSqlSettings(replicaSettings)

	replicaStore, err := New(*replicaSettings, logger, nil)
	require.NoError(t, err)
	replicaStore.Close()

	masterSettings.DataSourceReplicas = []string{*replicaSettings.DataSource}

	store, err := New(*masterSettings, logger, nil)
	require.NoError(t, err)
	defer store.Close()

	// A license is required for replica reads to route to the replica. Without one, GetReplica()
	// falls back to master and the test could pass even if the code read from the replica.
	store.UpdateLicense(&model.License{})
	require.NotSame(t, store.GetMaster(), store.GetReplica(), "replica must be a distinct connection for this test to be meaningful")

	scheduledPost := &model.ScheduledPost{
		Draft: model.Draft{
			CreateAt:  model.GetMillis(),
			UserId:    model.NewId(),
			ChannelId: model.NewId(),
			Message:   "pending scheduled post",
		},
		ScheduledAt: model.GetMillis(),
	}
	createdScheduledPost, err := store.ScheduledPost().CreateScheduledPost(scheduledPost)
	require.NoError(t, err)
	require.NotEmpty(t, createdScheduledPost.Id)

	// Sanity check: the replica database does not contain the scheduled post.
	var replicaCount int
	require.NoError(t, store.GetReplica().Get(&replicaCount, "SELECT COUNT(*) FROM ScheduledPosts"))
	require.Zero(t, replicaCount, "replica should be empty so the test can distinguish master from replica reads")

	beforeTime := createdScheduledPost.ScheduledAt + 1000
	afterTime := createdScheduledPost.ScheduledAt - (24 * 60 * 60 * 1000)
	pending, err := store.ScheduledPost().GetPendingScheduledPosts(beforeTime, afterTime, "", 10)
	require.NoError(t, err)
	require.Len(t, pending, 1, "pending posts must be read from master, not the empty replica")
	require.Equal(t, createdScheduledPost.Id, pending[0].Id)
}
