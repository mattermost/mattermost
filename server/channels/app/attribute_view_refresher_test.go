// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type fakeRefresherClock struct {
	mu  sync.Mutex
	now time.Time
}

func (c *fakeRefresherClock) Now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.now
}

func (c *fakeRefresherClock) advance(d time.Duration) {
	c.mu.Lock()
	c.now = c.now.Add(d)
	c.mu.Unlock()
}

type fakeRefreshCall struct {
	objectType string
	token      time.Time
	minGap     time.Duration
	at         time.Time
}

// fakeRefreshStore hands out the clock's time as tokens and answers refreshes from a script; with
// the script empty, every refresh succeeds.
type fakeRefreshStore struct {
	clock *fakeRefresherClock

	mu        sync.Mutex
	tokens    int
	tokenErrs []error
	calls     []fakeRefreshCall
	script    []fakeRefreshAnswer

	// block, when set, holds every refresh until it is closed; entered gets each objectType as
	// its refresh starts.
	block   chan struct{}
	entered chan string
}

type fakeRefreshAnswer struct {
	result store.AttributeViewRefreshResult
	err    error
}

func (s *fakeRefreshStore) GetAttributeRefreshToken(_ request.CTX) (time.Time, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.tokens++
	if len(s.tokenErrs) > 0 {
		err := s.tokenErrs[0]
		s.tokenErrs = s.tokenErrs[1:]
		if err != nil {
			return time.Time{}, err
		}
	}
	return s.clock.Now(), nil
}

func (s *fakeRefreshStore) RefreshAttributesIfStale(_ request.CTX, objectType string, token time.Time, minGap time.Duration) (store.AttributeViewRefreshResult, error) {
	if s.entered != nil {
		s.entered <- objectType
	}
	if s.block != nil {
		<-s.block
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.calls = append(s.calls, fakeRefreshCall{objectType: objectType, token: token, minGap: minGap, at: s.clock.Now()})
	if len(s.script) > 0 {
		answer := s.script[0]
		s.script = s.script[1:]
		return answer.result, answer.err
	}
	return store.AttributeViewRefreshResult{Outcome: store.AttributeViewRefreshRefreshed}, nil
}

func (s *fakeRefreshStore) refreshCalls() []fakeRefreshCall {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]fakeRefreshCall(nil), s.calls...)
}

type fakeRefreshMetrics struct {
	mu        sync.Mutex
	results   map[string]int
	staleness map[string]float64
}

func (m *fakeRefreshMetrics) IncrementAttributeViewRefresh(view, result string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.results[view+"/"+result]++
}

func (m *fakeRefreshMetrics) SetAttributeViewStaleness(view string, seconds float64) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.staleness[view] = seconds
}

func (m *fakeRefreshMetrics) result(view, result string) int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.results[view+"/"+result]
}

func (m *fakeRefreshMetrics) stale(view string) float64 {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.staleness[view]
}

type refresherHarness struct {
	r       *attributeViewRefresher
	clock   *fakeRefresherClock
	store   *fakeRefreshStore
	metrics *fakeRefreshMetrics
	enabled atomic.Bool
	never   chan struct{}
}

func newRefresherHarness(t *testing.T) *refresherHarness {
	h := &refresherHarness{
		clock:   &fakeRefresherClock{now: time.Date(2026, 11, 28, 10, 0, 0, 0, time.UTC)},
		metrics: &fakeRefreshMetrics{results: map[string]int{}, staleness: map[string]float64{}},
		never:   make(chan struct{}),
	}
	h.store = &fakeRefreshStore{clock: h.clock}
	h.enabled.Store(true)
	h.r = newAttributeViewRefresher(
		func() attributeViewRefreshStore { return h.store },
		func() attributeViewRefreshMetrics { return h.metrics },
		h.enabled.Load,
		h.clock,
		mlog.CreateTestLogger(t),
	)
	// Keep the gauge's wake-up out of the way of the due times the tests check.
	timings := defaultAttributeViewTimings
	timings.staleness = time.Hour
	h.r.setTimings(timings)
	return h
}

func (h *refresherHarness) step() time.Time { return h.r.step(h.never) }

func userCalls(calls []fakeRefreshCall) []fakeRefreshCall {
	var out []fakeRefreshCall
	for _, c := range calls {
		if c.objectType == model.PropertyFieldObjectTypeUser {
			out = append(out, c)
		}
	}
	return out
}

