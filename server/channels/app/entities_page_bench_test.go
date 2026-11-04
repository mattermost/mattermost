// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/entities"
	"github.com/mattermost/mattermost/server/v8/platform/services/cache"
)

const entityPageSize = 60

func entityBenchApp(pattern cache.Cache) *App {
	return &App{ch: &Channels{srv: &Server{entityPatternCache: pattern}}}
}

func installEntityBenchMatchers(tb testing.TB) {
	tb.Helper()
	const pluginID = "com.example.bench"
	tb.Cleanup(func() { entities.RemovePlugin(pluginID) })
	specs := []struct {
		id, typeID, name, pattern string
	}{
		{"vuln", "vuln", "Vulnerability", `CVE-[0-9]{4}-[0-9]{4,7}`},
		{"ip", "ip", "IP address", `(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])(?:\.(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])){3}`},
		{"attack", "attack", "ATT&CK", `T[0-9]{4}(?:\.[0-9]{3})?`},
		{"freq", "freq", "Frequency", `FREQ:[ \t]*[0-9]+(?:\.[0-9]+)?`},
		{"dtg", "dtg", "Time", `\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:[Zz]|[+-]\d{2}:\d{2})`},
	}
	for _, spec := range specs {
		if err := entities.AddType(pluginID, &model.EntityType{ID: pluginID + "." + spec.typeID, DisplayName: spec.name}); err != nil {
			tb.Fatal(err)
		}
		if err := entities.AddMatcher(pluginID, &model.EntityMatcher{
			ID:      pluginID + "." + spec.id,
			TypeID:  pluginID + "." + spec.typeID,
			Pattern: spec.pattern,
		}); err != nil {
			tb.Fatal(err)
		}
	}
}

func entityBenchPosts() []*model.Post {
	posts := make([]*model.Post, entityPageSize)
	for i := range posts {
		message := "status is nominal on the bridge"
		if i%6 == 0 {
			message = "see CVE-2024-1234 and 141.98.9.137 and T1190"
		}
		posts[i] = &model.Post{
			Id:        model.NewId(),
			ChannelId: model.NewId(),
			UserId:    model.NewId(),
			Message:   message,
			CreateAt:  model.GetMillis(),
		}
	}
	return posts
}

func entityBenchLRU(tb testing.TB) cache.Cache {
	tb.Helper()
	return cache.NewLRU(&cache.CacheOptions{Name: "entity_pattern_bench", Size: entityPatternCacheSize, DefaultExpiry: entityPatternTTL})
}

func BenchmarkEntityPageCold(b *testing.B) {
	b.Setenv("MM_ENTITIES", "1")
	installEntityBenchMatchers(b)
	posts := entityBenchPosts()
	app := entityBenchApp(nil)
	rctx := request.TestContext(b)

	b.ResetTimer()
	for b.Loop() {
		resetEntityMemos()
		for _, post := range posts {
			post.Id = model.NewId()
			post.Metadata = nil
		}
		app.hydratePostList(rctx, posts)
	}
	b.StopTimer()
	b.ReportMetric(float64(entityScanCount.Load())/float64(b.N), "scans/page")
}

func BenchmarkEntityPageWarm(b *testing.B) {
	b.Setenv("MM_ENTITIES", "1")
	installEntityBenchMatchers(b)
	posts := entityBenchPosts()
	app := entityBenchApp(nil)
	rctx := request.TestContext(b)
	resetEntityMemos()
	app.hydratePostList(rctx, posts)
	before := entityScanCount.Load()

	b.ResetTimer()
	for b.Loop() {
		app.hydratePostList(rctx, posts)
	}
	b.StopTimer()
	b.ReportMetric(float64(entityScanCount.Load()-before)/float64(b.N), "scans/page")
}

func BenchmarkEntityPageLRU(b *testing.B) {
	b.Setenv("MM_ENTITIES", "1")
	installEntityBenchMatchers(b)
	posts := entityBenchPosts()
	app := entityBenchApp(entityBenchLRU(b))
	rctx := request.TestContext(b)
	resetEntityMemos()
	beforeWrites := patternWriteCount.Load()
	app.hydratePostList(rctx, posts)
	waitForPatternWrites(beforeWrites + int64(len(posts)) - patternWriteCount.Load())
	resetEntityMemos()
	before := entityScanCount.Load()

	b.ResetTimer()
	for b.Loop() {
		resetEntityMemos()
		app.hydratePostList(rctx, posts)
	}
	b.StopTimer()
	b.ReportMetric(float64(entityScanCount.Load()-before)/float64(b.N), "scans/page")
}

