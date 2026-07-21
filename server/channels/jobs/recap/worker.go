// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package recap

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"golang.org/x/sync/errgroup"
	"golang.org/x/sync/semaphore"
)

type AppIface interface {
	ProcessRecapChannelWithOptions(rctx request.CTX, recapID, channelID, userID, agentID string, options model.RecapProcessingOptions) (*model.RecapChannelResult, *model.AppError)
	NewRecapPostBudgetForUser(userID string) (*model.RecapPostBudget, *model.AppError)
	Publish(message *model.WebSocketEvent)
}

const (
	// maxChannelWorkersPerJob caps how many channels a single recap job fans
	// out to concurrently. Cross-job LLM concurrency is capped separately by
	// the node-global semaphore sized from MaxConcurrentLLMCalls.
	maxChannelWorkersPerJob = 8

	// progressUpdateInterval throttles how often channel completions write job
	// progress to the database.
	progressUpdateInterval = time.Second
)

func MakeWorker(jobServer *jobs.JobServer, storeInstance store.Store, appInstance AppIface) *jobs.PoolWorker {
	isEnabled := func(cfg *model.Config) bool {
		return cfg.AIRecapsEnabled()
	}

	// One semaphore per node: MakeWorker runs once at server startup and every
	// recap job processed by this node's pool shares it. Sized once from
	// config; changing MaxConcurrentLLMCalls requires a server restart.
	llmSemaphore := semaphore.NewWeighted(int64(llmCallLimitFromConfig(jobServer.Config())))

	execute := func(logger mlog.LoggerIFace, job *model.Job) error {
		defer jobServer.HandleJobPanic(logger, job)
		return processRecapJob(logger, job, storeInstance, appInstance, llmSemaphore, func(progress int64) {
			_ = jobServer.SetJobProgress(job, progress)
		})
	}

	poolSize := func(cfg *model.Config) int {
		if cfg == nil {
			return model.RecapProcessingDefaultMaxConcurrentJobs
		}
		return cfg.AIRecapSettings.Processing.MaxConcurrentJobsOrDefault()
	}

	return jobs.NewPoolWorker("Recap", jobServer, execute, isEnabled, poolSize)
}

// llmCallLimitFromConfig returns the configured per-node cap on concurrent LLM
// channel-summarization calls, clamped to at least 1 (a zero-weight semaphore
// would block every job forever).
func llmCallLimitFromConfig(cfg *model.Config) int {
	limit := model.RecapProcessingDefaultMaxConcurrentLLMCalls
	if cfg != nil && cfg.AIRecapSettings.Processing != nil && cfg.AIRecapSettings.Processing.MaxConcurrentLLMCalls != nil {
		limit = *cfg.AIRecapSettings.Processing.MaxConcurrentLLMCalls
	}
	if limit < 1 {
		return 1
	}
	return limit
}

