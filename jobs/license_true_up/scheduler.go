// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package license_true_up

import (
	"strconv"
	"time"

	"github.com/mattermost/mattermost-server/v6/jobs"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/services/telemetry"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

const scheduleFrequency = time.Hour * 24

func MakeScheduler(jobServer *jobs.JobServer, license *model.License, telemetryService *telemetry.TelemetryService) model.Scheduler {
	isEnabled := func(cfg *model.Config) bool {
		enabled := license != nil && !*license.Features.Cloud && !license.IsTrialLicense() && telemetryService.TelemetryEnabled()
		mlog.Debug("Scheduler: isEnabled: "+strconv.FormatBool(enabled), mlog.String("scheduler", model.JobTypeLicenseTrueUpReview))
		return enabled
	}
	return jobs.NewPeriodicScheduler(jobServer, model.JobTypeLicenseTrueUpReview, scheduleFrequency, isEnabled)
}
