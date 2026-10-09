// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"fmt"
	"hash/maphash"
	"math/rand/v2"
	"runtime"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/config"
)

const (
	broadcastBenchConns           = 5000
	broadcastBenchChannelsPerUser = 200
	broadcastBenchChannelPool     = 20000
	// broadcastBenchLoadLatency stands in for a primary database round trip
	// on membership loads made while churn is running.
	broadcastBenchLoadLatency = time.Millisecond
	// broadcastBenchChurnInterval is how often a user's channel membership
	// cache is invalidated while churn is running.
	broadcastBenchChurnInterval = time.Millisecond
)

// BenchmarkHubChannelBroadcast measures delivering one channel-scoped posted
// event through the production hubs (one per CPU) to 5000 connections, each
// user belonging to 200 channels: publish, then wait until every member of
// the event's channel has received it. Besides time and allocations per event
// it reports, per case, the live heap and objects held once the connections
// have loaded their memberships (live-MB, live-kobjs), the wall time of a
// full garbage collection over that heap (gc-ms), and the 99th percentile
// latency of one event (p99-us). The churn case invalidates a user's channel
// membership every millisecond while membership loads take a millisecond.
func BenchmarkHubChannelBroadcast(b *testing.B) {
	// A logger with no targets, also installed as the global logger that the
	// hubs log to: their lines would otherwise break benchstat's parsing.
	logger, err := mlog.NewLogger()
	require.NoError(b, err)
	mlog.InitGlobalLogger(logger)
	b.Cleanup(func() { mlog.InitGlobalLogger(nil) })

	cases := []struct {
		channelIteration bool
		members          int
		churn            bool
	}{
		{channelIteration: false, members: 50},
		{channelIteration: false, members: broadcastBenchConns},
		{channelIteration: true, members: 50},
		{channelIteration: true, members: broadcastBenchConns},
		{channelIteration: true, members: 50, churn: true},
	}
	for _, c := range cases {
		name := fmt.Sprintf("channelIteration=%t/members=%d", c.channelIteration, c.members)
		if c.churn {
			name += "/churn"
		}
		b.Run(name, func(b *testing.B) {
			benchHubChannelBroadcast(b, logger, c.channelIteration, c.members, c.churn)
		})
	}
}

func benchHubChannelBroadcast(b *testing.B, logger *mlog.Logger, channelIteration bool, members int, churn bool) {
	r := rand.New(rand.NewPCG(1, 1))
	pool := make([]string, broadcastBenchChannelPool)
	for i := range pool {
		pool[i] = model.NewId()
	}
	channelID := model.NewId()

	baseBytes, baseObjects := broadcastBenchHeap()

	channelStore := &broadcastBenchChannelStore{memberships: make(map[string][]string, broadcastBenchConns)}
	ps := newBroadcastBenchPlatform(b, logger, &broadcastBenchStore{channel: channelStore}, channelIteration)

	userIDs := make([]string, broadcastBenchConns)
	recipients := make([]*WebConn, 0, members)
	all := make([]*WebConn, 0, broadcastBenchConns)
	for i := range broadcastBenchConns {
		userID := model.NewId()
		userIDs[i] = userID
		channels := broadcastBenchSample(r, pool, broadcastBenchChannelsPerUser)
		if i < members {
			channels[0] = channelID
		}
		channelStore.memberships[userID] = channels

		wc := newBroadcastBenchConn(ps, userID)
		require.NoError(b, ps.HubRegister(wc))
		if i < members {
			recipients = append(recipients, wc)
		}
		all = append(all, wc)
	}
	event := newBroadcastBenchPostedEvent(b, channelID)
	// Deferred rather than b.Cleanup, which keeps a reference to its function
	// past its run and with it every connection.
	defer broadcastBenchStop(ps, all, event)
	publish := func() {
		ps.PublishSkipClusterSend(event)
		for _, wc := range recipients {
			<-wc.send
		}
	}

	// Untimed warm-up: with channel iteration off it fills every connection's
	// membership cache from the store, as the first event after connecting
	// does in production. Only members may have received the event.
	publish()
	for _, wc := range all {
		require.Empty(b, wc.send)
	}

	liveBytes, liveObjects := broadcastBenchHeap()
	gcStart := time.Now()
	runtime.GC()
	gcTime := time.Since(gcStart)

	var stopChurn func()
	if churn {
		channelStore.latency.Store(int64(broadcastBenchLoadLatency))
		stopChurn = broadcastBenchStartChurn(ps, userIDs)
	}

	latencies := make([]time.Duration, 0, 1024)
	b.ReportAllocs()
	for b.Loop() {
		start := time.Now()
		publish()
		latencies = append(latencies, time.Since(start))
	}

	if stopChurn != nil {
		stopChurn()
		channelStore.latency.Store(0)
	}

	slices.Sort(latencies)
	b.ReportMetric(float64(latencies[(99*len(latencies)+99)/100-1].Microseconds()), "p99-us")
	b.ReportMetric(float64(liveBytes-baseBytes)/1e6, "live-MB")
	b.ReportMetric(float64(liveObjects-baseObjects)/1e3, "live-kobjs")
	b.ReportMetric(float64(gcTime.Microseconds())/1e3, "gc-ms")
}

