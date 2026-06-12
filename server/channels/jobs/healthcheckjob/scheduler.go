// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheckjob

import (
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
)

// evalInterval is the default evaluation cadence.
//
// TODO (WS8): make this configurable via a HealthCheckSettings.EvalInterval
// config field. 5 minutes gives near-real-time detection for stable
// (config-derived) rules while keeping DB probe costs reasonable.
const evalInterval = 5 * time.Minute

func MakeScheduler(jobServer *jobs.JobServer) *jobs.PeriodicScheduler {
	isEnabled := func(cfg *model.Config) bool {
		// Mirror the worker's isEnabled: run only when EnableDeveloper=true
		// until WS8 adds the proper feature flag.
		return cfg.ServiceSettings.EnableDeveloper != nil && *cfg.ServiceSettings.EnableDeveloper
	}
	return jobs.NewPeriodicScheduler(jobServer, model.JobTypeHealthCheck, evalInterval, isEnabled)
}
