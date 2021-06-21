// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package jobs

import "github.com/mattermost/mattermost-server/v5/model"

// DailyLicenseCheckJobInterface defines the interface for the job to check the license daily
type DailyLicenseCheckJobInterface interface {
	MakeWorker() model.Worker
	MakeScheduler() model.Scheduler
}
