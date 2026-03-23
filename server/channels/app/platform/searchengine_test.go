// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/platform/services/searchengine"
	searchenginemocks "github.com/mattermost/mattermost/server/v8/platform/services/searchengine/mocks"
)

// overrideWatcherTimings sets all watcher durations to fast values for testing
// and restores the originals when the test finishes.
func overrideWatcherTimings(t *testing.T) {
	t.Helper()

	origRetryInitial := searchEngineRetryInitial
	origRetryMax := searchEngineRetryMax
	origHealthInterval := searchEngineHealthInterval
	origHealthFailThreshold := searchEngineHealthFailThreshold
	origStopTimeout := searchEngineStopTimeout

	searchEngineRetryInitial = 10 * time.Millisecond
	searchEngineRetryMax = 50 * time.Millisecond
	searchEngineHealthInterval = 10 * time.Millisecond
	searchEngineHealthFailThreshold = 3
	searchEngineStopTimeout = 500 * time.Millisecond

	t.Cleanup(func() {
		searchEngineRetryInitial = origRetryInitial
		searchEngineRetryMax = origRetryMax
		searchEngineHealthInterval = origHealthInterval
		searchEngineHealthFailThreshold = origHealthFailThreshold
		searchEngineStopTimeout = origStopTimeout
	})
}

// setupWatcherTest creates a PlatformService with a mock search engine wired
// into the broker. Only GetName is pre-configured on the mock — each test sets
// up IsEnabled, IsActive, and other expectations explicitly.
func setupWatcherTest(t *testing.T) (*PlatformService, *searchenginemocks.SearchEngineInterface) {
	t.Helper()
	overrideWatcherTimings(t)

	th := SetupWithStoreMock(t)
	ps := th.Service

	engineMock := &searchenginemocks.SearchEngineInterface{}
	engineMock.On("GetName").Return("test-engine").Maybe()

	ps.SearchEngine = searchengine.NewBroker(ps.Config())
	ps.SearchEngine.ElasticsearchEngine = engineMock

	return ps, engineMock
}

