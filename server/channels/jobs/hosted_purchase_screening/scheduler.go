// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package hosted_purchase_screening

import (
	"time"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/mattermost/mattermost-server/server/v8/channels/jobs"
)

const schedFreq = 24 * time.Hour

func MakeScheduler(jobServer *jobs.JobServer, license *model.License) model.Scheduler {
	isEnabled := func(cfg *model.Config) bool {
		return model.BuildEnterpriseReady == "true" && license == nil
	}
	return jobs.NewPeriodicScheduler(jobServer, model.JobTypeHostedPurchaseScreening, schedFreq, isEnabled)
}
