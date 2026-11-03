// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package attributeindex

import (
	"context"
	"fmt"
	"os"
	"runtime"
	"strconv"
	"testing"

	"github.com/stretchr/testify/require"
)

const (
	benchNow       = 1_000_000
	benchFreshFrom = benchNow - 60_000
)

func benchUsers(b *testing.B) int {
	raw := os.Getenv("MM_ATTRIBUTE_INDEX_BENCH_USERS")
	if raw == "" {
		return 100_000
	}
	n, err := strconv.Atoi(raw)
	require.NoError(b, err, "MM_ATTRIBUTE_INDEX_BENCH_USERS")
	return n
}

// rssBytes reads the resident set size on Linux and returns 0 elsewhere.
func rssBytes() int64 {
	raw, err := os.ReadFile("/proc/self/statm")
	if err != nil {
		return 0
	}
	var size, resident int64
	if _, err := fmt.Sscan(string(raw), &size, &resident); err != nil {
		return 0
	}
	return resident * int64(os.Getpagesize())
}

// dirBytes is the memory the index holds outside the process when its directory
// is on tmpfs: the database file plus its write-ahead log.
func dirBytes(b *testing.B, dir string) int64 {
	entries, err := os.ReadDir(dir)
	require.NoError(b, err)
	var total int64
	for _, e := range entries {
		info, err := e.Info()
		require.NoError(b, err)
		total += info.Size()
	}
	return total
}

// loadBenchPopulation gives user i four attributes and 1 + i%3 live sessions,
// each with three attributes refreshed within the freshness window.
func loadBenchPopulation(b *testing.B, ix *Index, n int) {
	ctx := context.Background()
	departments := []string{"Engineering", "Sales", "Support", "Legal"}
	clearances := []string{"public", "secret", "top_secret"}
	platforms := []string{"Windows", "macOS", "Linux"}

	const batch = 1_000
	users := make([]User, 0, batch)
	sessions := make([]SessionUpdate, 0, 2*batch)
	flush := func() {
		require.NoError(b, ix.UpsertUsers(ctx, users))
		require.NoError(b, ix.ApplySessionUpdates(ctx, sessions))
		users, sessions = users[:0], sessions[:0]
	}
	for i := range n {
		id := fmt.Sprintf("user%08d", i)
		users = append(users, User{
			ID:       id,
			Email:    id + "@example.com",
			CreateAt: int64(i),
			Attributes: map[string]any{
				"department": departments[i%len(departments)],
				"clearance":  clearances[i%len(clearances)],
				"location":   fmt.Sprintf("site-%02d", i%50),
				"title":      fmt.Sprintf("title-%03d", i%200),
			},
		})
		for s := range 1 + i%3 {
			sessions = append(sessions, SessionUpdate{
				SessionID: fmt.Sprintf("%s-s%d", id, s),
				UserID:    id,
				ExpiresAt: benchNow * 2,
				Attrs: map[string]any{
					"os_platform":    platforms[(i+s)%len(platforms)],
					"device_managed": strconv.FormatBool((i+s)%2 == 0),
					"ip_address":     fmt.Sprintf("10.%d.%d.%d", s, (i/256)%256, i%256),
				},
				UpdatedAt: benchNow - int64((i+s)%120_000),
			})
		}
		if len(users) == batch {
			flush()
		}
	}
	flush()
}

// BenchmarkIndex loads MM_ATTRIBUTE_INDEX_BENCH_USERS users (default 100,000)
// with sessions, reports memory, then times one 100-row page and one count per
// policy shape, and session update throughput.
func BenchmarkIndex(b *testing.B) {
	ctx := context.Background()
	n := benchUsers(b)

	runtime.GC()
	rssBefore := rssBytes()
	ix, err := New(ctx, Options{MaxReaders: runtime.GOMAXPROCS(0)})
	require.NoError(b, err)
	b.Cleanup(func() { require.NoError(b, ix.Close()) })
	loadBenchPopulation(b, ix, n)
	require.NoError(b, ix.EnsureUserAttributeIndex(ctx, "department"))
	require.NoError(b, ix.EnsureSessionAttributeIndex(ctx, "os_platform"))
	runtime.GC()
	rssAfter := rssBytes()

	stats, err := ix.Stats(ctx)
	require.NoError(b, err)
	b.Logf("users=%d sessions=%d db=%.1f MB (%.0f B/user) files=%.1f MB rss_delta=%.1f MB",
		stats.Users, stats.Sessions, float64(stats.Bytes)/1e6, float64(stats.Bytes)/float64(stats.Users),
		float64(dirBytes(b, ix.dir))/1e6, float64(rssAfter-rssBefore)/1e6)

	sessionClause := `EXISTS (SELECT 1 FROM sessions s WHERE s.user_id = u.user_id AND s.expires_at > ?
		AND s.attribute_times_json ->> 'os_platform' >= ? AND s.attributes_json ->> 'os_platform' = ?
		AND s.attribute_times_json ->> 'device_managed' >= ? AND s.attributes_json ->> 'device_managed' = ?)`
	sessionArgs := []any{benchNow, benchFreshFrom, "Windows", benchFreshFrom, "true"}

	shapes := []struct {
		name  string
		where string
		args  []any
	}{
		{"user_indexed", `u.attributes_json ->> 'department' = ?`, []any{"Engineering"}},
		{"user_scan", `u.attributes_json ->> 'location' = ?`, []any{"site-07"}},
		{"user_and_session", `u.attributes_json ->> 'department' = ? AND ` + sessionClause, append([]any{"Engineering"}, sessionArgs...)},
		{"user_or_session", `u.attributes_json ->> 'department' = ? OR ` + sessionClause, append([]any{"Engineering"}, sessionArgs...)},
		{"session_only", sessionClause, sessionArgs},
	}
	for _, shape := range shapes {
		b.Run(shape.name+"/page", func(b *testing.B) {
			b.ReportAllocs()
			for b.Loop() {
				_, err := ix.SearchUserIDs(ctx, Query{Where: shape.where, Args: shape.args, Limit: 100})
				require.NoError(b, err)
			}
		})
		b.Run(shape.name+"/count", func(b *testing.B) {
			for b.Loop() {
				_, err := ix.CountUsers(ctx, shape.where, shape.args...)
				require.NoError(b, err)
			}
		})
	}

	b.Run("apply_session_updates/batch_100", func(b *testing.B) {
		updates := make([]SessionUpdate, 100)
		i := 0
		for b.Loop() {
			for j := range updates {
				id := fmt.Sprintf("user%08d", (i*100+j)%n)
				updates[j] = SessionUpdate{SessionID: id + "-s0", UserID: id, ExpiresAt: benchNow * 2, Attrs: map[string]any{"ip_address": "10.1.1.1"}, UpdatedAt: benchNow + int64(i)}
			}
			require.NoError(b, ix.ApplySessionUpdates(ctx, updates))
			i++
		}
	})
}
