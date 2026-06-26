// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
)

// TestUserPostDeliveryStore exercises the real SQL store end to end. It builds a
// dedicated store with delivery tracking enabled in primary-DB fallback mode
// (empty DataSource), which both proves the fallback path migrates the
// UserPostDelivery table onto the primary pool and gives us a real (non-no-op)
// store to test against.
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
}
