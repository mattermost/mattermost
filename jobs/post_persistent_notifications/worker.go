// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package post_persistent_notifications

import (
	"github.com/mattermost/mattermost-server/v6/jobs"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

const (
	JobName = "PostPersistentNotifications"
)

type AppIface interface {
	SendPersistentNotifications() error
	IsPersistentNotificationsEnabled() bool
}

func MakeWorker(jobServer *jobs.JobServer, license *model.License, app AppIface) model.Worker {
	isEnabled := func(_ *model.Config) bool {
		l := ""
		ls := ""
		if license != nil {
			l = license.SkuShortName
			ls = license.SkuName
		}
		e := license != nil && (license.SkuShortName == model.LicenseShortSkuProfessional || license.SkuShortName == model.LicenseShortSkuEnterprise)

		mlog.Info("Worker post_persistent_notifications", mlog.String("shortSKU", l), mlog.String("SKU", ls), mlog.Bool("enabled", e))
		return license != nil && (license.SkuShortName == model.LicenseShortSkuProfessional || license.SkuShortName == model.LicenseShortSkuEnterprise) && app.IsPersistentNotificationsEnabled()
	}
	execute := func(job *model.Job) error {
		defer jobServer.HandleJobPanic(job)

		mlog.Info("Executing worker post_persistent_notifications")
		return app.SendPersistentNotifications()
	}
	worker := jobs.NewSimpleWorker(JobName, jobServer, execute, isEnabled)
	return worker
}
