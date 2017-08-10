// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"github.com/mattermost/platform/jobs"
	"github.com/mattermost/platform/model"
)

func GetJob(id string) (*model.Job, *model.AppError) {
	if result := <-Srv.Store.Job().Get(id); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.Job), nil
	}
}

func GetJobsPage(page int, perPage int) ([]*model.Job, *model.AppError) {
	return GetJobs(page*perPage, perPage)
}

func GetJobs(offset int, limit int) ([]*model.Job, *model.AppError) {
	if result := <-Srv.Store.Job().GetAllPage(offset, limit); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.([]*model.Job), nil
	}
}

func GetJobsByTypePage(jobType string, page int, perPage int) ([]*model.Job, *model.AppError) {
	return GetJobsByType(jobType, page*perPage, perPage)
}

func GetJobsByType(jobType string, offset int, limit int) ([]*model.Job, *model.AppError) {
	if result := <-Srv.Store.Job().GetAllByTypePage(jobType, offset, limit); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.([]*model.Job), nil
	}
}

func CreateJob(job *model.Job) (*model.Job, *model.AppError) {
	return jobs.CreateJob(job.Type, job.Data)
}

func CancelJob(jobId string) *model.AppError {
	return jobs.RequestCancellation(jobId)
}
