// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"math/rand/v2"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
)

// setupPushTest returns a helper that may deliver to loopback receivers.
func setupPushTest(t *testing.T) *TestHelper {
	t.Helper()

	th := Setup(t).InitBasic(t)
	allowLocalReceivers(th, "127.0.0.1")
	return th
}

func allowLocalReceivers(th *TestHelper, allowed string) {
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = allowed
	})
}

// newTestBotEventDispatcher starts a dispatcher with fast timings. Two of them on one helper
// behave as two nodes: the database is all they share.
func newTestBotEventDispatcher(t *testing.T, th *TestHelper, opts ...func(*botEventDispatcher)) *botEventDispatcher {
	t.Helper()

	d := newBotEventDispatcher(th.App.Srv())
	d.settleWindow = 0
	d.sweepInterval = 50 * time.Millisecond
	for _, opt := range opts {
		opt(d)
	}
	d.start()
	t.Cleanup(d.stop)
	return d
}

func (d *botEventDispatcher) idle() bool {
	d.mu.Lock()
	defer d.mu.Unlock()
	return len(d.active) == 0
}

type fakeBotEventClock struct {
	mu  sync.Mutex
	now time.Time
}

func newFakeBotEventClock() *fakeBotEventClock {
	return &fakeBotEventClock{now: time.Now().Truncate(time.Millisecond)}
}

func (c *fakeBotEventClock) Now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.now
}

func (c *fakeBotEventClock) Set(t time.Time) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.now = t
}

func withClock(c *fakeBotEventClock) func(*botEventDispatcher) {
	return func(d *botEventDispatcher) { d.now = c.Now }
}

// seedPushSubscription stores a push subscription directly, skipping URL verification.
func seedPushSubscription(t *testing.T, th *TestHelper, botID, callbackURL string) *model.BotEventSubscription {
	t.Helper()

	sub, err := th.App.Srv().Store().BotEventSubscription().Save(th.Context, &model.BotEventSubscription{
		BotUserId:        botID,
		Mode:             model.BotEventSubscriptionModePush,
		CallbackURL:      callbackURL,
		Secret:           model.NewRandomString(model.BotEventSecretLength),
		IgnoreBotAuthors: true,
		Enabled:          true,
	})
	require.NoError(t, err)
	return sub
}

// newPushTestBot creates a bot that can be messaged and subscribes it to push through the app.
func newPushTestBot(t *testing.T, th *TestHelper, callbackURL string) (*model.Bot, *model.User, *model.BotEventSubscription) {
	t.Helper()

	bot := th.CreateBot(t)
	user, appErr := th.App.GetUser(th.Context, bot.UserId)
	require.Nil(t, appErr)
	th.LinkUserToTeam(t, user, th.BasicTeam)

	sub, _, appErr := th.App.CreateOrUpdateBotEventSubscription(th.Context, bot.UserId, &model.BotEventSubscriptionPatch{
		Mode:        new(model.BotEventSubscriptionModePush),
		CallbackURL: &callbackURL,
	})
	require.Nil(t, appErr)
	return bot, user, sub
}

func getTestSubscription(t *testing.T, th *TestHelper, botID string) *model.BotEventSubscription {
	t.Helper()

	sub, err := th.App.Srv().Store().BotEventSubscription().Get(store.RequestContextWithMaster(th.Context), botID)
	require.NoError(t, err)
	return sub
}

func waitForAck(t *testing.T, th *TestHelper, botID string, want model.BotEventCursor) {
	t.Helper()

	require.Eventually(t, func() bool {
		return getTestSubscription(t, th, botID).AckCursor() == want
	}, 10*time.Second, 10*time.Millisecond)
}

func storedEventIDs(events []*model.BotEvent) []string {
	ids := make([]string, len(events))
	for i, e := range events {
		ids[i] = e.Id
	}
	return ids
}

func repeatEach(ids []string, n int) []string {
	var out []string
	for _, id := range ids {
		for range n {
			out = append(out, id)
		}
	}
	return out
}

