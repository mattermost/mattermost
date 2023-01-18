// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package hosted_purchase_screening

import (
	"strconv"
	"time"

	"github.com/mattermost/mattermost-server/v6/jobs"
	"github.com/mattermost/mattermost-server/v6/model"
)

const (
	JobName = "LastAccessiblePost"
	// 3 days matches the expecation given in portal purchase flow.
	waitForScreeningDuration = 3 * 24 * time.Hour
)

type ScreenTimeStore interface {
	GetByName(string) (*model.System, error)
	PermanentDeleteByName(name string) (*model.System, error)
}

func MakeWorker(jobServer *jobs.JobServer, license *model.License, screenTimeStore ScreenTimeStore) model.Worker {
	isEnabled := func(_ *model.Config) bool {
		return license != nil && license.Features != nil && *license.Features.Cloud
	}
	execute := func(job *model.Job) error {
		defer jobServer.HandleJobPanic(job)

		now := time.Now()
		screenTimeValue, err := screenTimeStore.GetByName(model.SystemHostedPurchaseNeedsScreening)
		if err != nil {
			return err
		}
		screenTime, err := strconv.ParseInt(screenTimeValue.Value, 10, 64)
		if err != nil {
			return err
		}

		if now.After(time.UnixMilli(screenTime).Add(waitForScreeningDuration)) {
			screenTimeStore.PermanentDeleteByName(model.SystemHostedPurchaseNeedsScreening)
		}
		return nil
	}
	worker := jobs.NewSimpleWorker(JobName, jobServer, execute, isEnabled)
	return worker
}
