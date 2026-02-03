// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package export_delete

import (
	"path/filepath"
	"strings"
	"time"

	"github.com/wiggin77/merror"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/configservice"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
)

type AppIface interface {
	configservice.ConfigService
	ListExportDirectory(path string) ([]string, *model.AppError)
	ExportFileModTime(path string) (time.Time, *model.AppError)
	RemoveExportFile(path string) *model.AppError
}

func MakeWorker(jobServer *jobs.JobServer, app AppIface) *jobs.SimpleWorker {
	const workerName = "ExportDelete"

	isEnabled := func(cfg *model.Config) bool {
		return *cfg.ExportSettings.Directory != "" && *cfg.ExportSettings.RetentionDays > 0
	}
	execute := func(logger mlog.LoggerIFace, job *model.Job) error {
		defer jobServer.HandleJobPanic(logger, job)

		exportPath := *app.Config().ExportSettings.Directory
		retentionTime := time.Duration(*app.Config().ExportSettings.RetentionDays) * 24 * time.Hour
		exports, appErr := app.ListExportDirectory(exportPath)
		if appErr != nil {
			return appErr
		}

		errors := merror.New()
		for i := range exports {
			filename := filepath.Base(exports[i])

			// Ignore files that were not created by the bulk export command
			if !strings.HasSuffix(filename, "_export.zip") {
				continue
			}

			modTime, appErr := app.ExportFileModTime(filepath.Join(exportPath, filename))
			if appErr != nil {
				logger.Debug("Worker: Failed to get file modification time",
					mlog.Err(appErr), mlog.String("export", exports[i]))
				errors.Append(appErr)
				continue
			}

			if time.Now().After(modTime.Add(retentionTime)) {
				// remove file data from storage.
				if appErr := app.RemoveExportFile(exports[i]); appErr != nil {
					logger.Debug("Worker: Failed to remove file",
						mlog.Err(appErr), mlog.String("export", exports[i]))
					errors.Append(appErr)
					continue
				}
			}
		}

		if err := errors.ErrorOrNil(); err != nil {
			logger.Warn("Worker: errors occurred", mlog.Err(err))
		}
		return nil
	}
	worker := jobs.NewSimpleWorker(workerName, jobServer, execute, isEnabled)
	return worker
}