func TestBotEventPushEndToEnd(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupPushTest(t)

	rcv := testlib.NewBotEventReceiver(t, nil)
	bot, botUser, sub := newPushTestBot(t, th, rcv.URL()+"/hook")
	require.Len(t, rcv.Verifications(), 1)

	// Only the post's wake-up can trigger delivery: the sweep never fires again.
	d := th.App.Srv().botEventDispatcher
	d.settleWindow = 0
	d.sweepInterval = time.Hour
	d.start()
	t.Cleanup(d.stop)

	postAs(t, th, th.BasicUser.Id, th.CreateDmChannel(t, botUser), "hello bot", "")

	stored := botEventsFor(t, th, bot.UserId)
	require.Len(t, stored, 1)
	waitForAck(t, th, bot.UserId, stored[0].Cursor())
	require.Eventually(t, func() bool { return getTestSubscription(t, th, bot.UserId).LeaseNode == "" }, 5*time.Second, 10*time.Millisecond)

	received := rcv.Events()
	require.Len(t, received, 1)
	req := received[0]
	require.NoError(t, model.VerifyBotEventSignature(sub.Secret, req.Header.Get(model.BotEventHeaderTimestamp), req.Body, req.Header.Get(model.BotEventHeaderSignature), time.Now()))
	assert.Equal(t, stored[0].Id, req.Header.Get(model.BotEventHeaderEventId))
	assert.Equal(t, bot.UserId, req.Header.Get(model.BotEventHeaderBotId))
	assert.Equal(t, "application/json", req.Header.Get("Content-Type"))

	env, err := stored[0].ToEnvelope()
	require.NoError(t, err)
	want, err := json.Marshal(env)
	require.NoError(t, err)
	assert.JSONEq(t, string(want), string(req.Body))
}

func TestBotEventDispatcherLeaseContention(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupPushTest(t)

	rcv := testlib.NewBotEventReceiver(t, func(*http.Request, []byte) int {
		time.Sleep(time.Duration(rand.IntN(20)) * time.Millisecond)
		return http.StatusOK
	})
	a := newTestBotEventDispatcher(t, th)
	b := newTestBotEventDispatcher(t, th)

	want := map[string][]string{}
	for range 5 {
		var botIDs []string
		var last = map[string]model.BotEventCursor{}
		for range 3 {
			bot := th.CreateBot(t)
			seedPushSubscription(t, th, bot.UserId, rcv.URL())
			events := seedBotEvents(t, th, bot.UserId, 30)
			botIDs = append(botIDs, bot.UserId)
			want[bot.UserId] = storedEventIDs(events)
			last[bot.UserId] = events[len(events)-1].Cursor()
		}
		a.Wake(botIDs...)
		b.Wake(botIDs...)
		for _, id := range botIDs {
			waitForAck(t, th, id, last[id])
		}
	}

	got := map[string][]string{}
	for _, req := range rcv.Events() {
		botID := req.Header.Get(model.BotEventHeaderBotId)
		got[botID] = append(got[botID], req.EventID)
	}
	assert.Equal(t, want, got, "every event is delivered exactly once, in order")
	assert.Equal(t, 1, rcv.MaxInFlight(), "one request in flight per bot")
}

