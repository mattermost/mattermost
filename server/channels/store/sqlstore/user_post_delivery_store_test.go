// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
)

func TestUserPostDeliveryStore(t *testing.T) {
	if testing.Short() {
		t.Skip("requires live database")
	}

	logger := mlog.CreateTestLogger(t)

	settings, err := makeSqlSettings(model.DatabaseDriverPostgres)
	if err != nil {
		t.Skip(err)
	}

	dt := model.DeliveryTrackingSettings{
		Enable:     model.NewPointer(true),
		DataSource: model.NewPointer(""), // primary-DB fallback
	}
	dt.SetDefaults()

	// The feature flag must also be on (with Enable) for the real store.
	ss, err := New(*settings, logger, nil, WithDeliveryTrackingSettings(dt),
		WithFeatureFlags(func() *model.FeatureFlags { return &model.FeatureFlags{PostDeliveryTracking: true} }))
	require.NoError(t, err)
	defer func() {
		ss.Close()
		storetest.CleanupSqlSettings(settings)
	}()

	s := ss.UserPostDelivery()
	require.IsType(t, &SqlUserPostDeliveryStore{}, s, "fallback should yield the real store, not the no-op")

	ctx := context.Background()

	sqlStore := s.(*SqlUserPostDeliveryStore)
	rowsByPost := func(t *testing.T, postID string) []model.UserPostDelivery {
		t.Helper()
		var rows []model.UserPostDelivery
		require.NoError(t, sqlStore.userPostDeliveryX.SelectContext(ctx, &rows,
			`SELECT post_id, target_id, target_type, mechanism, created_at
			 FROM `+userPostDeliveryTableName+`
			 WHERE post_id = $1
			 ORDER BY created_at ASC, target_id ASC`, postID))
		return rows
	}

	t.Run("MarkBulk dedups via the unique index", func(t *testing.T) {
		postID := model.NewId()
		u1, u2 := model.NewId(), model.NewId()
		recs := []model.UserPostDelivery{
			{PostID: postID, TargetID: u1, TargetType: model.DeliveryTargetUser, Mechanism: model.DeliveryMechanismProduct},
			{PostID: postID, TargetID: u1, TargetType: model.DeliveryTargetUser, Mechanism: model.DeliveryMechanismProduct}, // in-batch dup
			{PostID: postID, TargetID: u2, TargetType: model.DeliveryTargetUser, Mechanism: model.DeliveryMechanismProduct},
		}
		require.NoError(t, s.MarkBulk(ctx, recs))
		// A second flush of the same rows must be a no-op (ON CONFLICT DO NOTHING).
		require.NoError(t, s.MarkBulk(ctx, recs))

		got := rowsByPost(t, postID)
		require.Len(t, got, 2)
		for _, r := range got {
			require.Equal(t, postID, r.PostID)
			require.Equal(t, model.DeliveryTargetUser, r.TargetType)
			require.Positive(t, r.CreatedAt, "created_at should be stamped server-side")
		}
	})

	t.Run("same target/post but different mechanism is a distinct row", func(t *testing.T) {
		postID := model.NewId()
		target := model.NewId()
		require.NoError(t, s.MarkBulk(ctx, []model.UserPostDelivery{
			{PostID: postID, TargetID: target, TargetType: model.DeliveryTargetUser, Mechanism: model.DeliveryMechanismProduct},
			{PostID: postID, TargetID: target, TargetType: model.DeliveryTargetUser, Mechanism: model.DeliveryMechanismEmail},
		}))
		require.Len(t, rowsByPost(t, postID), 2)
	})

	t.Run("long plugin target_id round-trips (needs varchar(190))", func(t *testing.T) {
		postID := model.NewId()
		pluginID := "com.mattermost.plugin-incident-collaboration" // 44 chars, > the old VARCHAR(26)
		require.NoError(t, s.MarkBulk(ctx, []model.UserPostDelivery{
			{PostID: postID, TargetID: pluginID, TargetType: model.DeliveryTargetPlugin, Mechanism: model.DeliveryMechanismPlugin},
		}))
		got := rowsByPost(t, postID)
		require.Len(t, got, 1)
		require.Equal(t, pluginID, got[0].TargetID)
		require.Equal(t, model.DeliveryTargetPlugin, got[0].TargetType)
	})

	t.Run("DeleteByPost removes all rows for the post", func(t *testing.T) {
		postID := model.NewId()
		require.NoError(t, s.MarkBulk(ctx, []model.UserPostDelivery{
			{PostID: postID, TargetID: model.NewId(), TargetType: model.DeliveryTargetUser, Mechanism: model.DeliveryMechanismEmail},
		}))
		require.NoError(t, s.DeleteByPost(ctx, postID))
		require.Empty(t, rowsByPost(t, postID))
	})

	t.Run("MarkBulk with no records is a no-op", func(t *testing.T) {
		require.NoError(t, s.MarkBulk(ctx, nil))
	})

	t.Run("PermanentDeleteBatch deletes only rows older than the cutoff, in batches", func(t *testing.T) {
		postID := model.NewId()
		rctx := request.EmptyContext(logger)

		// Old rows use a tiny created_at so the cutoff targets exactly them, without
		// touching rows inserted by other subtests (whose created_at is ~now).
		const oldCreatedAt = int64(1000)
		keepCreatedAt := model.GetMillis() + 1000000

		insert := func(targetID string, createdAt int64) {
			_, execErr := sqlStore.userPostDeliveryX.ExecContext(ctx,
				`INSERT INTO `+userPostDeliveryTableName+` (post_id, target_id, target_type, mechanism, created_at)
				 VALUES ($1, $2, $3, $4, $5)`,
				postID, targetID, model.DeliveryTargetUser, model.DeliveryMechanismProduct, createdAt)
			require.NoError(t, execErr)
		}

		// 3 rows old enough to delete, 2 rows to keep.
		insert(model.NewId(), oldCreatedAt)
		insert(model.NewId(), oldCreatedAt)
		insert(model.NewId(), oldCreatedAt)
		insert(model.NewId(), keepCreatedAt)
		insert(model.NewId(), keepCreatedAt)

		// Cutoff sits between the old and kept rows; batch size 2 forces >1 batch.
		cutoff := oldCreatedAt + 1
		var total int64
		for range 10 {
			n, delErr := s.PermanentDeleteBatch(rctx, cutoff, 2)
			require.NoError(t, delErr)
			total += n
			if n == 0 {
				break
			}
		}

		require.Equal(t, int64(3), total, "should delete exactly the rows older than the cutoff")
		require.Len(t, rowsByPost(t, postID), 2, "rows at/after the cutoff must remain")
	})
}
