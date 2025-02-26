// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package import_delete

import (
	"errors"
	"path/filepath"
	"time"

	"github.com/wiggin77/merror"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/configservice"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type AppIface interface {
	configservice.ConfigService
	ListDirectory(path string) ([]string, *model.AppError)
	FileModTime(path string) (time.Time, *model.AppError)
	RemoveFile(path string) *model.AppError
}

func MakeWorker(jobServer *jobs.JobServer, app AppIface, s store.Store) *jobs.SimpleWorker {
	const workerName = "ImportDelete"

	isEnabled := func(cfg *model.Config) bool {
		return *cfg.ImportSettings.Directory != "" && *cfg.ImportSettings.RetentionDays > 0
	}
	execute := func(logger mlog.LoggerIFace, job *model.Job) error {
		defer jobServer.HandleJobPanic(logger, job)

		rctx := request.EmptyContext(logger)

		importPath := *app.Config().ImportSettings.Directory
		retentionTime := time.Duration(*app.Config().ImportSettings.RetentionDays) * 24 * time.Hour
		imports, appErr := app.ListDirectory(importPath)
		if appErr != nil {
			return appErr
		}

		multipleErrors := merror.New()
		for i := range imports {
			filename := filepath.Base(imports[i])
			modTime, appErr := app.FileModTime(filepath.Join(importPath, filename))
			if appErr != nil {
				logger.Debug("Worker: Failed to get file modification time",
					mlog.Err(appErr), mlog.String("import", imports[i]))
				multipleErrors.Append(appErr)
				continue
			}

			if time.Now().After(modTime.Add(retentionTime)) {
				// expected format if uploaded through the API is
				// ${uploadID}_${filename}${model.IncompleteUploadSuffix}
				minLen := 26 + 1 + len(model.IncompleteUploadSuffix)

				// check if it's an incomplete upload and attempt to delete its session.
				if len(filename) > minLen && filepath.Ext(filename) == model.IncompleteUploadSuffix {
					uploadID := filename[:26]
					if storeErr := s.UploadSession().Delete(uploadID); storeErr != nil {
						logger.Debug("Worker: Failed to delete UploadSession",
							mlog.Err(storeErr), mlog.String("upload_id", uploadID))
						multipleErrors.Append(storeErr)
						continue
					}
				} else {
					// check if fileinfo exists and if so delete it.
					filePath := filepath.Join(imports[i])
					info, storeErr := s.FileInfo().GetByPath(filePath)
					var nfErr *store.ErrNotFound
					if storeErr != nil && !errors.As(storeErr, &nfErr) {
						logger.Debug("Worker: Failed to get FileInfo",
							mlog.Err(storeErr), mlog.String("path", filePath))
						multipleErrors.Append(storeErr)
						continue
					} else if storeErr == nil {
						if storeErr = s.FileInfo().PermanentDelete(rctx, info.Id); storeErr != nil {
							logger.Debug("Worker: Failed to delete FileInfo",
								mlog.Err(storeErr), mlog.String("file_id", info.Id))
							multipleErrors.Append(storeErr)
							continue
						}
					}
				}

				// remove file data from storage.
				if appErr := app.RemoveFile(imports[i]); appErr != nil {
					logger.Debug("Worker: Failed to remove file",
						mlog.Err(appErr), mlog.String("import", imports[i]))
					multipleErrors.Append(appErr)
					continue
				}
			}
		}

		if err := multipleErrors.ErrorOrNil(); err != nil {
			logger.Warn("Worker: errors occurred", mlog.Err(err))
		}
		return nil
	}
	worker := jobs.NewSimpleWorker(workerName, jobServer, execute, isEnabled)
	return worker
}
