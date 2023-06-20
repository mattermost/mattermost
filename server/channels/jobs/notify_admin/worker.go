// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package notify_admin

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
)

const (
	UpgradeNotifyJobName = "UpgradeNotifyAdmin"
	TrialNotifyJobName   = "TrialNotifyAdmin"
	InstallNotifyJobName = "InstallNotifyAdmin"
)

type AppIface interface {
	DoCheckForAdminNotifications(trial bool) *model.AppError
}

func MakeUpgradeNotifyWorker(jobServer *jobs.JobServer, license *model.License, app AppIface) model.Worker {
	isEnabled := func(_ *model.Config) bool {
		return license != nil && license.Features != nil && *license.Features.Cloud
	}
	execute := func(job *model.Job) error {
		defer jobServer.HandleJobPanic(job)

		appErr := app.DoCheckForAdminNotifications(false)
		if appErr != nil {
			return appErr
		}

		return nil
	}
	worker := jobs.NewSimpleWorker(UpgradeNotifyJobName, jobServer, execute, isEnabled)
	return worker
}

func MakeTrialNotifyWorker(jobServer *jobs.JobServer, license *model.License, app AppIface) model.Worker {
	isEnabled := func(_ *model.Config) bool {
		return license != nil && license.Features != nil && *license.Features.Cloud
	}
	execute := func(job *model.Job) error {
		defer jobServer.HandleJobPanic(job)

		appErr := app.DoCheckForAdminNotifications(true)
		if appErr != nil {
			return appErr
		}

		return nil
	}
	worker := jobs.NewSimpleWorker(TrialNotifyJobName, jobServer, execute, isEnabled)
	return worker
}

func MakeInstallPluginNotifyWorker(jobServer *jobs.JobServer, app AppIface) model.Worker {
	isEnabled := func(_ *model.Config) bool {
		return true
	}
	execute := func(job *model.Job) error {
		defer jobServer.HandleJobPanic(job)

		appErr := app.DoCheckForAdminNotifications(false)
		if appErr != nil {
			return appErr
		}

		return nil
	}
	worker := jobs.NewSimpleWorker(InstallNotifyJobName, jobServer, execute, isEnabled)
	return worker
}