func TestRunSearchEngineWatcher(t *testing.T) {
	t.Run("retries Start on failure then transitions to health phase", func(t *testing.T) {
		ps, engineMock := setupWatcherTest(t)

		engineMock.On("IsEnabled").Return(true).Maybe()

		// Start() fails twice, then succeeds on the third call.
		var startCalls int32
		engineMock.On("Start").Return(func() *model.AppError {
			n := atomic.AddInt32(&startCalls, 1)
			if n <= 2 {
				return model.NewAppError("test", "start_failed", nil, "", 500)
			}
			return nil
		})

		// After Start() succeeds, IsActive returns true so the watcher
		// transitions to the health phase.
		engineMock.On("IsActive").Return(func() bool {
			return atomic.LoadInt32(&startCalls) > 2
		})

		// Track whether HealthCheck is called — that confirms the
		// watcher entered the health phase.
		var healthChecked int32
		engineMock.On("HealthCheck", mock.Anything).Run(func(mock.Arguments) {
			atomic.StoreInt32(&healthChecked, 1)
		}).Return(nil).Maybe()

		ps.startSearchEngineWatcher()
		t.Cleanup(func() { ps.stopSearchEngineWatcher() })

		require.Eventually(t, func() bool {
			return atomic.LoadInt32(&healthChecked) == 1
		}, 2*time.Second, 5*time.Millisecond,
			"watcher should have transitioned to health phase after Start succeeds")
	})

	t.Run("exponential backoff with cap", func(t *testing.T) {
		ps, engineMock := setupWatcherTest(t)

		engineMock.On("IsEnabled").Return(true).Maybe()
		engineMock.On("IsActive").Return(false).Maybe()

		// Start() always fails — we record timestamps to observe backoff.
		var (
			startTimes   []time.Time
			startTimesMu sync.Mutex
		)
		engineMock.On("Start").Return(func() *model.AppError {
			startTimesMu.Lock()
			startTimes = append(startTimes, time.Now())
			startTimesMu.Unlock()
			return model.NewAppError("test", "start_failed", nil, "", 500)
		})

		ps.startSearchEngineWatcher()

		// Wait for several retries.
		require.Eventually(t, func() bool {
			startTimesMu.Lock()
			defer startTimesMu.Unlock()
			return len(startTimes) >= 5
		}, 2*time.Second, 5*time.Millisecond)

		ps.stopSearchEngineWatcher()

		// After stopSearchEngineWatcher returns, the watcher goroutine has
		// exited, so startTimes is safe to read without the lock.
		for i := 1; i < len(startTimes); i++ {
			gap := startTimes[i].Sub(startTimes[i-1])
			assert.LessOrEqual(t, gap.Milliseconds(), searchEngineRetryMax.Milliseconds()+50,
				"gap between retry %d and %d exceeds max: %v", i-1, i, gap)
		}
	})

	t.Run("exits when engine is disabled", func(t *testing.T) {
		ps, engineMock := setupWatcherTest(t)

		engineMock.On("IsActive").Return(false).Maybe()

		// Engine starts enabled, then becomes disabled after first Start() attempt.
		var startCalls int32
		engineMock.On("IsEnabled").Return(func() bool {
			return atomic.LoadInt32(&startCalls) == 0
		})
		engineMock.On("Start").Return(func() *model.AppError {
			atomic.AddInt32(&startCalls, 1)
			return model.NewAppError("test", "start_failed", nil, "", 500)
		}).Maybe()

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		stopped := make(chan struct{})
		notify := make(chan struct{}, 1)
		go ps.runSearchEngineWatcher(ctx, stopped, notify)

		// The watcher should park because IsEnabled() returns false.
		// Send a notify after a brief delay — the watcher should stay parked
		// since IsEnabled() is still false.
		time.Sleep(50 * time.Millisecond)

		// Cancel context to let the watcher exit.
		cancel()

		require.Eventually(t, func() bool {
			select {
			case <-stopped:
				return true
			default:
				return false
			}
		}, 2*time.Second, 5*time.Millisecond,
			"watcher did not exit after context cancellation")
	})

	t.Run("notify wakes watcher from park", func(t *testing.T) {
		ps, engineMock := setupWatcherTest(t)

		// Start disabled, then enable after a notify.
		var enabled int32
		engineMock.On("IsEnabled").Return(func() bool {
			return atomic.LoadInt32(&enabled) == 1
		})
		engineMock.On("IsActive").Return(false).Maybe()

		var started int32
		engineMock.On("Start").Return(func() *model.AppError {
			atomic.StoreInt32(&started, 1)
			return model.NewAppError("test", "start_failed", nil, "", 500)
		}).Maybe()

		ps.startSearchEngineWatcher()
		t.Cleanup(func() { ps.stopSearchEngineWatcher() })

		// Watcher should be parked (engine disabled).
		time.Sleep(50 * time.Millisecond)
		assert.Equal(t, int32(0), atomic.LoadInt32(&started), "Start should not be called when disabled")

		// Enable and notify.
		atomic.StoreInt32(&enabled, 1)
		ps.notifySearchEngineWatcher()

		// Watcher should wake up and try Start().
		require.Eventually(t, func() bool {
			return atomic.LoadInt32(&started) == 1
		}, 2*time.Second, 5*time.Millisecond,
			"watcher should have called Start after notify")
	})
}

