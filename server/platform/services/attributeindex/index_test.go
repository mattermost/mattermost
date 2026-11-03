// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package attributeindex

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTestIndex(t *testing.T) *Index {
	t.Helper()
	ix, err := New(context.Background(), Options{MaxReaders: 4})
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, ix.Close()) })
	return ix
}

func TestCloseRemovesDatabaseFile(t *testing.T) {
	parent := t.TempDir()
	ix, err := New(context.Background(), Options{Dir: parent, MaxReaders: 1})
	require.NoError(t, err)

	info, err := os.Stat(ix.dir)
	require.NoError(t, err)
	assert.Equal(t, os.FileMode(0o700), info.Mode().Perm(), "session attributes must be readable only by this user")

	require.NoError(t, ix.Close())
	entries, err := os.ReadDir(parent)
	require.NoError(t, err)
	assert.Empty(t, entries)
}

func TestNewRejectsNoReaders(t *testing.T) {
	_, err := New(context.Background(), Options{Dir: t.TempDir()})
	require.Error(t, err)
}

func storedSession(t *testing.T, ix *Index, sessionID string) (userID string, expiresAt int64, attrs map[string]any, times map[string]int64) {
	t.Helper()
	var rawAttrs, rawTimes string
	require.NoError(t, ix.readDB.QueryRow(
		`SELECT user_id, expires_at, json(attributes_json), json(attribute_times_json) FROM sessions WHERE session_id = ?`, sessionID,
	).Scan(&userID, &expiresAt, &rawAttrs, &rawTimes))
	require.NoError(t, json.Unmarshal([]byte(rawAttrs), &attrs))
	require.NoError(t, json.Unmarshal([]byte(rawTimes), &times))
	return userID, expiresAt, attrs, times
}

func TestApplySessionUpdatesMergesPerKey(t *testing.T) {
	ctx := context.Background()
	ix := newTestIndex(t)

	require.NoError(t, ix.ApplySessionUpdates(ctx, []SessionUpdate{
		{SessionID: "s1", UserID: "u1", ExpiresAt: 500, Attrs: map[string]any{"os_platform": "Windows", "ip_address": "10.0.0.1"}, UpdatedAt: 200},
		// Arrives late from a peer: older than what the index already holds for ip_address.
		{SessionID: "s1", UserID: "u1", ExpiresAt: 500, Attrs: map[string]any{"ip_address": "10.9.9.9", "vpn_status": "on"}, UpdatedAt: 100},
	}))
	require.NoError(t, ix.ApplySessionUpdates(ctx, []SessionUpdate{
		{SessionID: "s1", UserID: "u1", ExpiresAt: 900, Attrs: map[string]any{"os_platform": "Linux"}, UpdatedAt: 300},
	}))

	userID, expiresAt, attrs, times := storedSession(t, ix, "s1")
	assert.Equal(t, "u1", userID)
	assert.Equal(t, int64(900), expiresAt)
	assert.Equal(t, map[string]any{"os_platform": "Linux", "ip_address": "10.0.0.1", "vpn_status": "on"}, attrs)
	assert.Equal(t, map[string]int64{"os_platform": 300, "ip_address": 200, "vpn_status": 100}, times)
}

func TestApplySessionUpdatesValidatesIdentity(t *testing.T) {
	ix := newTestIndex(t)
	require.Error(t, ix.ApplySessionUpdates(context.Background(), []SessionUpdate{{SessionID: "s1"}}))
	require.Error(t, ix.ApplySessionUpdates(context.Background(), []SessionUpdate{{UserID: "u1"}}))
}

func TestSessionExpiry(t *testing.T) {
	ctx := context.Background()
	ix := newTestIndex(t)
	require.NoError(t, ix.UpsertUsers(ctx, []User{{ID: "u1"}, {ID: "u2"}, {ID: "u3"}}))
	require.NoError(t, ix.ApplySessionUpdates(ctx, []SessionUpdate{
		{SessionID: "expired", UserID: "u1", ExpiresAt: 1000},
		{SessionID: "live", UserID: "u2", ExpiresAt: 5000},
		{SessionID: "no-expiry", UserID: "u3", ExpiresAt: 0},
	}))

	const now = 2000
	live, err := ix.SearchUserIDs(ctx, Query{
		Where: `EXISTS (SELECT 1 FROM sessions s WHERE s.user_id = u.user_id AND s.expires_at > ?)`,
		Args:  []any{now},
		Limit: 10,
	})
	require.NoError(t, err)
	assert.Equal(t, []string{"u2", "u3"}, live, "a session with no expiry is always live")

	removed, err := ix.RemoveExpiredSessions(ctx, now)
	require.NoError(t, err)
	assert.Equal(t, int64(1), removed)
	stats, err := ix.Stats(ctx)
	require.NoError(t, err)
	assert.Equal(t, int64(2), stats.Sessions)
}