func TestBotEventDispatcherLeaseTakeover(t *testing.T) {
	mainHelper.Parallel(t)

	for _, tc := range []struct {
		name        string
		staleStatus int
	}{
		{"stale request succeeds", http.StatusOK},
		{"stale request fails", http.StatusInternalServerError},
	} {
		t.Run(tc.name, func(t *testing.T) {
			th := setupPushTest(t)
			th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.OutgoingIntegrationRequestsTimeout = 5 })

			// The first request, made by A, is held until the test releases it.
			var calls atomic.Int32
			release := make(chan struct{})
			rcv := testlib.NewBotEventReceiver(t, func(*http.Request, []byte) int {
				if calls.Add(1) == 1 {
					<-release
					return tc.staleStatus
				}
				return http.StatusOK
			})
			var once sync.Once
			releaseStale := func() { once.Do(func() { close(release) }) }
			t.Cleanup(releaseStale)

			bot := th.CreateBot(t)
			seedPushSubscription(t, th, bot.UserId, rcv.URL())
			events := seedBotEvents(t, th, bot.UserId, 2)
			ids := storedEventIDs(events)

			// The sampler checks that the ack never moves backwards.
			stopSampler := make(chan struct{})
			samplerDone := make(chan struct{})
			var stopOnce sync.Once
			stop := func() { stopOnce.Do(func() { close(stopSampler) }) }
			t.Cleanup(stop)
			var regressed atomic.Bool
			go func() {
				defer close(samplerDone)
				var last model.BotEventCursor
				for {
					select {
					case <-stopSampler:
						return
					case <-time.After(5 * time.Millisecond):
						sub, err := th.App.Srv().Store().BotEventSubscription().Get(store.RequestContextWithMaster(th.Context), bot.UserId)
						if err != nil {
							continue
						}
						if sub.AckCursor().Less(last) {
							regressed.Store(true)
						}
						last = sub.AckCursor()
					}
				}
			}()

			a := newTestBotEventDispatcher(t, th, func(d *botEventDispatcher) { d.leaseDuration = 200 * time.Millisecond })
			require.Eventually(t, func() bool { return len(rcv.Events()) == 1 }, 5*time.Second, 5*time.Millisecond)

			newTestBotEventDispatcher(t, th)
			waitForAck(t, th, bot.UserId, events[1].Cursor())

			releaseStale()
			require.Eventually(t, a.idle, 5*time.Second, 5*time.Millisecond)
			stop()
			<-samplerDone

			assert.False(t, regressed.Load())
			sub := getTestSubscription(t, th, bot.UserId)
			assert.Equal(t, events[1].Cursor(), sub.AckCursor())
			assert.Zero(t, sub.ConsecutiveFailures, "a failure from a node that lost its lease is not recorded")
			assert.Equal(t, []string{ids[0], ids[0], ids[1]}, rcv.EventIDs())
		})
	}
}

func TestBotEventDispatcherOrderingUnderFailure(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupPushTest(t)

	var mu sync.Mutex
	attempts := map[string]int{}
	rcv := testlib.NewBotEventReceiver(t, func(r *http.Request, _ []byte) int {
		mu.Lock()
		defer mu.Unlock()
		id := r.Header.Get(model.BotEventHeaderEventId)
		attempts[id]++
		if attempts[id] == 1 {
			return http.StatusInternalServerError
		}
		return http.StatusOK
	})

	bot := th.CreateBot(t)
	seedPushSubscription(t, th, bot.UserId, rcv.URL())
	events := seedBotEvents(t, th, bot.UserId, 5)

	newTestBotEventDispatcher(t, th, func(d *botEventDispatcher) { d.backoff = []time.Duration{0} })
	waitForAck(t, th, bot.UserId, events[4].Cursor())

	assert.Equal(t, repeatEach(storedEventIDs(events), 2), rcv.EventIDs(), "each event fails once and succeeds before its successor is sent")
}

func TestBotEventDispatcherDuplicateAfterCrash(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupPushTest(t)

	rcv := testlib.NewBotEventReceiver(t, nil)
	bot := th.CreateBot(t)
	seedPushSubscription(t, th, bot.UserId, rcv.URL())
	events := seedBotEvents(t, th, bot.UserId, 1)

	first := newTestBotEventDispatcher(t, th)
	waitForAck(t, th, bot.UserId, events[0].Cursor())
	first.stop()
	require.Len(t, rcv.Events(), 1)

	// The receiver has the event, but the node died before acknowledging it.
	_, err := th.SQLStore.GetMaster().Exec(`UPDATE BotEventSubscriptions
		SET AckCursorCreateAt = 0, AckCursorId = '', LeaseNode = 'dead',
			LeaseExpiresAt = (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint + 400
		WHERE BotUserId = $1`, bot.UserId)
	require.NoError(t, err)

	newTestBotEventDispatcher(t, th)
	require.Never(t, func() bool { return len(rcv.Events()) > 1 }, 200*time.Millisecond, 10*time.Millisecond, "the dead node's lease is respected")
	require.Eventually(t, func() bool { return len(rcv.Events()) == 2 }, 5*time.Second, 10*time.Millisecond)

	assert.Equal(t, []string{events[0].Id, events[0].Id}, rcv.EventIDs())
	waitForAck(t, th, bot.UserId, events[0].Cursor())
}