func TestWatcherHealthPhase(t *testing.T) {
	t.Run("intermittent failures below threshold do not trigger Stop", func(t *testing.T) {
		ps, engineMock := setupWatcherTest(t)

		// Engine starts active.
		engineMock.On("IsEnabled").Return(true).Maybe()
		engineMock.On("IsActive").Return(true).Maybe()

		// HealthCheck alternates: fail, ok, fail, ok...
		// The consecutive failure counter resets on each success, so
		// the threshold is never reached and Stop() is never called.
		var healthCalls int32
		engineMock.On("HealthCheck", mock.Anything).Return(func(_ request.CTX) *model.AppError {
			n := atomic.AddInt32(&healthCalls, 1)
			if n%2 == 1 { // odd calls fail
				return model.NewAppError("test", "hc_fail", nil, "", 502)
			}
			return nil
		})

		ps.startSearchEngineWatcher()
		t.Cleanup(func() { ps.stopSearchEngineWatcher() })

		require.Eventually(t, func() bool {
			return atomic.LoadInt32(&healthCalls) >= 4
		}, 2*time.Second, 5*time.Millisecond)

		// Stop should never have been called — failures never reached threshold.
		engineMock.AssertNotCalled(t, "Stop")
	})

	t.Run("consecutive failures trigger Stop and retry", func(t *testing.T) {
		ps, engineMock := setupWatcherTest(t)

		engineMock.On("IsEnabled").Return(true).Maybe()

		// Engine starts active; becomes inactive after Stop().
		var stopped int32
		engineMock.On("IsActive").Return(func() bool {
			return atomic.LoadInt32(&stopped) == 0
		})

		// HealthCheck always fails — triggers Stop after 3 consecutive failures.
		engineMock.On("HealthCheck", mock.Anything).Return(
			model.NewAppError("test", "hc_fail", nil, "", 502),
		)

		// Stop() returns an error (simulates concurrent stop by config
		// listener). The watcher must tolerate this and still transition
		// to the retry phase.
		engineMock.On("Stop").Return(func() *model.AppError {
			atomic.StoreInt32(&stopped, 1)
			return model.NewAppError("test", "already_stopped", nil, "", 500)
		})

		// After transitioning to retry phase, Start() succeeds.
		var started int32
		engineMock.On("Start").Return(func() *model.AppError {
			atomic.StoreInt32(&started, 1)
			return nil
		}).Maybe()

		ps.startSearchEngineWatcher()
		t.Cleanup(func() { ps.stopSearchEngineWatcher() })

		// Watcher should have called Stop() then retried Start().
		require.Eventually(t, func() bool {
			return atomic.LoadInt32(&started) == 1
		}, 2*time.Second, 5*time.Millisecond,
			"watcher should have called Stop then retried Start")
	})
}

