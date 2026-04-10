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
// into the broker and a ready-to-use watcher. Only GetName is pre-configured
// on the mock — each test sets up other expectations explicitly.
func setupWatcherTest(t *testing.T) (*searchEngineWatcher, *searchenginemocks.SearchEngineInterface) {
	t.Helper()
	overrideWatcherTimings(t)

	th := SetupWithStoreMock(t)
	ps := th.Service

	engineMock := &searchenginemocks.SearchEngineInterface{}
	engineMock.On("GetName").Return("test-engine").Maybe()

	ps.SearchEngine = searchengine.NewBroker(ps.Config())
	ps.SearchEngine.ElasticsearchEngine = engineMock

	w := newSearchEngineWatcher(ps)
	ps.esWatcher = w

	return w, engineMock
}

func TestRunSearchEngineWatcher(t *testing.T) {
	t.Run("retries Start on failure then transitions to health phase", func(t *testing.T) {
		w, engineMock := setupWatcherTest(t)

		engineMock.On("IsEnabled").Return(true).Maybe()

		// Start() fails twice, then succeeds on the third call.
		var startCalls atomic.Int32
		engineMock.On("Start", mock.Anything).Return(func(context.Context) *model.AppError {
			n := startCalls.Add(1)
			if n <= 2 {
				return model.NewAppError("test", "start_failed", nil, "", 500)
			}
			return nil
		})

		// After Start() succeeds, IsActive returns true so the watcher
		// transitions to the health phase.
		engineMock.On("IsActive").Return(func() bool {
			return startCalls.Load() > 2
		})

		// Track whether HealthCheck is called — that confirms the
		// watcher entered the health phase.
		var healthChecked atomic.Int32
		engineMock.On("HealthCheck", mock.Anything).Run(func(mock.Arguments) {
			healthChecked.Store(1)
		}).Return(nil).Maybe()

		// The engine will be active when the watcher exits, so the
		// cleanup defer in run() will call Stop().
		engineMock.On("Stop").Return(nil).Maybe()

		w.start()
		t.Cleanup(w.stop)

		require.Eventually(t, func() bool {
			return healthChecked.Load() == 1
		}, 2*time.Second, 5*time.Millisecond,
			"watcher should have transitioned to health phase after Start succeeds")
	})

	t.Run("exponential backoff with cap", func(t *testing.T) {
		w, engineMock := setupWatcherTest(t)

		engineMock.On("IsEnabled").Return(true).Maybe()
		engineMock.On("IsActive").Return(false).Maybe()

		// Start() always fails — we record timestamps to observe backoff.
		var (
			startTimes   []time.Time
			startTimesMu sync.Mutex
		)
		engineMock.On("Start", mock.Anything).Return(func(context.Context) *model.AppError {
			startTimesMu.Lock()
			startTimes = append(startTimes, time.Now())
			startTimesMu.Unlock()
			return model.NewAppError("test", "start_failed", nil, "", 500)
		})

		w.start()

		// Wait for several retries.
		require.Eventually(t, func() bool {
			startTimesMu.Lock()
			defer startTimesMu.Unlock()
			return len(startTimes) >= 5
		}, 2*time.Second, 5*time.Millisecond)

		w.stop()

		// After stop returns, the watcher goroutine has exited, so
		// startTimes is safe to read without the lock.
		for i := 1; i < len(startTimes); i++ {
			gap := startTimes[i].Sub(startTimes[i-1])
			assert.LessOrEqual(t, gap.Milliseconds(), searchEngineRetryMax.Milliseconds()+50,
				"gap between retry %d and %d exceeds max: %v", i-1, i, gap)
		}
	})

	t.Run("exits when engine is disabled", func(t *testing.T) {
		w, engineMock := setupWatcherTest(t)

		engineMock.On("IsActive").Return(false).Maybe()

		// Engine starts enabled, then becomes disabled after first Start() attempt.
		var startCalls atomic.Int32
		engineMock.On("IsEnabled").Return(func() bool {
			return startCalls.Load() == 0
		})
		engineMock.On("Start", mock.Anything).Return(func(context.Context) *model.AppError {
			startCalls.Add(1)
			return model.NewAppError("test", "start_failed", nil, "", 500)
		}).Maybe()

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		notifyCh := make(chan struct{}, 1)
		done := make(chan struct{})
		go func() {
			defer close(done)
			w.run(ctx, notifyCh)
		}()

		// The watcher should park because IsEnabled() returns false.
		time.Sleep(50 * time.Millisecond)

		// Cancel context to let the watcher exit.
		cancel()

		require.Eventually(t, func() bool {
			select {
			case <-done:
				return true
			default:
				return false
			}
		}, 2*time.Second, 5*time.Millisecond,
			"watcher did not exit after context cancellation")
	})

	t.Run("notify wakes watcher from park", func(t *testing.T) {
		w, engineMock := setupWatcherTest(t)

		// Start disabled, then enable after a notify.
		var enabled atomic.Int32
		engineMock.On("IsEnabled").Return(func() bool {
			return enabled.Load() == 1
		})
		engineMock.On("IsActive").Return(false).Maybe()

		var started atomic.Int32
		engineMock.On("Start", mock.Anything).Return(func(context.Context) *model.AppError {
			started.Store(1)
			return model.NewAppError("test", "start_failed", nil, "", 500)
		}).Maybe()

		w.start()
		t.Cleanup(w.stop)

		// Watcher should be parked (engine disabled).
		time.Sleep(50 * time.Millisecond)
		assert.Equal(t, int32(0), started.Load(), "Start should not be called when disabled")

		// Enable and notify.
		enabled.Store(1)
		w.reevaluate()

		// Watcher should wake up and try Start().
		require.Eventually(t, func() bool {
			return started.Load() == 1
		}, 2*time.Second, 5*time.Millisecond,
			"watcher should have called Start after notify")
	})

	t.Run("stops engine on exit when Start succeeds during shutdown", func(t *testing.T) {
		w, engineMock := setupWatcherTest(t)

		engineMock.On("IsEnabled").Return(true).Maybe()

		// Start() succeeds but the context is cancelled while it runs,
		// simulating the race where Start() completes just as stop() is
		// called. Without the safety-net defer in run(), the engine
		// would be left active with no goroutine to manage it.
		ctx, cancel := context.WithCancel(context.Background())
		notifyCh := make(chan struct{}, 1)

		engineMock.On("IsActive").Return(false).Once() // first check in startIfInactive
		engineMock.On("Start", mock.Anything).Run(func(mock.Arguments) {
			cancel() // simulate stop() racing with Start()
		}).Return(nil).Once()

		// After Start() returns nil, run() checks ctx.Err() != nil and
		// falls through to the defer, which sees the engine as active.
		engineMock.On("IsActive").Return(true).Once() // checked by the safety-net defer

		var stopped atomic.Int32
		engineMock.On("Stop").Run(func(mock.Arguments) {
			stopped.Add(1)
		}).Return(nil).Once()

		done := make(chan struct{})
		go func() {
			defer close(done)
			w.run(ctx, notifyCh)
		}()

		require.Eventually(t, func() bool {
			select {
			case <-done:
				return true
			default:
				return false
			}
		}, 2*time.Second, 5*time.Millisecond,
			"watcher did not exit after context cancellation")

		assert.Equal(t, int32(1), stopped.Load(),
			"safety net should have called Stop() exactly once on goroutine exit")
	})
}

