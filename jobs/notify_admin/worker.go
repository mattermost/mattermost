// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package notify_admin

import (
	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/jobs"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

const (
	UpgradeNotifyJobName = "UpgradeNotifyAdmin"
	TrialNotifyJobName   = "TrialNotifyAdmin"
)

type AppIface interface {
	DoCheckForAdminNotifications(c request.CTX, trial bool) *model.AppError
	Log() *mlog.Logger
}

func MakeUpgradeNotifyWorker(jobServer *jobs.JobServer, license *model.License, app AppIface) model.Worker {
	isEnabled := func(_ *model.Config) bool {
		return license != nil && license.Features != nil && *license.Features.Cloud
	}
	execute := func(_ *model.Job) error {
		appErr := app.DoCheckForAdminNotifications(request.EmptyContext(app.Log()), false)
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
	execute := func(_ *model.Job) error {
		appErr := app.DoCheckForAdminNotifications(request.EmptyContext(app.Log()), true)
		if appErr != nil {
			return appErr
		}

		return nil
	}
	worker := jobs.NewSimpleWorker(TrialNotifyJobName, jobServer, execute, isEnabled)
	return worker
}
