// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mobile_versions

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
)

func MakeWorker(jobServer *jobs.JobServer, store store.Store, getMetrics func() einterfaces.MetricsInterface) *jobs.SimpleWorker {
	const workerName = "MobileVersions"

	isEnabled := func(cfg *model.Config) bool {
		return *cfg.MetricsSettings.EnableClientMetrics
	}
	execute := func(logger mlog.LoggerIFace, job *model.Job) error {
		defer jobServer.HandleJobPanic(logger, job)

		metrics := getMetrics()
		if metrics == nil {
			return nil
		}

		versions, err := store.Session().GetMobileVersions()
		if err != nil {
			return err
		}

		metrics.ClearMobileClientVersions()
		for _, v := range versions {
			metrics.ObserveMobileClientVersions(v.Version, v.Platform, v.Count)
		}

		return nil
	}
	worker := jobs.NewSimpleWorker(workerName, jobServer, execute, isEnabled)
	return worker
}
