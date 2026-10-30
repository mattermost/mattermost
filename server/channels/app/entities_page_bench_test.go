// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/entities"
	"github.com/mattermost/mattermost/server/v8/channels/app/platform"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
)

const entityPageSize = 60
const entityQueryDelay = 300 * time.Microsecond

type countingEntityStore struct {
	mu    sync.Mutex
	rows  map[string]*model.PostEntityRow
	gets  atomic.Int64
	saves atomic.Int64
	delay time.Duration
}

func (s *countingEntityStore) Get(postID string) (*model.PostEntityRow, error) {
	s.gets.Add(1)
	if s.delay > 0 {
		time.Sleep(s.delay)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	row := s.rows[postID]
	if row == nil {
		return nil, nil
	}
	clone := *row
	return &clone, nil
}

func (s *countingEntityStore) Save(row *model.PostEntityRow) error {
	s.saves.Add(1)
	if s.delay > 0 {
		time.Sleep(s.delay)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.rows == nil {
		s.rows = map[string]*model.PostEntityRow{}
	}
	clone := *row
	s.rows[row.PostId] = &clone
	return nil
}

func (s *countingEntityStore) GetMany(ids []string) (map[string]*model.PostEntityRow, error) {
	s.gets.Add(1)
	if s.delay > 0 {
		time.Sleep(s.delay)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make(map[string]*model.PostEntityRow, len(ids))
	for _, id := range ids {
		row := s.rows[id]
		if row == nil {
			continue
		}
		clone := *row
		out[id] = &clone
	}
	return out, nil
}

type entityBenchStore struct {
	*storetest.Store
	entities store.PostEntityStore
}

func (s entityBenchStore) PostEntity() store.PostEntityStore {
	return s.entities
}

func entityBenchApp(entities store.PostEntityStore) *App {
	return &App{ch: &Channels{srv: &Server{platform: &platform.PlatformService{Store: entityBenchStore{
		Store:    &storetest.Store{},
		entities: entities,
	}}}}}
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

func seedEntityRows(rows map[string]*model.PostEntityRow, posts []*model.Post) {
	generation := entities.PatternGeneration()
	for _, post := range posts {
		rows[post.Id] = &model.PostEntityRow{
			PostId:            post.Id,
			ChannelId:         post.ChannelId,
			MessageHash:       entities.MessageHash(post.Message),
			PatternGeneration: generation,
			ProtectedRanges:   [][2]int{},
			Entities:          []*model.PostEntity{},
		}
	}
}

func BenchmarkEntityPageSteady(b *testing.B) {
	b.Setenv("MM_ENTITIES", "1")
	installEntityBenchMatchers(b)
	posts := entityBenchPosts()
	backend := &countingEntityStore{rows: map[string]*model.PostEntityRow{}, delay: entityQueryDelay}
	seedEntityRows(backend.rows, posts)
	app := entityBenchApp(backend)
	rctx := request.TestContext(b)

	b.ResetTimer()
	for b.Loop() {
		postEntityMemo.reset()
		app.hydratePostList(rctx, posts)
	}
	b.StopTimer()
	b.ReportMetric(float64(backend.gets.Load())/float64(b.N), "gets/page")
	b.ReportMetric(float64(backend.saves.Load())/float64(b.N), "saves/page")
}

func BenchmarkEntityPageWarm(b *testing.B) {
	b.Setenv("MM_ENTITIES", "1")
	installEntityBenchMatchers(b)
	posts := entityBenchPosts()
	backend := &countingEntityStore{rows: map[string]*model.PostEntityRow{}, delay: entityQueryDelay}
	seedEntityRows(backend.rows, posts)
	app := entityBenchApp(backend)
	rctx := request.TestContext(b)
	postEntityMemo.reset()
	app.hydratePostList(rctx, posts)
	backend.gets.Store(0)
	backend.saves.Store(0)

	b.ResetTimer()
	for b.Loop() {
		app.hydratePostList(rctx, posts)
	}
	b.StopTimer()
	b.ReportMetric(float64(backend.gets.Load())/float64(b.N), "gets/page")
	b.ReportMetric(float64(backend.saves.Load())/float64(b.N), "saves/page")
}

func BenchmarkEntityPageCold(b *testing.B) {
	b.Setenv("MM_ENTITIES", "1")
	installEntityBenchMatchers(b)
	posts := entityBenchPosts()
	backend := &countingEntityStore{rows: map[string]*model.PostEntityRow{}, delay: entityQueryDelay}
	app := entityBenchApp(backend)
	rctx := request.TestContext(b)

	b.ResetTimer()
	for b.Loop() {
		postEntityMemo.reset()
		for _, post := range posts {
			post.Id = model.NewId()
		}
		app.hydratePostList(rctx, posts)
	}
	b.StopTimer()
	b.ReportMetric(float64(backend.gets.Load())/float64(b.N), "gets/page")
	b.ReportMetric(float64(backend.saves.Load())/float64(b.N), "saves/page")
}

func TestEntityPageReadsOnce(t *testing.T) {
	t.Setenv("MM_ENTITIES", "1")
	installEntityBenchMatchers(t)
	posts := entityBenchPosts()
	backend := &countingEntityStore{rows: map[string]*model.PostEntityRow{}}
	seedEntityRows(backend.rows, posts)
	application := entityBenchApp(backend)
	rctx := request.TestContext(t)
	postEntityMemo.reset()
	t.Cleanup(postEntityMemo.reset)

	application.hydratePostList(rctx, posts)
	require.Equal(t, int64(1), backend.gets.Load())
	require.Equal(t, int64(0), backend.saves.Load())
	for _, post := range posts {
		require.NotNil(t, post.Metadata)
	}

	backend.gets.Store(0)
	application.hydratePostList(rctx, posts)
	require.Equal(t, int64(0), backend.gets.Load())
}

func TestEntityPageRefreshesStaleGeneration(t *testing.T) {
	t.Setenv("MM_ENTITIES", "1")
	installEntityBenchMatchers(t)
	posts := entityBenchPosts()[:1]
	post := posts[0]
	backend := &countingEntityStore{rows: map[string]*model.PostEntityRow{}}
	backend.rows[post.Id] = &model.PostEntityRow{
		PostId:            post.Id,
		ChannelId:         post.ChannelId,
		MessageHash:       entities.MessageHash(post.Message),
		PatternGeneration: "stale",
		ProtectedRanges:   [][2]int{},
		Entities:          []*model.PostEntity{{Value: "kept"}},
	}
	application := entityBenchApp(backend)
	rctx := request.TestContext(t)
	postEntityMemo.reset()
	t.Cleanup(postEntityMemo.reset)

	application.hydratePostList(rctx, posts)
	require.Equal(t, int64(1), backend.gets.Load())
	require.Len(t, post.Metadata.Entities, 1)
	require.Equal(t, "kept", post.Metadata.Entities[0].Value)
	require.Eventually(t, func() bool {
		return backend.saves.Load() >= 1
	}, 2*time.Second, 10*time.Millisecond)
}