func TestStopSearchEngineWatcher(t *testing.T) {
	t.Run("exits immediately on stop signal during retry wait", func(t *testing.T) {
		ps, engineMock := setupWatcherTest(t)

		engineMock.On("IsEnabled").Return(true).Maybe()
		engineMock.On("IsActive").Return(false).Maybe()

		// Make retries slow so the watcher is sitting in a timer wait.
		searchEngineRetryInitial = 10 * time.Second

		engineMock.On("Start").Return(
			model.NewAppError("test", "start_failed", nil, "", 500),
		).Maybe()

		ps.startSearchEngineWatcher()

		// Should exit well before the 10s retry timer fires.
		start := time.Now()
		ps.stopSearchEngineWatcher()

		assert.Less(t, time.Since(start), 2*time.Second)
	})

	t.Run("idempotent", func(t *testing.T) {
		ps, engineMock := setupWatcherTest(t)

		engineMock.On("IsEnabled").Return(true).Maybe()
		engineMock.On("IsActive").Return(false).Maybe()

		// Not running — calling stop should be a no-op.
		require.NotPanics(t, ps.stopSearchEngineWatcher)
		require.NotPanics(t, ps.stopSearchEngineWatcher)

		engineMock.On("Start").Return(
			model.NewAppError("test", "start_failed", nil, "", 500),
		).Maybe()

		// Start, then stop twice — second stop should not panic.
		ps.startSearchEngineWatcher()
		ps.stopSearchEngineWatcher()
		require.NotPanics(t, ps.stopSearchEngineWatcher)
	})

	t.Run("returns after timeout when watcher is stuck in Start", func(t *testing.T) {
		ps, engineMock := setupWatcherTest(t)

		engineMock.On("IsEnabled").Return(true).Maybe()
		engineMock.On("IsActive").Return(false).Maybe()

		searchEngineStopTimeout = 100 * time.Millisecond

		// Start() blocks forever, simulating a hung connection.
		// enteredStart signals that the watcher is inside Start().
		blocked := make(chan struct{})
		enteredStart := make(chan struct{})
		engineMock.On("Start").Return(func() *model.AppError {
			close(enteredStart)
			<-blocked
			return nil
		})

		ps.startSearchEngineWatcher()

		// Wait until the watcher is actually stuck inside Start().
		<-enteredStart

		// Should return after the timeout, not hang forever.
		start := time.Now()
		ps.stopSearchEngineWatcher()
		elapsed := time.Since(start)

		assert.GreaterOrEqual(t, elapsed, 100*time.Millisecond)
		assert.Less(t, elapsed, 1*time.Second)

		// Unblock the goroutine so it can be cleaned up.
		close(blocked)
	})

	t.Run("start after timeout creates new watcher", func(t *testing.T) {
		ps, engineMock := setupWatcherTest(t)

		engineMock.On("IsEnabled").Return(true).Maybe()
		engineMock.On("IsActive").Return(false).Maybe()

		searchEngineStopTimeout = 50 * time.Millisecond

		// First watcher: Start() blocks forever.
		blocked := make(chan struct{})
		enteredStart := make(chan struct{}, 1)
		var startCalls int32
		engineMock.On("Start").Return(func() *model.AppError {
			n := atomic.AddInt32(&startCalls, 1)
			if n == 1 {
				enteredStart <- struct{}{}
				<-blocked
			}
			return model.NewAppError("test", "start_failed", nil, "", 500)
		})

		ps.startSearchEngineWatcher()
		<-enteredStart

		// Save the first goroutine's done channel before stop nils it.
		ps.searchEngineWatcherMut.Lock()
		firstDone := ps.searchEngineWatcherDone
		ps.searchEngineWatcherMut.Unlock()

		// Stop times out (watcher stuck in Start).
		ps.stopSearchEngineWatcher()

		// Start a new watcher — should work despite the abandoned goroutine.
		ps.startSearchEngineWatcher()

		// New watcher should call Start() (the second call).
		require.Eventually(t, func() bool {
			return atomic.LoadInt32(&startCalls) >= 2
		}, 2*time.Second, 5*time.Millisecond,
			"new watcher should have called Start")

		// Unblock the abandoned goroutine and wait for it to fully exit
		// before the test cleanup restores package-level timing vars.
		close(blocked)
		<-firstDone

		ps.stopSearchEngineWatcher()
	})
}

func TestNotifySearchEngineWatcher(t *testing.T) {
	t.Run("notify resets backoff and triggers immediate evaluation", func(t *testing.T) {
		ps, engineMock := setupWatcherTest(t)

		engineMock.On("IsEnabled").Return(true).Maybe()
		engineMock.On("IsActive").Return(false).Maybe()

		// Use a long retry so the watcher is in a backoff wait.
		searchEngineRetryInitial = 10 * time.Second

		var startCalls int32
		engineMock.On("Start").Return(func() *model.AppError {
			atomic.AddInt32(&startCalls, 1)
			return model.NewAppError("test", "start_failed", nil, "", 500)
		})

		ps.startSearchEngineWatcher()
		t.Cleanup(func() { ps.stopSearchEngineWatcher() })

		// Wait for first Start() call.
		require.Eventually(t, func() bool {
			return atomic.LoadInt32(&startCalls) >= 1
		}, 2*time.Second, 5*time.Millisecond)

		// Watcher is now in backoff (10s). Send notify to wake it.
		before := atomic.LoadInt32(&startCalls)
		ps.notifySearchEngineWatcher()

		// Start should be called again quickly (not after 10s).
		require.Eventually(t, func() bool {
			return atomic.LoadInt32(&startCalls) > before
		}, 1*time.Second, 5*time.Millisecond,
			"notify should have triggered an immediate Start retry")
	})

	t.Run("no-op when watcher is not running", func(t *testing.T) {
		ps, _ := setupWatcherTest(t)

		// Should not panic or block.
		require.NotPanics(t, func() {
			ps.notifySearchEngineWatcher()
		})
	})
}
