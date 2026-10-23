// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package bot_events_cleanup

import (
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

const (
	workerName = "BotEventsCleanup"

	batchLimit           = 1000
	maxBatchesPerBot     = 100
	maxAgeBatches        = 1000
	subscriptionPageSize = 200
)

type Result struct {
	AckedDeleted   int64
	BacklogDropped int64
	AgedDeleted    int64
}

func MakeWorker(jobServer *jobs.JobServer) *jobs.SimpleWorker {
	isEnabled := func(_ *model.Config) bool {
		return true
	}

	execute := func(logger mlog.LoggerIFace, job *model.Job) error {
		defer jobServer.HandleJobPanic(logger, job)
		_, err := Cleanup(request.EmptyContext(logger), jobServer.Store, model.GetMillis())
		return err
	}

	return jobs.NewSimpleWorker(workerName, jobServer, execute, isEnabled)
}

// Cleanup deletes acknowledged events, trims backlogs past the cap, and ages out old
// events. Whenever unacknowledged events are dropped it advances the subscription's
// truncated cursor so that the next delivery reports backlog_truncated. Failures for a
// single bot are logged and skipped; only a failure to page subscriptions is returned.
func Cleanup(rctx request.CTX, ss store.Store, now int64) (Result, error) {
	var result Result

	after := ""
	for {
		subs, err := ss.BotEventSubscription().GetPage(rctx, after, subscriptionPageSize)
		if err != nil {
			return result, errors.Wrap(err, "failed to page bot event subscriptions")
		}
		if len(subs) == 0 {
			break
		}

		for _, sub := range subs {
			acked, dropped, err := cleanupBot(rctx, ss, sub)
			result.AckedDeleted += acked
			result.BacklogDropped += dropped
			if err != nil {
				rctx.Logger().Warn("Failed to clean up bot events", mlog.String("bot_user_id", sub.BotUserId), mlog.Err(err))
			}
		}
		after = subs[len(subs)-1].BotUserId
	}

	aged, err := deleteAged(rctx, ss, now)
	result.AgedDeleted = aged
	if err != nil {
		rctx.Logger().Warn("Failed to delete aged bot events", mlog.Err(err))
	}

	rctx.Logger().Info("Cleaned up bot events",
		mlog.Int("acked_deleted", result.AckedDeleted),
		mlog.Int("backlog_dropped", result.BacklogDropped),
		mlog.Int("aged_deleted", result.AgedDeleted),
	)

	return result, nil
}

func cleanupBot(rctx request.CTX, ss store.Store, sub *model.BotEventSubscription) (acked, dropped int64, err error) {
	acked, err = deleteUpTo(rctx, ss, sub.BotUserId, sub.AckCursor())
	if err != nil {
		return acked, 0, err
	}

	cutoff, err := ss.BotEvent().GetBacklogCutoff(rctx, sub.BotUserId, model.BotEventMaxBacklog)
	if err != nil || cutoff == nil {
		return acked, 0, err
	}

	dropped, err = deleteUpTo(rctx, ss, sub.BotUserId, *cutoff)
	if err != nil {
		return acked, dropped, err
	}
	if _, err = ss.BotEventSubscription().AdvanceTruncatedCursor(rctx, sub.BotUserId, *cutoff); err != nil {
		return acked, dropped, err
	}
	rctx.Logger().Info("Bot event backlog truncated", mlog.String("bot_user_id", sub.BotUserId), mlog.Int("dropped", dropped))

	return acked, dropped, nil
}

func deleteUpTo(rctx request.CTX, ss store.Store, botUserID string, cursor model.BotEventCursor) (int64, error) {
	var total int64
	for range maxBatchesPerBot {
		deleted, err := ss.BotEvent().DeleteUpToCursor(rctx, botUserID, cursor, batchLimit)
		total += deleted
		if err != nil {
			return total, err
		}
		if deleted < batchLimit {
			break
		}
	}
	return total, nil
}

func deleteAged(rctx request.CTX, ss store.Store, now int64) (int64, error) {
	cutoff := now - model.BotEventMaxEventAge.Milliseconds()

	var total int64
	for range maxAgeBatches {
		maxCursors, deleted, err := ss.BotEvent().DeleteOlderThan(rctx, cutoff, batchLimit)
		total += deleted
		if err != nil {
			return total, err
		}

		for botUserID, cursor := range maxCursors {
			advanced, err := ss.BotEventSubscription().AdvanceTruncatedCursor(rctx, botUserID, cursor)
			if err != nil {
				rctx.Logger().Warn("Failed to advance bot event truncated cursor", mlog.String("bot_user_id", botUserID), mlog.Err(err))
				continue
			}
			if advanced {
				rctx.Logger().Info("Bot events aged out", mlog.String("bot_user_id", botUserID))
			}
		}

		if deleted < batchLimit {
			break
		}
	}
	return total, nil
}
