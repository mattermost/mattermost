// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// newAttributeRefreshTestStores opens n stores on the same test database, as n nodes of a cluster
// would, and clears the views' last-refresh rows before and after the test.
func newAttributeRefreshTestStores(t *testing.T, n int) []*SqlStore {
	t.Helper()
	logger := mlog.CreateTestLogger(t)

	settings, err := makeSqlSettings(model.DatabaseDriverPostgres)
	if err != nil {
		t.Skip(err)
	}

	stores := make([]*SqlStore, n)
	for i := range stores {
		stores[i], err = New(*settings, logger, nil)
		require.NoError(t, err)
		s := stores[i]
		t.Cleanup(s.Close)
	}

	clearRows := func() {
		_, cErr := stores[0].GetMaster().Exec("DELETE FROM Systems WHERE Name LIKE $1", attributeViewLastRefreshKeyPrefix+"%")
		require.NoError(t, cErr)
	}
	clearRows()
	t.Cleanup(clearRows)

	return stores
}

func readLastRefresh(t *testing.T, s *SqlStore, objectType string) attributeViewLastRefresh {
	t.Helper()
	var raw string
	require.NoError(t, s.GetMaster().Get(&raw, "SELECT Value FROM Systems WHERE Name = $1", attributeViewLastRefreshKeyPrefix+objectType))
	var last attributeViewLastRefresh
	require.NoError(t, json.Unmarshal([]byte(raw), &last))
	return last
}

func writeLastRefresh(t *testing.T, s *SqlStore, objectType string, last attributeViewLastRefresh) {
	t.Helper()
	raw, err := json.Marshal(last)
	require.NoError(t, err)
	_, err = s.GetMaster().Exec(`INSERT INTO Systems (Name, Value) VALUES ($1, $2)
		ON CONFLICT (Name) DO UPDATE SET Value = EXCLUDED.Value`, attributeViewLastRefreshKeyPrefix+objectType, string(raw))
	require.NoError(t, err)
}

// TestRefreshAttributesIfStaleCoordinatesNodes runs two stores on one database, as two nodes that
// both believe they should refresh the user view. A third session locks PropertyValues, which the
// view is computed from, so the first refresh stalls while holding the view's advisory lock.
func TestRefreshAttributesIfStaleCoordinatesNodes(t *testing.T) {
	stores := newAttributeRefreshTestStores(t, 3)
	nodeA, nodeB, blocker := stores[0].Attributes(), stores[1].Attributes(), stores[2]
	rctx := request.TestContext(t)
	user := model.PropertyFieldObjectTypeUser

	// Both nodes' writes committed before this token.
	token, err := nodeB.GetAttributeRefreshToken(rctx)
	require.NoError(t, err)

	block, err := blocker.GetMaster().Begin()
	require.NoError(t, err)
	defer block.Rollback() //nolint:errcheck
	_, err = block.Exec("LOCK TABLE PropertyValues IN ACCESS EXCLUSIVE MODE")
	require.NoError(t, err)

	type outcome struct {
		result store.AttributeViewRefreshResult
		err    error
	}
	doneA := make(chan outcome, 1)
	go func() {
		result, rErr := nodeA.RefreshAttributesIfStale(rctx, user, token, 0)
		doneA <- outcome{result, rErr}
	}()

	// Wait until node A holds the view's lock and is stuck in its REFRESH.
	require.Eventually(t, func() bool {
		var held bool
		gErr := blocker.GetMaster().Get(&held, `SELECT EXISTS (SELECT 1 FROM pg_locks
			WHERE locktype = 'advisory' AND classid = $1 AND objid = $2 AND objsubid = 2 AND granted)`,
			attributeViewRefreshLockNamespace, attributeViewRefreshLockKeys[user])
		return gErr == nil && held
	}, 10*time.Second, 10*time.Millisecond, "node A should take the refresh lock")

	result, err := nodeB.RefreshAttributesIfStale(rctx, user, token, 0)
	require.NoError(t, err)
	require.Equal(t, store.AttributeViewRefreshBusy, result.Outcome, "node B finds the refresh running on node A")

	require.NoError(t, block.Rollback())
	select {
	case a := <-doneA:
		require.NoError(t, a.err)
		require.Equal(t, store.AttributeViewRefreshRefreshed, a.result.Outcome, "node A refreshes")
	case <-time.After(30 * time.Second):
		require.FailNow(t, "node A's refresh didn't finish once PropertyValues was unlocked")
	}

	result, err = nodeB.RefreshAttributesIfStale(rctx, user, token, 0)
	require.NoError(t, err)
	require.Equal(t, store.AttributeViewRefreshCovered, result.Outcome, "node A's refresh started after node B's token, so it covers node B's writes")
}