func TestRemovals(t *testing.T) {
	ctx := context.Background()
	ix := newTestIndex(t)
	require.NoError(t, ix.UpsertUsers(ctx, []User{{ID: "u1"}, {ID: "u2"}}))
	require.NoError(t, ix.ApplySessionUpdates(ctx, []SessionUpdate{
		{SessionID: "s1", UserID: "u1"},
		{SessionID: "s2", UserID: "u2"},
		{SessionID: "s3", UserID: "u2"},
	}))

	require.NoError(t, ix.RemoveSessions(ctx, []string{"s2"}))
	stats, err := ix.Stats(ctx)
	require.NoError(t, err)
	assert.Equal(t, Stats{Users: 2, Sessions: 2, Bytes: stats.Bytes}, stats)

	require.NoError(t, ix.RemoveUsers(ctx, []string{"u2"}))
	stats, err = ix.Stats(ctx)
	require.NoError(t, err)
	assert.Equal(t, int64(1), stats.Users)
	assert.Equal(t, int64(1), stats.Sessions, "removing a user removes their sessions")

	require.NoError(t, ix.RemoveAllSessions(ctx))
	stats, err = ix.Stats(ctx)
	require.NoError(t, err)
	assert.Equal(t, int64(0), stats.Sessions)
}

func TestSearchUserIDsPaging(t *testing.T) {
	ctx := context.Background()
	ix := newTestIndex(t)
	var users []User
	for i := range 5 {
		users = append(users, User{ID: fmt.Sprintf("u%d", i), Attributes: map[string]any{"department": "Engineering"}})
	}
	require.NoError(t, ix.UpsertUsers(ctx, users))

	where := `u.attributes_json ->> 'department' = ?`
	page1, err := ix.SearchUserIDs(ctx, Query{Where: where, Args: []any{"Engineering"}, Limit: 2})
	require.NoError(t, err)
	assert.Equal(t, []string{"u0", "u1"}, page1)
	page2, err := ix.SearchUserIDs(ctx, Query{Where: where, Args: []any{"Engineering"}, AfterID: "u1", Limit: 10})
	require.NoError(t, err)
	assert.Equal(t, []string{"u2", "u3", "u4"}, page2)

	count, err := ix.CountUsers(ctx, where, "Engineering")
	require.NoError(t, err)
	assert.Equal(t, int64(5), count)

	_, err = ix.SearchUserIDs(ctx, Query{Where: where, Args: []any{"Engineering"}})
	assert.Error(t, err, "an unbounded search is rejected")
	_, err = ix.SearchUserIDs(ctx, Query{Where: " ", Limit: 1})
	assert.Error(t, err)
}

func TestSearchesCannotWrite(t *testing.T) {
	ctx := context.Background()
	ix := newTestIndex(t)
	require.NoError(t, ix.UpsertUsers(ctx, []User{{ID: "u1"}}))

	_, err := ix.readDB.ExecContext(ctx, `DELETE FROM users`)
	require.ErrorContains(t, err, "readonly")
	_, err = ix.SearchUserIDs(ctx, Query{Where: `1) AND 0; DELETE FROM users; SELECT (1`, Limit: 1})
	require.Error(t, err)

	stats, err := ix.Stats(ctx)
	require.NoError(t, err)
	assert.Equal(t, int64(1), stats.Users)
}

// TestUserAndSessionAttributesTogether runs the lowering the policy compiler
// emits for user.attributes.department == "Engineering" &&
// user.session.device_managed == "true" && user.session.os_platform == "Windows":
// every session predicate is evaluated against the same live session, and each
// session attribute counts only while it is fresh.
func TestUserAndSessionAttributesTogether(t *testing.T) {
	ctx := context.Background()
	ix := newTestIndex(t)

	const (
		now       = 10_000
		freshFrom = 9_000
		expiresAt = 20_000
	)
	eng := map[string]any{"department": "Engineering"}
	require.NoError(t, ix.UpsertUsers(ctx, []User{
		{ID: "matching", Attributes: eng},
		{ID: "split_across_sessions", Attributes: eng},
		{ID: "expired_session", Attributes: eng},
		{ID: "stale_attribute", Attributes: eng},
		{ID: "other_department", Attributes: map[string]any{"department": "Sales"}},
		{ID: "no_session", Attributes: eng},
	}))
	both := map[string]any{"device_managed": "true", "os_platform": "Windows"}
	require.NoError(t, ix.ApplySessionUpdates(ctx, []SessionUpdate{
		{SessionID: "s1", UserID: "matching", ExpiresAt: expiresAt, Attrs: both, UpdatedAt: 9_500},
		{SessionID: "s2", UserID: "split_across_sessions", ExpiresAt: expiresAt, Attrs: map[string]any{"device_managed": "true"}, UpdatedAt: 9_500},
		{SessionID: "s3", UserID: "split_across_sessions", ExpiresAt: expiresAt, Attrs: map[string]any{"os_platform": "Windows"}, UpdatedAt: 9_500},
		{SessionID: "s4", UserID: "expired_session", ExpiresAt: now, Attrs: both, UpdatedAt: 9_500},
		{SessionID: "s5", UserID: "stale_attribute", ExpiresAt: expiresAt, Attrs: both, UpdatedAt: 8_000},
		{SessionID: "s6", UserID: "stale_attribute", ExpiresAt: expiresAt, Attrs: map[string]any{"os_platform": "Windows"}, UpdatedAt: 9_500},
		{SessionID: "s7", UserID: "other_department", ExpiresAt: expiresAt, Attrs: both, UpdatedAt: 9_500},
	}))

	ids, err := ix.SearchUserIDs(ctx, Query{
		Where: `u.attributes_json ->> 'department' = ?
			AND EXISTS (
				SELECT 1 FROM sessions s
				WHERE s.user_id = u.user_id
				  AND s.expires_at > ?
				  AND s.attribute_times_json ->> 'device_managed' >= ? AND s.attributes_json ->> 'device_managed' = ?
				  AND s.attribute_times_json ->> 'os_platform' >= ? AND s.attributes_json ->> 'os_platform' = ?
			)`,
		Args:  []any{"Engineering", now, freshFrom, "true", freshFrom, "Windows"},
		Limit: 10,
	})
	require.NoError(t, err)
	assert.Equal(t, []string{"matching"}, ids)
}