// broadcastBenchStartChurn invalidates a random user's channel membership
// cache every broadcastBenchChurnInterval until the returned stop is called.
func broadcastBenchStartChurn(ps *PlatformService, userIDs []string) (stop func()) {
	done := make(chan struct{})
	var wg sync.WaitGroup
	wg.Go(func() {
		r := rand.New(rand.NewPCG(2, 2))
		ticker := time.NewTicker(broadcastBenchChurnInterval)
		defer ticker.Stop()
		for {
			select {
			case <-done:
				return
			case <-ticker.C:
				ps.InvalidateChannelCacheForUser(userIDs[r.IntN(len(userIDs))])
			}
		}
	})
	return func() {
		close(done)
		wg.Wait()
	}
}

// broadcastBenchStop stops the hubs so that the next case starts from a clean
// heap. A hub closes the sockets of the connections it still holds when
// stopping, and these have none, so first have it drop them all: a hub drops a
// connection whose send queue is full.
func broadcastBenchStop(ps *PlatformService, conns []*WebConn, filler *model.WebSocketEvent) {
	for _, wc := range conns {
		for len(wc.send) < cap(wc.send) {
			wc.send <- filler
		}
	}
	ps.PublishSkipClusterSend(model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, ""))
	for _, hub := range ps.hubs {
		// Once a hub takes the event it handles it before it can see the stop.
		for len(hub.broadcast) > 0 {
			time.Sleep(time.Millisecond)
		}
	}
	ps.HubStop()
}

// broadcastBenchHeap returns the live heap bytes and object count after a full collection.
func broadcastBenchHeap() (bytes, objects uint64) {
	runtime.GC()
	runtime.GC()
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	return m.HeapAlloc, m.HeapObjects
}

// broadcastBenchSample returns n distinct channel IDs from pool.
func broadcastBenchSample(r *rand.Rand, pool []string, n int) []string {
	picked := make(map[int]struct{}, n)
	out := make([]string, 0, n)
	for len(out) < n {
		i := r.IntN(len(pool))
		if _, ok := picked[i]; ok {
			continue
		}
		picked[i] = struct{}{}
		out = append(out, pool[i])
	}
	return out
}

func newBroadcastBenchPlatform(tb testing.TB, logger *mlog.Logger, st store.Store, channelIteration bool) *PlatformService {
	tb.Helper()

	configStore := config.NewTestMemoryStore()
	cfg := configStore.Get()
	*cfg.ServiceSettings.EnableWebHubChannelIteration = channelIteration
	*cfg.ServiceSettings.EnableUserStatuses = false
	_, _, err := configStore.Set(cfg)
	require.NoError(tb, err)

	ps := &PlatformService{
		configStore: configStore,
		logger:      logger,
		Store:       st,
		hashSeed:    maphash.MakeSeed(),
	}
	ps.clientConfigHash.Store("")
	ps.hubStart(nil)
	return ps
}

