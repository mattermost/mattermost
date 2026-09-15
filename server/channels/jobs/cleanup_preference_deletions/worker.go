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

	// A client offline longer than this window may miss tombstones on its next delta sync.
	PreferenceDeletionsRetentionDays = 30

	batchLimit = 1000
	maxBatches = 1000
)

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
