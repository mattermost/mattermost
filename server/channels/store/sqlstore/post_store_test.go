// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store/searchtest"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
)

func TestPostStore(t *testing.T) {
	StoreTestWithSqlStore(t, storetest.TestPostStore)
}

func TestSearchPostStore(t *testing.T) {
	StoreTestWithSearchTestEngine(t, searchtest.TestSearchPostStore)
}

func TestDetermineMaxPostSize(t *testing.T) {
	logger := mlog.CreateTestLogger(t)

	settings, err := makeSqlSettings(model.DatabaseDriverPostgres)
	if err != nil {
		t.Skip(err)
	}

	store, err := New(*settings, logger, nil)
	require.NoError(t, err)
	t.Cleanup(store.Close)

	setColLength := func(t *testing.T, size int) {
		t.Helper()
		_, alterErr := store.GetMaster().ExecNoTimeout(fmt.Sprintf("ALTER TABLE posts ALTER COLUMN message TYPE VARCHAR(%d)", size))
		require.NoError(t, alterErr)
	}
	t.Cleanup(func() { setColLength(t, model.PostMessageMaxBytesV2) })

	postStore := store.Post().(*SqlPostStore)

	for _, tc := range []struct {
		columnBytes  int
		expectedSize int
	}{
		{model.PostMessageMaxBytesV2, model.PostMessageMaxRunesV2},
		{model.PostMessageMaxBytesV3, model.PostMessageMaxRunesV3},
	} {
		t.Run(fmt.Sprintf("VARCHAR(%d)", tc.columnBytes), func(t *testing.T) {
			setColLength(t, tc.columnBytes)
			assert.Equal(t, tc.expectedSize, postStore.determineMaxPostSize())
		})
	}
}

// TestThreadReplyStatsQueryPlan checks that the reply stats query never gets
// the MIN/MAX rewrite (LIMIT 1 over a backward scan of idx_posts_create_at),
// which walks the whole index when no live reply matches (MM-71476).
//
// The planner only takes the rewrite when it expects an early match, so the
// thread makes up most of the table. The control case proves the MAX-only
// form gets the rewrite under these conditions, so the assertion can fail.
func TestThreadReplyStatsQueryPlan(t *testing.T) {
	logger := mlog.CreateTestLogger(t)

	settings, err := makeSqlSettings(model.DatabaseDriverPostgres)
	if err != nil {
		t.Skip(err)
	}
	t.Cleanup(func() { storetest.CleanupSqlSettings(settings) })

	store, err := New(*settings, logger, nil)
	require.NoError(t, err)
	t.Cleanup(store.Close)

	rctx := request.TestContext(t)

	channel, err := store.Channel().Save(rctx, &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "Reply stats plan",
		Name:        "z-z-" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)

	userID := model.NewId()
	root, err := store.Post().Save(rctx, &model.Post{ChannelId: channel.Id, UserId: userID, Message: "root"})
	require.NoError(t, err)

	replies := make([]*model.Post, 1000)
	for i := range replies {
		replies[i] = &model.Post{ChannelId: channel.Id, UserId: userID, RootId: root.Id, Message: "reply", CreateAt: root.CreateAt + int64(i) + 1}
	}
	_, _, err = store.Post().SaveMultiple(rctx, replies)
	require.NoError(t, err)

	master := store.GetMaster()
	_, err = master.ExecNoTimeout("ANALYZE Posts")
	require.NoError(t, err)

	// enable_seqscan is a session setting, so it and the EXPLAIN must share a
	// connection. A transaction pins one, and the rollback undoes SET LOCAL.
	explain := func(t *testing.T, query string, args ...any) string {
		t.Helper()
		tx, txErr := master.Begin()
		require.NoError(t, txErr)
		defer tx.Rollback() //nolint:errcheck

		_, txErr = tx.Exec("SET LOCAL enable_seqscan = off")
		require.NoError(t, txErr)

		var lines []string
		require.NoError(t, tx.Select(&lines, "EXPLAIN "+query, args...))
		return strings.Join(lines, "\n")
	}

	t.Run("reply stats query is not rewritten into a backward index scan", func(t *testing.T) {
		query, args, err := threadReplyStatsQuery(root.Id).ToSql()
		require.NoError(t, err)

		plan := explain(t, query, args...)
		assert.NotContains(t, plan, "Limit", "plan was:\n%s", plan)
		assert.NotContains(t, plan, "Index Scan Backward", "plan was:\n%s", plan)
	})

	t.Run("control: MAX-only form is rewritten into a backward index scan", func(t *testing.T) {
		plan := explain(t, "SELECT COALESCE(MAX(CreateAt), 0) FROM Posts WHERE RootId = ? AND DeleteAt = 0", root.Id)
		assert.Contains(t, plan, "Limit", "plan was:\n%s", plan)
		assert.Contains(t, plan, "Index Scan Backward using idx_posts_create_at", "plan was:\n%s", plan)
	})
}