func entityBenchRedis(tb testing.TB) cache.Cache {
	tb.Helper()
	addr := os.Getenv("ENTITY_REDIS_ADDR")
	if addr == "" {
		addr = "127.0.0.1:6379"
	}
	provider, err := cache.NewRedisProvider(&cache.RedisOptions{RedisAddr: addr, DisableCache: true})
	if err != nil {
		tb.Skipf("redis: %v", err)
	}
	tb.Cleanup(func() { _ = provider.Close() })
	if _, err = provider.Connect(); err != nil {
		tb.Skipf("redis: %v", err)
	}
	pattern, err := provider.NewCache(&cache.CacheOptions{Name: "entity_pattern_bench", Size: entityPatternCacheSize, DefaultExpiry: entityPatternTTL})
	if err != nil {
		tb.Fatal(err)
	}
	return pattern
}

func BenchmarkEntityPageRedis(b *testing.B) {
	b.Setenv("MM_ENTITIES", "1")
	installEntityBenchMatchers(b)
	posts := entityBenchPosts()
	app := entityBenchApp(entityBenchRedis(b))
	rctx := request.TestContext(b)
	resetEntityMemos()
	beforeWrites := patternWriteCount.Load()
	app.hydratePostList(rctx, posts)
	waitForPatternWrites(beforeWrites + int64(len(posts)) - patternWriteCount.Load())
	resetEntityMemos()
	before := entityScanCount.Load()

	b.ResetTimer()
	for b.Loop() {
		resetEntityMemos()
		app.hydratePostList(rctx, posts)
	}
	b.StopTimer()
	b.ReportMetric(float64(entityScanCount.Load()-before)/float64(b.N), "scans/page")
}

func waitForPatternWrites(extra int64) {
	target := patternWriteCount.Load() + extra
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		if patternWriteCount.Load() >= target && len(patternWrites) == 0 {
			return
		}
		time.Sleep(5 * time.Millisecond)
	}
}

func TestEntityPageUsesTheMemoThenThePatternCache(t *testing.T) {
	t.Setenv("MM_ENTITIES", "1")
	installEntityBenchMatchers(t)
	posts := entityBenchPosts()
	application := entityBenchApp(entityBenchLRU(t))
	rctx := request.TestContext(t)
	resetEntityMemos()
	t.Cleanup(resetEntityMemos)
	entityScanCount.Store(0)

	beforeWrites := patternWriteCount.Load()
	application.hydratePostList(rctx, posts)
	require.Equal(t, int64(len(posts)), entityScanCount.Load())
	var marked int
	for _, post := range posts {
		require.NotNil(t, post.Metadata)
		if len(post.Metadata.Entities) > 0 {
			marked++
		}
	}
	require.NotZero(t, marked)
	waitForPatternWrites(beforeWrites + int64(len(posts)) - patternWriteCount.Load())

	application.hydratePostList(rctx, posts)
	require.Equal(t, int64(len(posts)), entityScanCount.Load())

	resetEntityMemos()
	for _, post := range posts {
		post.Metadata = nil
	}
	application.hydratePostList(rctx, posts)
	require.Equal(t, int64(len(posts)), entityScanCount.Load())
	for _, post := range posts {
		require.NotNil(t, post.Metadata)
	}
}

func TestEntityPageServesAStaleGeneration(t *testing.T) {
	t.Setenv("MM_ENTITIES", "1")
	installEntityBenchMatchers(t)
	post := entityBenchPosts()[0]
	post.Message = "see CVE-2024-1234 today"
	application := entityBenchApp(nil)
	rctx, serve := application.BeginEntityServe(request.TestContext(t))
	resetEntityMemos()
	t.Cleanup(resetEntityMemos)
	patternMemo.put(patternKey(post.Id, entities.MessageHash(post.Message)), patternHit{
		generation: "stale",
		patterns:   []*model.PostEntity{{ID: "0:4", Start: 0, End: 4, Value: "kept", TypeIDs: []string{"com.example.bench.vuln"}}},
	}, 32)

	application.hydratePostList(rctx, []*model.Post{post})
	require.True(t, serve.Stale())
	require.NotEmpty(t, post.Metadata.Entities)
	require.Equal(t, "kept", post.Metadata.Entities[0].Value)
}
