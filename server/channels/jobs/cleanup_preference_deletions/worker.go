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
)

type preferenceStore interface {
	DeletePreferenceDeletionsBefore(cutoff int64) error
}

func MakeWorker(jobServer *jobs.JobServer) *jobs.SimpleWorker {
	isEnabled := func(_ *model.Config) bool { return true }

	execute := func(logger mlog.LoggerIFace, job *model.Job) error {
		defer jobServer.HandleJobPanic(logger, job)

		cutoff := model.GetMillis() - int64(PreferenceDeletionsRetentionDays)*24*60*60*1000
		if err := jobServer.Store.Preference().DeletePreferenceDeletionsBefore(cutoff); err != nil {
			return err
		}

		logger.Info("Cleaned up old preference deletion tombstones",
			mlog.Int("retention_days", PreferenceDeletionsRetentionDays),
		)
		return nil
	}

	return jobs.NewSimpleWorker(workerName, jobServer, execute, isEnabled)
}
