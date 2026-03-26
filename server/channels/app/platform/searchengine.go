// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"context"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// Watcher tuning knobs — declared as vars so tests can override them.
var (
	searchEngineRetryInitial        = 15 * time.Second
	searchEngineRetryMax            = 5 * time.Minute
	searchEngineHealthInterval      = 60 * time.Second
	searchEngineHealthFailThreshold = 3
	searchEngineStopTimeout         = 15 * time.Second
)

func (ps *PlatformService) StartSearchEngine() (string, string) {
	if ps.SearchEngine.ElasticsearchEngine != nil {
		ps.startSearchEngineWatcher()
	}

	configListenerId := ps.AddConfigListener(func(oldConfig *model.Config, newConfig *model.Config) {
		if ps.SearchEngine == nil {
			return
		}

		if err := ps.SearchEngine.UpdateConfig(newConfig); err != nil {
			ps.Log().Error("Failed to update search engine config", mlog.Err(err))
		}

		oldESCfg := oldConfig.ElasticsearchSettings
		newESCfg := newConfig.ElasticsearchSettings
		startingES := ps.SearchEngine.ElasticsearchEngine != nil &&
			!model.SafeDereference(oldESCfg.EnableIndexing) &&
			model.SafeDereference(newESCfg.EnableIndexing)
		stoppingES := ps.SearchEngine.ElasticsearchEngine != nil &&
			model.SafeDereference(oldESCfg.EnableIndexing) &&
			!model.SafeDereference(newESCfg.EnableIndexing)
		connectionChanged := ps.SearchEngine.ElasticsearchEngine != nil &&
			(model.SafeDereference(oldESCfg.ConnectionURL) != model.SafeDereference(newESCfg.ConnectionURL) ||
				model.SafeDereference(oldESCfg.Username) != model.SafeDereference(newESCfg.Username) ||
				model.SafeDereference(oldESCfg.Password) != model.SafeDereference(newESCfg.Password) ||
				model.SafeDereference(oldESCfg.Sniff) != model.SafeDereference(newESCfg.Sniff))
		startingBackfill := !model.SafeDereference(oldESCfg.EnableSearchPublicChannelsWithoutMembership) &&
			model.SafeDereference(newESCfg.EnableSearchPublicChannelsWithoutMembership)

		if startingES {
			// Engine wasn't running — just let the watcher start it.
			ps.notifySearchEngineWatcher()
		} else if connectionChanged || stoppingES {
			// Engine may be running — stop it first, then let watcher re-evaluate.
			ps.Go(func() {
				if err := ps.SearchEngine.ElasticsearchEngine.Stop(); err != nil {
					ps.Log().Warn(err.Error())
				}
				ps.notifySearchEngineWatcher()
			})
		}

		// Backfill was enabled but ES was already running (not starting fresh).
		if startingBackfill && !startingES {
			ps.Go(func() {
				engine := ps.SearchEngine.ElasticsearchEngine
				if engine == nil || !engine.IsActive() || !engine.IsIndexingEnabled() {
					ps.Log().Warn("Elasticsearch not available for channel_type backfill")
					return
				}
				ps.backfillPostsChannelType(engine)
			})
		}
	})

	licenseListenerId := ps.AddLicenseListener(func(oldLicense, newLicense *model.License) {
		if ps.SearchEngine == nil {
			return
		}
		if oldLicense == nil && newLicense != nil {
			// License added — watcher will try Start() on next evaluation.
			ps.notifySearchEngineWatcher()
		} else if oldLicense != nil && newLicense == nil {
			// License removed — stop engine. The watcher will retry Start()
			// which returns nil without a license, so it backs off gracefully.
			// When the license is re-added, the watcher picks it up.
			if ps.SearchEngine.ElasticsearchEngine != nil {
				ps.Go(func() {
					if err := ps.SearchEngine.ElasticsearchEngine.Stop(); err != nil {
						ps.Log().Warn(err.Error())
					}
					ps.notifySearchEngineWatcher()
				})
			}
		}
	})

	return configListenerId, licenseListenerId
}

