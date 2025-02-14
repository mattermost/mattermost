// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package refresh_materialized_views

import (
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
)

func MakeScheduler(jobServer *jobs.JobServer, sqlDriverName string) *jobs.DailyScheduler {
	startTime := func(cfg *model.Config) *time.Time {
		parsedTime, err := time.Parse("15:04", *cfg.ServiceSettings.RefreshPostStatsRunTime)
		if err == nil {
			return &parsedTime
		}
		return nil
	}
	isEnabled := func(cfg *model.Config) bool {
		return sqlDriverName == model.DatabaseDriverPostgres
	}
	return jobs.NewDailyScheduler(jobServer, model.JobTypeRefreshMaterializedViews, startTime, isEnabled)
}