func TestStartIfInactive(t *testing.T) {
	t.Run("parks when Start returns nil but no ES license", func(t *testing.T) {
		w, engineMock := setupWatcherTest(t)

		engineMock.On("IsEnabled").Return(true).Maybe()
		engineMock.On("IsActive").Return(false).Maybe()

		// Start() succeeds but engine stays inactive (no license).
		var startCalls atomic.Int32
		engineMock.On("Start", mock.Anything).Run(func(mock.Arguments) {
			startCalls.Add(1)
		}).Return(nil)

		// No license is set — the default for the test PlatformService.

		w.start()
		t.Cleanup(w.stop)

		// Wait for the first Start() call.
		require.Eventually(t, func() bool {
			return startCalls.Load() >= 1
		}, 2*time.Second, 5*time.Millisecond)

		// The watcher should park — no further Start() calls after the first one.
		time.Sleep(100 * time.Millisecond)
		assert.Equal(t, int32(1), startCalls.Load(),
			"watcher should park after one Start() call when there is no ES license")
		engineMock.AssertNotCalled(t, "HealthCheck", mock.Anything)
	})

	t.Run("retries when Start returns nil but engine not active with ES license", func(t *testing.T) {
		w, engineMock := setupWatcherTest(t)

		engineMock.On("IsEnabled").Return(true).Maybe()
		engineMock.On("IsActive").Return(false).Maybe()

		var startCalls atomic.Int32
		engineMock.On("Start", mock.Anything).Run(func(mock.Arguments) {
			startCalls.Add(1)
		}).Return(nil)

		// Set a license with Elasticsearch feature enabled.
		w.ps.licenseValue.Store(model.NewTestLicense("elastic_search"))

		w.start()
		t.Cleanup(w.stop)

		// The watcher should keep retrying because the license is present.
		require.Eventually(t, func() bool {
			return startCalls.Load() >= 3
		}, 2*time.Second, 5*time.Millisecond,
			"watcher should retry Start when it returns nil but engine is not active (with license)")
		engineMock.AssertNotCalled(t, "HealthCheck", mock.Anything)
	})
}

