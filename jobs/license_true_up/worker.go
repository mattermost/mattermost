// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package license_true_up

import (
	"time"

	"github.com/mattermost/mattermost-server/v6/jobs"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/services/telemetry"
	"github.com/mattermost/mattermost-server/v6/utils"
)

const (
	JobName = "LicenseTrueUpReview"
)

type AppIface interface {
	GetTrueUpProfile() (map[string]any, error)
}

func MakeWorker(jobServer *jobs.JobServer, license *model.License, app AppIface, telemetryService *telemetry.TelemetryService) model.Worker {
	isEnabled := func(_ *model.Config) bool {
		return license != nil && !*license.Features.Cloud && !license.IsTrialLicense() && telemetryService.TelemetryEnabled()
	}

	execute := func(job *model.Job) error {
		defer jobServer.HandleJobPanic(job)

		// Ensure we are within the due date
		dueDate := utils.GetNextTrueUpReviewDueDate(time.Now())
		if !utils.IsTrueUpReviewDueDateWithinTheNextTwoWeeks(time.Now(), dueDate) {
			return nil
		}
		profile, err := app.GetTrueUpProfile()
		if err != nil {
			return err
		}

		telemetryService.SendTelemetry(model.TrueUpReviewTelemetryName, profile)

		return nil
	}
	worker := jobs.NewSimpleWorker(JobName, jobServer, execute, isEnabled)
	return worker
}
