// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package bot_events_cleanup

import (
	"errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

const (
	workerName = "BotEventsCleanup"

	batchLimit = 1000
	maxBatches = 1000
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

// Cleanup deletes acknowledged events and events older than the retention period. Both
// deletes always run; their errors are joined.
func Cleanup(rctx request.CTX, ss store.Store, now int64) (Result, error) {
	cutoff := now - model.BotEventMaxEventAge.Milliseconds()

	acked, ackedErr := drain(func() (int64, error) { return ss.BotEvent().DeleteAcked(rctx, batchLimit) })
	aged, agedErr := drain(func() (int64, error) { return ss.BotEvent().DeleteOlderThan(rctx, cutoff, batchLimit) })

	rctx.Logger().Info("Cleaned up bot events",
		mlog.Int("acked_deleted", acked),
		mlog.Int("aged_deleted", aged),
	)

	return Result{AckedDeleted: acked, AgedDeleted: aged}, errors.Join(ackedErr, agedErr)
}

// drain runs deleteBatch until it deletes less than a full batch, with an upper bound
// on the batches per run so a huge backlog is spread over several runs.
func drain(deleteBatch func() (int64, error)) (int64, error) {
	var total int64
	for range maxBatches {
		deleted, err := deleteBatch()
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