func TestWatcherHealthPhase(t *testing.T) {
	t.Run("intermittent failures below threshold do not trigger Stop", func(t *testing.T) {
		w, engineMock := setupWatcherTest(t)

		// Engine starts active.
		engineMock.On("IsEnabled").Return(true).Maybe()
		engineMock.On("IsActive").Return(true).Maybe()

		// The engine will be active when the watcher exits, so the
		// cleanup defer in run() will call Stop().
		engineMock.On("Stop").Return(nil).Maybe()

		// HealthCheck alternates: fail, ok, fail, ok...
		// The consecutive failure counter resets on each success, so
		// the threshold is never reached and Stop() is never called
		// by the health-check logic (only by the exit defer).
		var healthCalls atomic.Int32
		engineMock.On("HealthCheck", mock.Anything).Return(func(_ request.CTX) *model.AppError {
			n := healthCalls.Add(1)
			if n%2 == 1 { // odd calls fail
				return model.NewAppError("test", "hc_fail", nil, "", 502)
			}
			return nil
		})

		w.start()
		t.Cleanup(w.stop)

		require.Eventually(t, func() bool {
			return healthCalls.Load() >= 4
		}, 2*time.Second, 5*time.Millisecond)

		// Stop should not have been called by health-check logic —
		// failures never reached the threshold. (It will be called
		// once later by the cleanup defer in run().)
		engineMock.AssertNotCalled(t, "Stop")
	})

	t.Run("consecutive failures trigger Stop and retry", func(t *testing.T) {
		w, engineMock := setupWatcherTest(t)

		engineMock.On("IsEnabled").Return(true).Maybe()

		// Engine starts active; becomes inactive after Stop().
		var stopped atomic.Int32
		engineMock.On("IsActive").Return(func() bool {
			return stopped.Load() == 0
		})

		// HealthCheck always fails — triggers Stop after 3 consecutive failures.
		engineMock.On("HealthCheck", mock.Anything).Return(
			model.NewAppError("test", "hc_fail", nil, "", 502),
		)

		// Stop() returns an error (simulates concurrent stop by config
		// listener). The watcher must tolerate this and still transition
		// to the retry phase.
		engineMock.On("Stop").Return(func() *model.AppError {
			stopped.Store(1)
			return model.NewAppError("test", "already_stopped", nil, "", 500)
		})

		// After transitioning to retry phase, Start() succeeds.
		var started atomic.Int32
		engineMock.On("Start", mock.Anything).Return(func(context.Context) *model.AppError {
			started.Store(1)
			return nil
		}).Maybe()

		w.start()
		t.Cleanup(w.stop)

		// Watcher should have called Stop() then retried Start().
		require.Eventually(t, func() bool {
			return started.Load() == 1
		}, 2*time.Second, 5*time.Millisecond,
			"watcher should have called Stop then retried Start")
	})
}