func TestBotEventDispatcherLostWakeFallsBackToSweep(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupPushTest(t)

	rcv := testlib.NewBotEventReceiver(t, nil)
	_, botUser, _ := newPushTestBot(t, th, rcv.URL())

	// The server's own dispatcher is not running and this node never receives a wake.
	newTestBotEventDispatcher(t, th)
	postAs(t, th, th.BasicUser.Id, th.CreateDmChannel(t, botUser), "hello", "")

	require.Eventually(t, func() bool { return len(rcv.Events()) == 1 }, 5*time.Second, 10*time.Millisecond)
	stored := botEventsFor(t, th, botUser.Id)
	require.Len(t, stored, 1)
	assert.Equal(t, stored[0].Id, rcv.EventIDs()[0])
}

func TestBotEventDispatcherShutdownMidRequest(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupPushTest(t)

	var blocked atomic.Bool
	blocked.Store(true)
	rcv := testlib.NewBotEventReceiver(t, func(r *http.Request, _ []byte) int {
		if blocked.Load() {
			<-r.Context().Done()
		}
		return http.StatusOK
	})
	bot := th.CreateBot(t)
	seedPushSubscription(t, th, bot.UserId, rcv.URL())
	events := seedBotEvents(t, th, bot.UserId, 1)

	d := newTestBotEventDispatcher(t, th)
	require.Eventually(t, func() bool { return len(rcv.Events()) == 1 }, 5*time.Second, 5*time.Millisecond)

	start := time.Now()
	d.stop()
	assert.Less(t, time.Since(start), time.Second)

	sub := getTestSubscription(t, th, bot.UserId)
	assert.Zero(t, sub.ConsecutiveFailures)
	assert.Zero(t, sub.NextAttemptAt)
	assert.Empty(t, sub.LeaseNode)
	assert.Equal(t, model.BotEventCursor{}, sub.AckCursor())

	blocked.Store(false)
	newTestBotEventDispatcher(t, th)
	waitForAck(t, th, bot.UserId, events[0].Cursor())
	assert.Equal(t, []string{events[0].Id, events[0].Id}, rcv.EventIDs())
}

func TestBotEventDispatcherBackoff(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupPushTest(t)

	rcv := testlib.NewBotEventReceiver(t, func(*http.Request, []byte) int { return http.StatusInternalServerError })
	bot := th.CreateBot(t)
	seedPushSubscription(t, th, bot.UserId, rcv.URL())
	seedBotEvents(t, th, bot.UserId, 1)

	clock := newFakeBotEventClock()
	d := newTestBotEventDispatcher(t, th, withClock(clock), func(d *botEventDispatcher) { d.sweepInterval = time.Hour })

	waitForFailures := func(n int) *model.BotEventSubscription {
		var sub *model.BotEventSubscription
		require.Eventually(t, func() bool {
			sub = getTestSubscription(t, th, bot.UserId)
			return sub.ConsecutiveFailures == n && sub.LeaseNode == ""
		}, 5*time.Second, 5*time.Millisecond)
		return sub
	}

	sub := waitForFailures(1)
	assert.Equal(t, clock.Now().Add(5*time.Second).UnixMilli(), sub.NextAttemptAt)
	assert.Equal(t, clock.Now().UnixMilli(), sub.FirstFailureAt)

	delays := []time.Duration{30 * time.Second, 2 * time.Minute, 10 * time.Minute, 30 * time.Minute, time.Hour, time.Hour}
	for i, delay := range delays {
		due := time.UnixMilli(sub.NextAttemptAt)

		clock.Set(due.Add(-time.Millisecond))
		d.sweepOnce()
		require.Never(t, func() bool { return len(rcv.Events()) > i+1 }, 100*time.Millisecond, 10*time.Millisecond, "nothing is sent before the retry is due")

		clock.Set(due)
		d.sweepOnce()
		sub = waitForFailures(i + 2)
		assert.Equal(t, due.Add(delay).UnixMilli(), sub.NextAttemptAt, "attempt %d", i+2)
	}
	assert.True(t, sub.Enabled)
}