func TestRefreshAttributesIfStale(t *testing.T) {
	stores := newAttributeRefreshTestStores(t, 1)
	s := stores[0]
	attributes := s.Attributes()
	rctx := request.TestContext(t)
	user, channel := model.PropertyFieldObjectTypeUser, model.PropertyFieldObjectTypeChannel

	t.Run("records the start and duration of a refresh", func(t *testing.T) {
		before, err := attributes.GetAttributeRefreshToken(rctx)
		require.NoError(t, err)

		result, err := attributes.RefreshAttributesIfStale(rctx, user, before, 0)
		require.NoError(t, err)
		require.Equal(t, store.AttributeViewRefreshRefreshed, result.Outcome)

		after, err := attributes.GetAttributeRefreshToken(rctx)
		require.NoError(t, err)

		last := readLastRefresh(t, s, user)
		start := time.UnixMicro(last.StartMicros)
		require.False(t, start.Before(before), "the start is in the database's time, after the token taken before")
		require.False(t, start.After(after))
		require.GreaterOrEqual(t, last.DurationMillis, int64(0))
		require.Equal(t, result.Duration.Milliseconds(), last.DurationMillis)
	})

	t.Run("a refresh that started before a token doesn't cover it", func(t *testing.T) {
		token, err := attributes.GetAttributeRefreshToken(rctx)
		require.NoError(t, err)
		_, err = attributes.RefreshAttributesIfStale(rctx, user, token, 0)
		require.NoError(t, err)
		start := time.UnixMicro(readLastRefresh(t, s, user).StartMicros)

		result, err := attributes.RefreshAttributesIfStale(rctx, user, start, time.Hour)
		require.NoError(t, err)
		require.Equal(t, store.AttributeViewRefreshCovered, result.Outcome, "a refresh that started at the token covers it")

		// A token a microsecond after the start, well under a millisecond: the refresh may have
		// started before a write that committed just before the token.
		result, err = attributes.RefreshAttributesIfStale(rctx, user, start.Add(time.Microsecond), 0)
		require.NoError(t, err)
		require.Equal(t, store.AttributeViewRefreshRefreshed, result.Outcome)
	})

	t.Run("gap honours the minimum gap and minGap 0 ignores it", func(t *testing.T) {
		token, err := attributes.GetAttributeRefreshToken(rctx)
		require.NoError(t, err)
		_, err = attributes.RefreshAttributesIfStale(rctx, user, token, 0)
		require.NoError(t, err)

		later, err := attributes.GetAttributeRefreshToken(rctx)
		require.NoError(t, err)

		result, err := attributes.RefreshAttributesIfStale(rctx, user, later, time.Hour)
		require.NoError(t, err)
		require.Equal(t, store.AttributeViewRefreshGap, result.Outcome)
		require.Greater(t, result.RetryAfter, time.Duration(0))
		require.LessOrEqual(t, result.RetryAfter, time.Hour)

		result, err = attributes.RefreshAttributesIfStale(rctx, user, later, 0)
		require.NoError(t, err)
		require.Equal(t, store.AttributeViewRefreshRefreshed, result.Outcome)
	})

	t.Run("the gap stretches to the last refresh's duration", func(t *testing.T) {
		now, err := attributes.GetAttributeRefreshToken(rctx)
		require.NoError(t, err)
		// A refresh that started a second ago and took an hour.
		writeLastRefresh(t, s, user, attributeViewLastRefresh{
			StartMicros:    now.Add(-time.Second).UnixMicro(),
			DurationMillis: time.Hour.Milliseconds(),
		})

		result, err := attributes.RefreshAttributesIfStale(rctx, user, now, time.Millisecond)
		require.NoError(t, err)
		require.Equal(t, store.AttributeViewRefreshGap, result.Outcome)
		require.Greater(t, result.RetryAfter, 50*time.Minute)
	})

	t.Run("views are tracked separately", func(t *testing.T) {
		token, err := attributes.GetAttributeRefreshToken(rctx)
		require.NoError(t, err)
		_, err = attributes.RefreshAttributesIfStale(rctx, user, token, 0)
		require.NoError(t, err)

		result, err := attributes.RefreshAttributesIfStale(rctx, channel, token, time.Hour)
		require.NoError(t, err)
		require.Equal(t, store.AttributeViewRefreshRefreshed, result.Outcome, "a user refresh neither covers nor delays the channel view")
		readLastRefresh(t, s, channel)
	})

	t.Run("an unknown object type is an error", func(t *testing.T) {
		_, err := attributes.RefreshAttributesIfStale(rctx, model.PropertyFieldObjectTypePost, time.Now(), 0)
		require.Error(t, err)
	})
}