// TestNullAndMissingAttributesAreDistinct shows the key-presence guard an exact
// != needs: CEL admits a JSON-null value but denies a missing key.
func TestNullAndMissingAttributesAreDistinct(t *testing.T) {
	ctx := context.Background()
	ix := newTestIndex(t)
	require.NoError(t, ix.UpsertUsers(ctx, []User{
		{ID: "public", Attributes: map[string]any{"clearance": "public"}},
		{ID: "secret", Attributes: map[string]any{"clearance": "secret"}},
		{ID: "null", Attributes: map[string]any{"clearance": nil}},
		{ID: "missing", Attributes: map[string]any{}},
	}))

	ids, err := ix.SearchUserIDs(ctx, Query{
		Where: `json_type(u.attributes_json, '$.clearance') IS NOT NULL AND u.attributes_json ->> 'clearance' IS NOT ?`,
		Args:  []any{"secret"},
		Limit: 10,
	})
	require.NoError(t, err)
	assert.Equal(t, []string{"null", "public"}, ids)
}

func TestEnsureAttributeIndex(t *testing.T) {
	ctx := context.Background()
	ix := newTestIndex(t)

	for _, name := range []string{"", "1abc", "x') ON users (user_id); DROP TABLE users; --", "has space"} {
		assert.Error(t, ix.EnsureUserAttributeIndex(ctx, name), name)
	}
	require.NoError(t, ix.EnsureUserAttributeIndex(ctx, "department"))
	require.NoError(t, ix.EnsureUserAttributeIndex(ctx, "department"), "ensuring twice is a no-op")
	require.NoError(t, ix.EnsureSessionAttributeIndex(ctx, "os_platform"))

	var plan []string
	rows, err := ix.readDB.QueryContext(ctx, `EXPLAIN QUERY PLAN SELECT u.user_id FROM users u WHERE u.attributes_json ->> 'department' = ?`, "Engineering")
	require.NoError(t, err)
	defer rows.Close()
	for rows.Next() {
		var id, parent, notUsed int
		var detail string
		require.NoError(t, rows.Scan(&id, &parent, &notUsed, &detail))
		plan = append(plan, detail)
	}
	require.NoError(t, rows.Err())
	assert.Contains(t, fmt.Sprint(plan), "idx_users_attr_department")
}

func TestConcurrentReadsAndWrites(t *testing.T) {
	ctx := context.Background()
	ix := newTestIndex(t)
	require.NoError(t, ix.UpsertUsers(ctx, []User{{ID: "u1", Attributes: map[string]any{"department": "Engineering"}}}))

	var wg sync.WaitGroup
	for w := range 4 {
		wg.Go(func() {
			for i := range 50 {
				assert.NoError(t, ix.ApplySessionUpdates(ctx, []SessionUpdate{{
					SessionID: fmt.Sprintf("s%d-%d", w, i), UserID: "u1", Attrs: map[string]any{"os_platform": "Windows"}, UpdatedAt: int64(i),
				}}))
			}
		})
		wg.Go(func() {
			for range 50 {
				_, err := ix.SearchUserIDs(ctx, Query{
					Where: `EXISTS (SELECT 1 FROM sessions s WHERE s.user_id = u.user_id AND s.attributes_json ->> 'os_platform' = ?)`,
					Args:  []any{"Windows"},
					Limit: 10,
				})
				assert.NoError(t, err)
			}
		})
	}
	wg.Wait()

	stats, err := ix.Stats(ctx)
	require.NoError(t, err)
	assert.Equal(t, int64(200), stats.Sessions)
}