func TestAttributeViewRefresherDebounce(t *testing.T) {
	user := model.PropertyFieldObjectTypeUser

	t.Run("a burst of marks gives one refresh", func(t *testing.T) {
		h := newRefresherHarness(t)
		for range 1000 {
			h.r.mark(user)
			h.clock.advance(time.Millisecond)
			h.step()
		}
		require.Empty(t, h.store.refreshCalls(), "nothing is refreshed while the writes keep coming")

		h.clock.advance(attributeViewRefreshQuiet)
		require.True(t, h.step().IsZero(), "nothing is left to refresh")
		h.clock.advance(time.Minute)
		h.step()

		calls := h.store.refreshCalls()
		require.Len(t, calls, 1)
		require.Equal(t, user, calls[0].objectType)
		require.Equal(t, attributeViewRefreshMinGap, calls[0].minGap)
		require.Equal(t, 1, h.metrics.result(user, "refreshed"))
		require.Zero(t, h.metrics.stale(user))
	})

	t.Run("a steady stream of marks refreshes at the maximum wait", func(t *testing.T) {
		h := newRefresherHarness(t)
		start := h.clock.Now()
		for elapsed := time.Duration(0); elapsed <= 25*time.Second; elapsed += 500 * time.Millisecond {
			h.r.mark(user)
			h.step()
			h.clock.advance(500 * time.Millisecond)
		}

		calls := h.store.refreshCalls()
		require.Len(t, calls, 2)
		require.Equal(t, start.Add(10*time.Second), calls[0].at, "10 s after the first mark")
		require.Equal(t, start.Add(20500*time.Millisecond), calls[1].at, "10 s after the first mark the first refresh didn't take")
		require.Greater(t, h.metrics.stale(user), 0.0, "the marks since the last refresh are stale")
	})

	t.Run("busy and gap retry with the original token", func(t *testing.T) {
		h := newRefresherHarness(t)
		h.store.script = []fakeRefreshAnswer{
			{result: store.AttributeViewRefreshResult{Outcome: store.AttributeViewRefreshBusy}},
			{result: store.AttributeViewRefreshResult{Outcome: store.AttributeViewRefreshGap, RetryAfter: 3 * time.Second}},
		}

		h.r.mark(user)
		h.clock.advance(attributeViewRefreshQuiet)
		next := h.step()
		require.Equal(t, h.clock.Now().Add(attributeViewRefreshBusyRetry), next, "busy retries shortly")
		token := h.store.refreshCalls()[0].token

		// A write after the token debounces on its own; it doesn't replace the token.
		h.r.mark(user)
		h.clock.advance(attributeViewRefreshBusyRetry)
		next = h.step()
		require.Equal(t, h.clock.Now().Add(3*time.Second), next, "gap retries once the gap has passed")

		h.clock.advance(3 * time.Second)
		h.step()

		calls := userCalls(h.store.refreshCalls())
		require.GreaterOrEqual(t, len(calls), 3)
		for _, c := range calls[:3] {
			require.Equal(t, token, c.token, "every retry keeps the token taken first")
		}
		require.Equal(t, 1, h.metrics.result(user, "busy"))
		require.Equal(t, 1, h.metrics.result(user, "gap"))
		require.Equal(t, 1, h.metrics.result(user, "refreshed"))

		// The later write now gets a token of its own.
		h.clock.advance(time.Minute)
		h.step()
		calls = userCalls(h.store.refreshCalls())
		require.Len(t, calls, 4)
		require.True(t, calls[3].token.After(token))
	})

	t.Run("a failure backs off, doubling, and a success resets it", func(t *testing.T) {
		h := newRefresherHarness(t)
		boom := errors.New("boom")
		h.store.script = []fakeRefreshAnswer{{err: boom}, {err: boom}, {err: boom}}

		h.r.mark(user)
		h.clock.advance(attributeViewRefreshQuiet)
		require.Equal(t, h.clock.Now().Add(10*time.Second), h.step())

		h.clock.advance(5 * time.Second)
		h.step()
		require.Len(t, h.store.refreshCalls(), 1, "nothing is retried before the backoff")

		h.clock.advance(5 * time.Second)
		require.Equal(t, h.clock.Now().Add(20*time.Second), h.step())
		h.clock.advance(20 * time.Second)
		require.Equal(t, h.clock.Now().Add(40*time.Second), h.step())
		h.clock.advance(40 * time.Second)
		require.True(t, h.step().IsZero(), "the fourth try succeeds")

		calls := h.store.refreshCalls()
		require.Len(t, calls, 4)
		for _, c := range calls {
			require.Equal(t, calls[0].token, c.token, "a failure keeps the token")
		}
		require.Equal(t, 3, h.metrics.result(user, "failed"))

		// After the success the backoff starts over.
		h.store.script = []fakeRefreshAnswer{{err: boom}}
		h.r.mark(user)
		h.clock.advance(attributeViewRefreshQuiet)
		require.Equal(t, h.clock.Now().Add(10*time.Second), h.step())
	})

	t.Run("the backoff is capped", func(t *testing.T) {
		h := newRefresherHarness(t)
		for range 11 {
			h.store.script = append(h.store.script, fakeRefreshAnswer{err: errors.New("boom")})
		}
		h.r.mark(user)
		h.clock.advance(attributeViewRefreshQuiet)
		var next time.Time
		for range 10 {
			next = h.step()
			h.clock.advance(next.Sub(h.clock.Now()))
		}
		require.Equal(t, h.clock.Now().Add(attributeViewRefreshBackoffCap), h.step())
	})

	t.Run("a failed token keeps the marks and backs off", func(t *testing.T) {
		h := newRefresherHarness(t)
		h.store.tokenErrs = []error{errors.New("boom")}
		h.r.mark(user)
		h.clock.advance(attributeViewRefreshQuiet)
		require.Equal(t, h.clock.Now().Add(10*time.Second), h.step())
		require.Empty(t, h.store.refreshCalls())

		h.clock.advance(10 * time.Second)
		h.step()
		require.Len(t, h.store.refreshCalls(), 1)
	})

	t.Run("ABAC off drops marks, and turning it on marks every view", func(t *testing.T) {
		h := newRefresherHarness(t)
		h.enabled.Store(false)
		h.r.mark(user)
		h.clock.advance(time.Minute)
		h.step()
		require.Empty(t, h.store.refreshCalls())

		// Marks pending when ABAC is turned off are dropped too.
		h.enabled.Store(true)
		h.r.mark(user)
		h.enabled.Store(false)
		h.clock.advance(time.Minute)
		h.step()
		h.enabled.Store(true)
		h.step()
		require.Empty(t, h.store.refreshCalls())
		require.Zero(t, h.metrics.stale(user))

		ch := &Channels{attributeViews: h.r}
		off := &model.Config{}
		off.SetDefaults()
		on := off.Clone()
		on.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		ch.markAttributeViewsOnABACEnable(on, on)
		h.clock.advance(time.Minute)
		h.step()
		require.Empty(t, h.store.refreshCalls(), "only the switch on marks the views")

		ch.markAttributeViewsOnABACEnable(off, on)
		h.clock.advance(attributeViewRefreshQuiet)
		h.step()
		calls := h.store.refreshCalls()
		require.Len(t, calls, 2)
		require.ElementsMatch(t, attributeViewObjectTypes, []string{calls[0].objectType, calls[1].objectType})
	})

	t.Run("types without a view are ignored", func(t *testing.T) {
		h := newRefresherHarness(t)
		h.r.mark(model.PropertyFieldObjectTypePost, model.PropertyFieldObjectTypeSystem, "")
		h.clock.advance(time.Minute)
		require.True(t, h.step().IsZero())
		require.Empty(t, h.store.refreshCalls())
	})
}