func (ps *PlatformService) StopSearchEngine() {
	ps.stopSearchEngineWatcher()
	ps.RemoveConfigListener(ps.searchConfigListenerId)
	ps.RemoveLicenseListener(ps.searchLicenseListenerId)
	if ps.SearchEngine != nil && ps.SearchEngine.ElasticsearchEngine != nil && ps.SearchEngine.ElasticsearchEngine.IsActive() {
		if err := ps.SearchEngine.ElasticsearchEngine.Stop(); err != nil {
			ps.Log().Error("Failed to stop Elasticsearch engine", mlog.Err(err))
		}
	}
}

// startSearchEngineWatcher launches the background watcher goroutine if not
// already running. The watcher monitors engine health and retries Start() with
// exponential backoff when the engine is not active.
//
// It uses a raw goroutine (not ps.Go()) to manage its own lifecycle via context
// cancellation, which is eventually called from stopSearchEngineWatcher
//
// Idempotent: no-op if a watcher is already running.
func (ps *PlatformService) startSearchEngineWatcher() {
	ps.searchEngineWatcherMut.Lock()
	defer ps.searchEngineWatcherMut.Unlock()

	if ps.searchEngineWatcherCancel != nil {
		return // already running (possibly parked when disabled — still alive)
	}

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	notify := make(chan struct{}, 1)

	ps.searchEngineWatcherCancel = cancel
	ps.searchEngineWatcherDone = done
	ps.searchEngineWatcherNotify = notify

	go ps.runSearchEngineWatcher(ctx, done, notify)
}

// stopSearchEngineWatcher cancels the watcher's context and waits for it to
// exit with a bounded timeout. If the watcher does not stop in time (e.g.
// stuck in a long Start() call), the goroutine is abandoned and will
// self-terminate when its blocking call returns and it checks ctx.Err().
//
// The mutex is NOT held during the wait — only for field access.
func (ps *PlatformService) stopSearchEngineWatcher() {
	ps.searchEngineWatcherMut.Lock()
	cancel := ps.searchEngineWatcherCancel
	done := ps.searchEngineWatcherDone
	ps.searchEngineWatcherCancel = nil
	ps.searchEngineWatcherDone = nil
	ps.searchEngineWatcherNotify = nil
	ps.searchEngineWatcherMut.Unlock()

	if cancel == nil {
		return // not running
	}

	cancel()

	select {
	case <-done:
	case <-time.After(searchEngineStopTimeout):
		ps.Log().Warn("Search engine watcher did not stop in time; abandoning goroutine",
			mlog.Duration("timeout", searchEngineStopTimeout))
	}
}

// notifySearchEngineWatcher sends a non-blocking signal to the watcher to
// re-evaluate engine state immediately. If a signal is already pending, this
// is a no-op (the watcher will re-evaluate when it reads the existing one).
func (ps *PlatformService) notifySearchEngineWatcher() {
	ps.searchEngineWatcherMut.Lock()
	ch := ps.searchEngineWatcherNotify
	ps.searchEngineWatcherMut.Unlock()

	if ch != nil {
		select {
		case ch <- struct{}{}:
		default:
		}
	}
}