func TestBotEventDispatcherAutoDisable(t *testing.T) {
	mainHelper.Parallel(t)

	const callbackPath = "/hooks/secret-token"
	tests := []struct {
		name           string
		firstFailureAt func(now time.Time) int64
		status         int
		wantEnabled    bool
		wantReason     string
		wantDMContains string
	}{
		{
			name:           "just under 24 hours keeps retrying",
			firstFailureAt: func(now time.Time) int64 { return now.Add(-model.BotEventMaxFailureDuration).UnixMilli() + 1 },
			status:         http.StatusInternalServerError,
			wantEnabled:    true,
		},
		{
			name:           "24 hours disables",
			firstFailureAt: func(now time.Time) int64 { return now.Add(-model.BotEventMaxFailureDuration).UnixMilli() },
			status:         http.StatusInternalServerError,
			wantReason:     model.BotEventDisabledReasonDeliveryFailures,
			wantDMContains: "for more than 24 hours",
		},
		{
			name:           "410 disables at once",
			firstFailureAt: func(time.Time) int64 { return 0 },
			status:         http.StatusGone,
			wantReason:     model.BotEventDisabledReasonCallbackGone,
			wantDMContains: `responded "410 Gone"`,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			th := setupPushTest(t)
			rcv := testlib.NewBotEventReceiver(t, func(*http.Request, []byte) int { return tc.status })
			bot, botUser, _ := newPushTestBot(t, th, rcv.URL()+callbackPath)
			systemBot, appErr := th.App.GetSystemBot(th.Context) // created up front: the DM path would race this test to create it
			require.Nil(t, appErr)

			clock := newFakeBotEventClock()
			_, err := th.SQLStore.GetMaster().Exec("UPDATE BotEventSubscriptions SET ConsecutiveFailures = 5, FirstFailureAt = $1 WHERE BotUserId = $2", tc.firstFailureAt(clock.Now()), bot.UserId)
			require.NoError(t, err)
			seedBotEvents(t, th, bot.UserId, 1)

			newTestBotEventDispatcher(t, th, withClock(clock))
			require.Eventually(t, func() bool {
				sub := getTestSubscription(t, th, bot.UserId)
				return sub.ConsecutiveFailures == 6 && sub.LeaseNode == ""
			}, 5*time.Second, 5*time.Millisecond)

			sub := getTestSubscription(t, th, bot.UserId)
			assert.Equal(t, tc.wantEnabled, sub.Enabled)
			assert.Equal(t, tc.wantReason, sub.DisabledReason)

			dm, appErr := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, systemBot.UserId)
			require.Nil(t, appErr)

			var dms []*model.Post
			require.Eventually(t, func() bool {
				posts, appErr := th.App.GetPosts(th.Context, dm.Id, 0, 10)
				require.Nil(t, appErr)
				dms = nil
				for _, id := range posts.Order {
					dms = append(dms, posts.Posts[id])
				}
				return len(dms) >= 1 || tc.wantReason == ""
			}, 5*time.Second, 10*time.Millisecond)

			if tc.wantReason == "" {
				assert.Empty(t, dms)
				return
			}
			require.Len(t, dms, 1, "the owner is told exactly once")
			assert.Contains(t, dms[0].Message, "@"+bot.Username)
			assert.Contains(t, dms[0].Message, strings.TrimPrefix(rcv.URL(), "http://"))
			assert.Contains(t, dms[0].Message, tc.wantDMContains)
			assert.NotContains(t, dms[0].Message, callbackPath)

			postAs(t, th, th.BasicUser.Id, th.CreateDmChannel(t, botUser), "still produced", "")
			assert.Len(t, botEventsFor(t, th, bot.UserId), 2, "events keep accumulating after an automatic disable")
		})
	}
}