func processRecapJob(logger mlog.LoggerIFace, job *model.Job, storeInstance store.Store, appInstance AppIface, llmSemaphore *semaphore.Weighted, setProgress func(int64)) error {
	recapID := job.Data["recap_id"]
	userID := job.Data["user_id"]
	channelIDs := strings.Split(job.Data["channel_ids"], ",")
	agentID := job.Data["agent_id"]
	options := model.RecapProcessingOptions{
		TimePeriod:         job.Data["time_period"],
		CustomInstructions: job.Data["custom_instructions"],
	}

	logger.Info("Starting recap job",
		mlog.String("recap_id", recapID),
		mlog.String("agent_id", agentID),
		mlog.Int("channel_count", len(channelIDs)))

	// Update status to processing
	_ = storeInstance.Recap().UpdateRecapStatus(recapID, model.RecapStatusProcessing)
	publishRecapUpdate(appInstance, recapID, userID)

	// Job-local post budget: computed once so concurrent channels reserve from
	// a single atomic counter instead of racing per-channel DB recomputations.
	// On error, fall back to the per-channel DB path (nil budget) rather than
	// failing the whole job.
	budget, budgetErr := appInstance.NewRecapPostBudgetForUser(userID)
	if budgetErr != nil {
		logger.Warn("Failed to initialize recap post budget, falling back to per-channel limit checks",
			mlog.String("recap_id", recapID),
			mlog.Err(budgetErr))
		budget = nil
	}
	options.PostBudget = budget

	if setProgress != nil {
		setProgress(0)
	}

	// Fan out channel processing. Worker goroutines only send outcomes; the
	// collector goroutine exclusively owns the totals and the progress writes,
	// so no accumulator state is shared. The results channel is buffered to
	// the full channel count so a worker's send can never block.
	results := make(chan model.RecapChannelResult, len(channelIDs))

	totalMessages := 0
	successfulChannels := make([]string, 0, len(channelIDs))
	failedChannels := make([]string, 0, len(channelIDs))

	collectorDone := make(chan struct{})
	go func() {
		defer close(collectorDone)
		// 0% was already emitted before fan-out; only emit strictly larger
		// percentages so progress writes stay strictly monotonic.
		lastEmittedPercent := int64(0)
		var lastEmitAt time.Time
		for completed := 1; completed <= len(channelIDs); completed++ {
			outcome := <-results
			if outcome.Success {
				totalMessages += outcome.MessageCount
				successfulChannels = append(successfulChannels, outcome.ChannelID)
			} else {
				failedChannels = append(failedChannels, outcome.ChannelID)
			}

			// Monotonic, throttled progress: completed only grows, so percent
			// never regresses; DB writes are limited to integer-percent
			// increases at most once per progressUpdateInterval, except the
			// final completion which always flushes.
			percent := int64(completed*100) / int64(len(channelIDs))
			if setProgress != nil && percent > lastEmittedPercent &&
				(completed == len(channelIDs) || lastEmitAt.IsZero() || time.Since(lastEmitAt) >= progressUpdateInterval) {
				setProgress(percent)
				lastEmittedPercent = percent
				lastEmitAt = time.Now()
			}
		}
	}()

	g, gctx := errgroup.WithContext(context.Background())
	g.SetLimit(maxChannelWorkersPerJob)
	var panicOnce sync.Once
	var panicValue any
	for _, channelID := range channelIDs {
		g.Go(func() (workerErr error) {
			defer func() {
				if recovered := recover(); recovered != nil {
					panicOnce.Do(func() {
						panicValue = recovered
					})
					results <- model.RecapChannelResult{ChannelID: channelID}
					workerErr = fmt.Errorf("panic processing recap channel %s: %v", channelID, recovered)
				}
			}()

			// The node-global semaphore is held around the ENTIRE channel
			// processing call (DB reads + LLM call + save), capping in-flight
			// LLM work per node across all recap jobs. There is deliberately
			// no timeout here: the bridge API is not context-aware, and
			// abandoning a call would free the slot while the LLM request
			// keeps running, defeating the cap. Wedged-job recovery (phase 2)
			// bounds the user-facing blast radius of a hung call.
			if err := llmSemaphore.Acquire(gctx, 1); err != nil {
				logger.Warn("Failed to acquire LLM slot for channel",
					mlog.String("channel_id", channelID),
					mlog.Err(err))
				results <- model.RecapChannelResult{ChannelID: channelID}
				return nil
			}
			defer llmSemaphore.Release(1)

			// Fresh per-goroutine context with the user's session so
			// session-dependent code (e.g. auto-translation supplements)
			// works correctly.
			rctx := request.EmptyContext(logger).WithSession(&model.Session{UserId: userID})
			result, err := appInstance.ProcessRecapChannelWithOptions(rctx, recapID, channelID, userID, agentID, options)
			if err != nil {
				logger.Warn("Failed to process channel",
					mlog.String("channel_id", channelID),
					mlog.Err(err))
				results <- model.RecapChannelResult{ChannelID: channelID}
				return nil
			}
			if !result.Success {
				logger.Warn("Channel processing unsuccessful", mlog.String("channel_id", channelID))
				results <- model.RecapChannelResult{ChannelID: channelID}
				return nil
			}
			results <- model.RecapChannelResult{ChannelID: channelID, MessageCount: result.MessageCount, Success: true}
			return nil
		})
	}

	// Every worker sends before it returns, so the collector can finish its
	// fixed number of receives after the group has drained.
	_ = g.Wait()
	<-collectorDone
	if panicValue != nil {
		panic(panicValue)
	}

	// Update recap with final data (title is already set by user in CreateRecap)
	recap, err := storeInstance.Recap().GetRecap(recapID)
	if err != nil || recap == nil {
		logger.Warn("Recap no longer available while finalizing job",
			mlog.String("recap_id", recapID),
			mlog.Err(err))
		return nil
	}
	recap.TotalMessageCount = totalMessages
	recap.UpdateAt = model.GetMillis()

	if len(failedChannels) > 0 && len(successfulChannels) == 0 {
		recap.Status = model.RecapStatusFailed
		_, err := storeInstance.Recap().UpdateRecap(recap)
		if err != nil {
			logger.Error("Failed to update recap", mlog.Err(err))
			return fmt.Errorf("failed to update recap: %w", err)
		}
		publishRecapUpdate(appInstance, recapID, userID)
		return fmt.Errorf("all channels failed to process")
	} else if len(failedChannels) > 0 {
		recap.Status = model.RecapStatusCompleted
		_, err := storeInstance.Recap().UpdateRecap(recap)
		if err != nil {
			logger.Error("Failed to update recap", mlog.Err(err))
			return fmt.Errorf("failed to update recap: %w", err)
		}
		publishRecapUpdate(appInstance, recapID, userID)
		logger.Warn("Some channels failed", mlog.Int("failed_count", len(failedChannels)))
		// Job succeeds with warning
	} else {
		recap.Status = model.RecapStatusCompleted
		_, err := storeInstance.Recap().UpdateRecap(recap)
		if err != nil {
			logger.Error("Failed to update recap", mlog.Err(err))
			return fmt.Errorf("failed to update recap: %w", err)
		}
		publishRecapUpdate(appInstance, recapID, userID)
	}

	logger.Info("Recap job completed",
		mlog.String("recap_id", recapID),
		mlog.Int("successful_channels", len(successfulChannels)),
		mlog.Int("failed_channels", len(failedChannels)))

	return nil
}

func publishRecapUpdate(appInstance AppIface, recapID, userID string) {
	message := model.NewWebSocketEvent(model.WebsocketEventRecapUpdated, "", "", userID, nil, "")
	message.Add("recap_id", recapID)
	appInstance.Publish(message)
}