func TestStopSearchEngineWatcher(t *testing.T) {
	t.Run("exits immediately on stop signal during retry wait", func(t *testing.T) {
		w, engineMock := setupWatcherTest(t)

		engineMock.On("IsEnabled").Return(true).Maybe()
		engineMock.On("IsActive").Return(false).Maybe()

		// Make retries slow so the watcher is sitting in a timer wait.
		searchEngineRetryInitial = 10 * time.Second

		engineMock.On("Start", mock.Anything).Return(
			model.NewAppError("test", "start_failed", nil, "", 500),
		).Maybe()

		w.start()

		// Should exit well before the 10s retry timer fires.
		start := time.Now()
		w.stop()

		assert.Less(t, time.Since(start), 2*time.Second)
	})

	t.Run("idempotent", func(t *testing.T) {
		w, engineMock := setupWatcherTest(t)

		engineMock.On("IsEnabled").Return(true).Maybe()
		engineMock.On("IsActive").Return(false).Maybe()

		// Not running — calling stop should be a no-op.
		require.NotPanics(t, w.stop)
		require.NotPanics(t, w.stop)

		engineMock.On("Start", mock.Anything).Return(
			model.NewAppError("test", "start_failed", nil, "", 500),
		).Maybe()

		// Start, then stop twice — second stop should not panic.
		w.start()
		w.stop()
		require.NotPanics(t, w.stop)
	})

	t.Run("returns after timeout when watcher is stuck in Start", func(t *testing.T) {
		w, engineMock := setupWatcherTest(t)

		engineMock.On("IsEnabled").Return(true).Maybe()
		engineMock.On("IsActive").Return(false).Maybe()

		searchEngineStopTimeout = 100 * time.Millisecond

		// Start() blocks forever, simulating a hung connection.
		blocked := make(chan struct{})
		enteredStart := make(chan struct{})
		engineMock.On("Start", mock.Anything).Return(func(context.Context) *model.AppError {
			close(enteredStart)
			<-blocked
			return nil
		})

		w.start()

		// Wait until the watcher is actually stuck inside Start().
		<-enteredStart

		// Should return after the timeout, not hang forever.
		start := time.Now()
		w.stop()
		elapsed := time.Since(start)

		assert.GreaterOrEqual(t, elapsed, 100*time.Millisecond)
		assert.Less(t, elapsed, 1*time.Second)

		// Unblock the goroutine so it can be cleaned up.
		close(blocked)
	})

	t.Run("start after timeout creates new watcher", func(t *testing.T) {
		w, engineMock := setupWatcherTest(t)

		engineMock.On("IsEnabled").Return(true).Maybe()
		engineMock.On("IsActive").Return(false).Maybe()

		searchEngineStopTimeout = 50 * time.Millisecond

		// First watcher: Start() blocks forever.
		blocked := make(chan struct{})
		enteredStart := make(chan struct{}, 1)
		var startCalls atomic.Int32
		engineMock.On("Start", mock.Anything).Return(func(context.Context) *model.AppError {
			n := startCalls.Add(1)
			if n == 1 {
				enteredStart <- struct{}{}
				<-blocked
			}
			return model.NewAppError("test", "start_failed", nil, "", 500)
		})

		w.start()
		<-enteredStart

		// Save the first goroutine's done channel before stop nils it.
		w.mu.Lock()
		firstDone := w.done
		w.mu.Unlock()

		// Stop times out (watcher stuck in Start).
		w.stop()

		// Start a new watcher — should work despite the abandoned goroutine.
		w.start()

		// New watcher should call Start() (the second call).
		require.Eventually(t, func() bool {
			return startCalls.Load() >= 2
		}, 2*time.Second, 5*time.Millisecond,
			"new watcher should have called Start")

		// Unblock the abandoned goroutine and wait for it to fully exit
		// before the test cleanup restores package-level timing vars.
		close(blocked)
		<-firstDone

		w.stop()
	})
}

func TestNotifySearchEngineWatcher(t *testing.T) {
	t.Run("notify resets backoff and triggers immediate evaluation", func(t *testing.T) {
		w, engineMock := setupWatcherTest(t)

		engineMock.On("IsEnabled").Return(true).Maybe()
		engineMock.On("IsActive").Return(false).Maybe()

		// Use a long retry so the watcher is in a backoff wait.
		searchEngineRetryInitial = 10 * time.Second

		var startCalls atomic.Int32
		engineMock.On("Start", mock.Anything).Return(func(context.Context) *model.AppError {
			startCalls.Add(1)
			return model.NewAppError("test", "start_failed", nil, "", 500)
		})

		w.start()
		t.Cleanup(w.stop)

		// Wait for first Start() call.
		require.Eventually(t, func() bool {
			return startCalls.Load() >= 1
		}, 2*time.Second, 5*time.Millisecond)

		// Watcher is now in backoff (10s). Send notify to wake it.
		before := startCalls.Load()
		w.reevaluate()

		// Start should be called again quickly (not after 10s).
		require.Eventually(t, func() bool {
			return startCalls.Load() > before
		}, 1*time.Second, 5*time.Millisecond,
			"notify should have triggered an immediate Start retry")
	})

	t.Run("no-op when watcher is not running", func(t *testing.T) {
		w, _ := setupWatcherTest(t)

		// Should not panic or block.
		require.NotPanics(t, func() {
			w.reevaluate()
		})
	})
}
