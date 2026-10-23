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
	AckedDeleted int64
	AgedDeleted  int64
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

// Cleanup deletes acknowledged events and events older than the retention period.
// Failures for a single bot are logged and skipped; only a failure to page
// subscriptions is returned.
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
			acked, err := deleteAcked(rctx, ss, sub)
			result.AckedDeleted += acked
			if err != nil {
				rctx.Logger().Warn("Failed to delete acknowledged bot events", mlog.String("bot_user_id", sub.BotUserId), mlog.Err(err))
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
		mlog.Int("aged_deleted", result.AgedDeleted),
	)

	return result, nil
}

func deleteAcked(rctx request.CTX, ss store.Store, sub *model.BotEventSubscription) (int64, error) {
	var total int64
	for range maxBatchesPerBot {
		deleted, err := ss.BotEvent().DeleteUpToCursor(rctx, sub.BotUserId, sub.AckCursor(), batchLimit)
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
		deleted, err := ss.BotEvent().DeleteOlderThan(rctx, cutoff, batchLimit)
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
