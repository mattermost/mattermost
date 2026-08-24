// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cleanup_preference_deletions

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
)

const (
	workerName = "CleanupPreferenceDeletions"

	// PreferenceDeletionsRetentionDays is the number of days tombstones are kept.
	// A client that has been offline longer than this window may miss some
	// preference tombstones on the next delta sync, but this is an acceptable
	// trade-off for bounding table growth.
	PreferenceDeletionsRetentionDays = 30

	// batchLimit bounds each delete so a large backlog doesn't hold one
	// unbounded transaction.
	batchLimit = 1000
	// maxBatches caps iterations per run so a very large backlog drains
	// across multiple scheduled runs rather than one unbounded loop.
	maxBatches = 1000
)

// preferenceDeletionsStore is the subset of PreferenceStore used by the
// worker, defined here so the batching logic can be unit-tested with a fake.
type preferenceDeletionsStore interface {
	DeletePreferenceDeletionsBefore(cutoff int64, limit int) (int64, error)
}

func MakeWorker(jobServer *jobs.JobServer) *jobs.SimpleWorker {
	isEnabled := func(_ *model.Config) bool { return true }

	execute := func(logger mlog.LoggerIFace, job *model.Job) error {
		defer jobServer.HandleJobPanic(logger, job)

		cutoff := model.GetMillis() - int64(PreferenceDeletionsRetentionDays)*24*60*60*1000
		return cleanupPreferenceDeletions(logger, jobServer.Store.Preference(), cutoff, batchLimit, maxBatches)
	}

	return jobs.NewSimpleWorker(workerName, jobServer, execute, isEnabled)
}

// cleanupPreferenceDeletions drains preference-deletion tombstones older than
// cutoff in batches up to maxIter iterations, extracted from MakeWorker so
// the batching logic can be exercised by unit tests with a fake store.
func cleanupPreferenceDeletions(logger mlog.LoggerIFace, store preferenceDeletionsStore, cutoff int64, limit, maxIter int) error {
	var totalDeleted int64

	for range maxIter {
		deleted, err := store.DeletePreferenceDeletionsBefore(cutoff, limit)
		if err != nil {
			return err
		}
		totalDeleted += deleted
		if deleted < int64(limit) {
			break
		}
	}

	logger.Info("Cleaned up old preference deletion tombstones",
		mlog.Int("retention_days", PreferenceDeletionsRetentionDays),
		mlog.Int("deleted", totalDeleted),
	)
	return nil
}