// broadcastBenchSuite returns sessions that expire in an hour, as the real suite does, so a connection reloads its session once after an invalidation.
type broadcastBenchSuite struct {
	mockSuite
}

func (*broadcastBenchSuite) GetSession(string) (*model.Session, *model.AppError) {
	return &model.Session{ExpiresAt: model.GetMillis() + time.Hour.Milliseconds()}, nil
}

// newBroadcastBenchConn returns an authenticated connection with no socket.
// A non-zero reuseCount keeps registration from sending the hello message.
func newBroadcastBenchConn(ps *PlatformService, userID string) *WebConn {
	wc := &WebConn{
		Platform:           ps,
		Suite:              &broadcastBenchSuite{},
		UserId:             userID,
		send:               make(chan model.WebSocketMessage, sendQueueSize),
		reuseCount:         1,
		lastUserActivityAt: model.GetMillis(),
	}
	wc.SetConnectionID(model.NewId())
	wc.SetSession(&model.Session{UserId: userID, Roles: model.SystemUserRoleId})
	wc.SetSessionToken(model.NewId())
	wc.SetSessionExpiresAt(model.GetMillis() + time.Hour.Milliseconds())
	return wc
}

func newBroadcastBenchPostedEvent(tb testing.TB, channelID string) *model.WebSocketEvent {
	tb.Helper()
	post := &model.Post{
		Id:        model.NewId(),
		CreateAt:  model.GetMillis(),
		UpdateAt:  model.GetMillis(),
		UserId:    model.NewId(),
		ChannelId: channelID,
		Message:   "Hello @channel, this is a benchmark post with a link https://example.com/some/path?q=1 and some text to bring it up to a realistic size for a chat message.",
		Type:      model.PostTypeDefault,
	}
	postJSON, err := post.ToJSON()
	require.NoError(tb, err)

	event := model.NewWebSocketEvent(model.WebsocketEventPosted, "", channelID, "", nil, "")
	event.Add("post", postJSON)
	event.Add("channel_type", model.ChannelTypeOpen)
	event.Add("channel_display_name", "Town Square")
	event.Add("channel_name", "town-square")
	event.Add("sender_name", "@benchuser")
	event.Add("team_id", model.NewId())
	event.Add("set_online", true)
	return event
}

// broadcastBenchChannelStore answers membership loads from memory. Like a
// database scan, every load returns freshly allocated strings, and while
// latency is set every load takes that long.
type broadcastBenchChannelStore struct {
	store.ChannelStore
	memberships map[string][]string
	latency     atomic.Int64
}

func (s *broadcastBenchChannelStore) GetAllChannelMembersForUser(_ request.CTX, userID string, _ bool, _ bool) (map[string]string, error) {
	if d := s.latency.Load(); d > 0 {
		time.Sleep(time.Duration(d))
	}
	channels := s.memberships[userID]
	members := make(map[string]string, len(channels))
	for _, id := range channels {
		members[strings.Clone(id)] = strings.Clone(model.ChannelUserRoleId)
	}
	return members, nil
}

func (s *broadcastBenchChannelStore) InvalidateAllChannelMembersForUser(string) {}

type broadcastBenchUserStore struct {
	store.UserStore
}

func (s *broadcastBenchUserStore) InvalidateProfilesInChannelCacheByUser(string) {}

type broadcastBenchStore struct {
	store.Store
	channel *broadcastBenchChannelStore
}

func (s *broadcastBenchStore) Channel() store.ChannelStore {
	return s.channel
}

func (s *broadcastBenchStore) User() store.UserStore {
	return &broadcastBenchUserStore{}
}