func TestAttributeViewRefresherShutdown(t *testing.T) {
	h := newRefresherHarness(t)
	h.store.block = make(chan struct{})
	h.store.entered = make(chan string, 2)
	h.r.clock = systemClock{}
	h.store.clock = &fakeRefresherClock{now: time.Now()}
	h.r.setTimings(attributeViewTimings{
		quiet: time.Millisecond, maxWait: time.Millisecond, minGap: time.Millisecond,
		backoffInitial: time.Millisecond, backoffCap: time.Millisecond,
		busyRetry: time.Millisecond, staleness: time.Second,
	})

	h.r.start()
	h.r.markAll()

	var first string
	select {
	case first = <-h.store.entered:
	case <-time.After(10 * time.Second):
		require.FailNow(t, "no refresh started")
	}

	stopped := make(chan struct{})
	go func() {
		h.r.stopAndWait()
		close(stopped)
	}()

	select {
	case <-stopped:
		require.FailNow(t, "shutdown didn't wait for the refresh in flight")
	case <-time.After(100 * time.Millisecond):
	}

	close(h.store.block)
	select {
	case <-stopped:
	case <-time.After(10 * time.Second):
		require.FailNow(t, "shutdown didn't finish once the refresh did")
	}

	calls := h.store.refreshCalls()
	require.Len(t, calls, 1, "no refresh starts once shutdown has begun")
	require.Equal(t, first, calls[0].objectType)
	select {
	case second := <-h.store.entered:
		require.FailNow(t, "a second refresh started during shutdown", second)
	default:
	}
}