// runSearchEngineWatcher is the main loop of the watcher. It operates as a
// state machine driven by engine state:
//
//	(start)
//	   |
//	   v
//	IsEnabled()? --no--> PARK (wait for notify or cancel)
//	   |
//	  yes
//	   |
//	   v
//	IsActive()? --yes--> HEALTH CHECK (periodic)
//	   |                        |
//	  no                 N consecutive failures
//	   |                        |
//	   v                   Stop() engine
//	RETRY PHASE <---------------+
//	   |
//	   | wait (exponential backoff, interruptible by notify/cancel)
//	   v
//	Start()
//	   |--error--> backoff*2 (capped), retry
//	   |--ok-----> reset backoff, HEALTH CHECK
//
//	Any state -- ctx.Done() --> EXIT
//	Any state -- notify     --> immediate re-evaluation
func (ps *PlatformService) runSearchEngineWatcher(ctx context.Context, done chan struct{}, notify <-chan struct{}) {
	defer close(done)

	engine := ps.SearchEngine.ElasticsearchEngine
	if engine == nil {
		return
	}

	backoff := searchEngineRetryInitial
	consecutiveFailures := 0
	rctx := request.EmptyContext(ps.logger)

	// Timer starts at 0 for immediate first evaluation.
	timer := time.NewTimer(0)
	defer timer.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-notify:
			// Something changed (config, license, etc.) — re-evaluate immediately.
			timer.Reset(0)
			backoff = searchEngineRetryInitial
			consecutiveFailures = 0
			continue
		case <-timer.C:
		}

		// Prioritize shutdown: if select picked timer.C over ctx.Done()
		// (random when both are ready), exit now.
		if ctx.Err() != nil {
			return
		}

		// ── DISABLED: park until notified or cancelled ──
		if !engine.IsEnabled() {
			if engine.IsActive() {
				if err := engine.Stop(); err != nil {
					ps.Log().Warn("Search engine watcher: Stop() returned error while disabling",
						mlog.Err(err),
						mlog.String("engine", engine.GetName()))
				}
			}
			ps.Log().Info("Search engine watcher: engine disabled, parking")
			timer.Stop()
			continue
		}

		// ── INACTIVE: retry Start() ──
		if !engine.IsActive() {
			if err := engine.Start(ctx); err != nil {
				consecutiveFailures++
				ps.Log().Warn("Search engine watcher: Start() failed, will retry",
					mlog.Err(err),
					mlog.Int("consecutive_failures", consecutiveFailures),
					mlog.Duration("next_backoff", backoff),
					mlog.String("engine", engine.GetName()))
				timer.Reset(backoff)
				backoff = min(backoff*2, searchEngineRetryMax)
				continue
			}

			// Don't start new work during shutdown.
			if ctx.Err() != nil {
				return
			}

			// Start() returned nil but engine may not be active (e.g. no license).
			if !engine.IsActive() {
				consecutiveFailures++
				ps.Log().Warn("Search engine watcher: Start() returned no error but engine is not active, will retry",
					mlog.Int("consecutive_failures", consecutiveFailures),
					mlog.Duration("next_backoff", backoff),
					mlog.String("engine", engine.GetName()))
				timer.Reset(backoff)
				backoff = min(backoff*2, searchEngineRetryMax)
				continue
			}

			// Successfully started.
			ps.Log().Info("Search engine watcher: engine started successfully",
				mlog.String("engine", engine.GetName()))
			backoff = searchEngineRetryInitial
			consecutiveFailures = 0

			if model.SafeDereference(ps.Config().ElasticsearchSettings.EnableSearchPublicChannelsWithoutMembership) {
				ps.Go(func() {
					ps.backfillPostsChannelType(engine)
				})
			}

			timer.Reset(searchEngineHealthInterval)
			continue
		}

		// ── ACTIVE: health check ──
		if err := engine.HealthCheck(rctx); err != nil {
			consecutiveFailures++
			if consecutiveFailures >= searchEngineHealthFailThreshold {
				ps.Log().Error("Search engine health check failed repeatedly; stopping engine",
					mlog.Err(err),
					mlog.Int("consecutive_failures", consecutiveFailures),
					mlog.String("engine", engine.GetName()))

				if stopErr := engine.Stop(); stopErr != nil {
					ps.Log().Warn("Search engine watcher: Stop() returned error (may already be stopped)",
						mlog.Err(stopErr),
						mlog.String("engine", engine.GetName()))
				}
				consecutiveFailures = 0
				backoff = searchEngineRetryInitial
				timer.Reset(backoff)
				continue
			}

			ps.Log().Warn("Search engine health check failed",
				mlog.Err(err),
				mlog.Int("consecutive_failures", consecutiveFailures),
				mlog.Int("threshold", searchEngineHealthFailThreshold),
				mlog.String("engine", engine.GetName()))
		} else {
			consecutiveFailures = 0
		}

		// Both success and below-threshold failure re-check at the normal
		// interval. The critical-failure path (>= threshold) uses a different
		// timer value and continues before reaching this point.
		timer.Reset(searchEngineHealthInterval)
	}
}
