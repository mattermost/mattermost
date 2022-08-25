package notify_admin

import (
	"github.com/mattermost/mattermost-server/v6/jobs"
	"github.com/mattermost/mattermost-server/v6/model"
)

const (
	JobName = "NotifyAdmin"
)

type AppIface interface {
	DoCheckForAdminNotifications(trial bool) *model.AppError
}

func MakeWorker(jobServer *jobs.JobServer, license *model.License, app AppIface) model.Worker {
	isEnabled := func(_ *model.Config) bool {
		return license != nil && license.Features != nil && *license.Features.Cloud
	}
	execute := func(_ *model.Job) error {
		appErr := app.DoCheckForAdminNotifications(false)
		if appErr != nil {
			return appErr
		}

		return nil
	}
	worker := jobs.NewSimpleWorker(JobName, jobServer, execute, isEnabled)
	return worker
}