func TestBotEventDispatcherReEnableResumes(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupPushTest(t)

	var healthy atomic.Bool
	rcv := testlib.NewBotEventReceiver(t, func(*http.Request, []byte) int {
		if healthy.Load() {
			return http.StatusOK
		}
		return http.StatusInternalServerError
	})
	bot, botUser, _ := newPushTestBot(t, th, rcv.URL())
	seeded := seedBotEvents(t, th, bot.UserId, 3)

	_, err := th.SQLStore.GetMaster().Exec("UPDATE BotEventSubscriptions SET FirstFailureAt = $1 WHERE BotUserId = $2", time.Now().Add(-48*time.Hour).UnixMilli(), bot.UserId)
	require.NoError(t, err)
	newTestBotEventDispatcher(t, th)
	require.Eventually(t, func() bool { return !getTestSubscription(t, th, bot.UserId).Enabled }, 5*time.Second, 10*time.Millisecond)

	postAs(t, th, th.BasicUser.Id, th.CreateDmChannel(t, botUser), "while disabled", "")
	all := botEventsFor(t, th, bot.UserId)
	require.Len(t, all, 4)

	healthy.Store(true)
	sub, appErr := th.App.EnableBotEventSubscription(th.Context, bot.UserId)
	require.Nil(t, appErr)
	assert.Zero(t, sub.ConsecutiveFailures)
	assert.Empty(t, sub.DisabledReason)

	waitForAck(t, th, bot.UserId, all[3].Cursor())
	assert.Equal(t, append([]string{seeded[0].Id}, storedEventIDs(all)...), rcv.EventIDs(), "the failed event is retried, then all four arrive in order")
	assert.Zero(t, getTestSubscription(t, th, bot.UserId).FirstFailureAt)
}

func TestBotEventDispatcherAddressFilter(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("blocked unless allow-listed", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		rcv := testlib.NewBotEventReceiver(t, nil)
		bot := th.CreateBot(t)
		seedPushSubscription(t, th, bot.UserId, rcv.URL())
		events := seedBotEvents(t, th, bot.UserId, 1)

		_, _, appErr := th.App.CreateOrUpdateBotEventSubscription(th.Context, bot.UserId, &model.BotEventSubscriptionPatch{CallbackURL: new(rcv.URL() + "/other")})
		require.NotNil(t, appErr)
		assert.Equal(t, "app.bot_event_subscription.url_verification.address_forbidden.app_error", appErr.Id)

		newTestBotEventDispatcher(t, th, func(d *botEventDispatcher) { d.backoff = []time.Duration{0} })
		require.Eventually(t, func() bool { return getTestSubscription(t, th, bot.UserId).ConsecutiveFailures >= 2 }, 5*time.Second, 10*time.Millisecond)
		assert.Empty(t, rcv.Events())

		allowLocalReceivers(th, "127.0.0.1")
		waitForAck(t, th, bot.UserId, events[0].Cursor())
		assert.Len(t, rcv.Events(), 1)
	})

	t.Run("redirects are failures", func(t *testing.T) {
		th := setupPushTest(t)
		target := testlib.NewBotEventReceiver(t, nil)
		redirector := httptest.NewServer(http.RedirectHandler(target.URL(), http.StatusFound))
		t.Cleanup(redirector.Close)

		bot := th.CreateBot(t)
		seedPushSubscription(t, th, bot.UserId, redirector.URL)
		seedBotEvents(t, th, bot.UserId, 1)

		newTestBotEventDispatcher(t, th)
		require.Eventually(t, func() bool { return getTestSubscription(t, th, bot.UserId).ConsecutiveFailures >= 1 }, 5*time.Second, 10*time.Millisecond)
		assert.Empty(t, target.Events())
		assert.Equal(t, model.BotEventCursor{}, getTestSubscription(t, th, bot.UserId).AckCursor())
	})
}
