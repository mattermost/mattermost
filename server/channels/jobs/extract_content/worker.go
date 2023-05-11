// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package extract_content

import (
	"strconv"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/mattermost/mattermost-server/server/public/shared/mlog"
	"github.com/mattermost/mattermost-server/server/v8/channels/jobs"
	"github.com/mattermost/mattermost-server/server/v8/channels/store"
)

var ignoredFiles = map[string]bool{
	"png": true, "jpg": true, "jpeg": true, "gif": true, "wmv": true,
	"mpg": true, "mpeg": true, "mp3": true, "mp4": true, "ogg": true,
	"ogv": true, "mov": true, "apk": true, "svg": true, "webm": true,
	"mkv": true,
}

const jobName = "ExtractContent"

type AppIface interface {
	ExtractContentFromFileInfo(fileInfo *model.FileInfo) error
}

func MakeWorker(jobServer *jobs.JobServer, app AppIface, store store.Store) model.Worker {
	isEnabled := func(cfg *model.Config) bool {
		return true
	}
	execute := func(job *model.Job) error {
		jobServer.HandleJobPanic(job)

		var err error
		var fromTS int64 = 0
		var toTS int64 = model.GetMillis()
		if fromStr, ok := job.Data["from"]; ok {
			if fromTS, err = strconv.ParseInt(fromStr, 10, 64); err != nil {
				return err
			}
			fromTS *= 1000
		}
		if toStr, ok := job.Data["to"]; ok {
			if toTS, err = strconv.ParseInt(toStr, 10, 64); err != nil {
				return err
			}
			toTS *= 1000
		}

		var nFiles int
		var nErrs int
		for {
			opts := model.GetFileInfosOptions{
				Since:          fromTS,
				SortBy:         model.FileinfoSortByCreated,
				IncludeDeleted: false,
			}
			fileInfos, err := store.FileInfo().GetWithOptions(0, 1000, &opts)
			if err != nil {
				return err
			}
			if len(fileInfos) == 0 {
				break
			}
			for _, fileInfo := range fileInfos {
				if !ignoredFiles[fileInfo.Extension] {
					mlog.Debug("extracting file", mlog.String("filename", fileInfo.Name), mlog.String("filepath", fileInfo.Path))
					err = app.ExtractContentFromFileInfo(fileInfo)
					if err != nil {
						mlog.Warn("Failed to extract file content", mlog.Err(err), mlog.String("file_info_id", fileInfo.Id))
						nErrs++
					}
					nFiles++
				}
			}
			lastFileInfo := fileInfos[len(fileInfos)-1]
			if lastFileInfo.CreateAt > toTS {
				break
			}
			fromTS = lastFileInfo.CreateAt + 1
		}

		job.Data["errors"] = strconv.Itoa(nErrs)
		job.Data["processed"] = strconv.Itoa(nFiles)

		if err := jobServer.UpdateInProgressJobData(job); err != nil {
			mlog.Error("Worker: Failed to update job data", mlog.String("worker", model.JobTypeExtractContent), mlog.String("job_id", job.Id), mlog.Err(err))
		}
		return nil
	}
	worker := jobs.NewSimpleWorker(jobName, jobServer, execute, isEnabled)
	return worker
}
