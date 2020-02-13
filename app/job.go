// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/v5/model"
)

func (a *App) GetJob(id string) (*model.Job, *model.AppError) {
	return a.Srv.Store.Job().Get(id)
}

func (a *App) GetJobsPage(page int, perPage int) ([]*model.Job, *model.AppError) {
	return a.GetJobs(page*perPage, perPage)
}

func (a *App) GetJobs(offset int, limit int) ([]*model.Job, *model.AppError) {
	return a.Srv.Store.Job().GetAllPage(offset, limit)
}

func (a *App) GetJobsByTypePage(jobType string, page int, perPage int) ([]*model.Job, *model.AppError) {
	return a.GetJobsByType(jobType, page*perPage, perPage)
}

func (a *App) GetJobsByType(jobType string, offset int, limit int) ([]*model.Job, *model.AppError) {
	return a.Srv.Store.Job().GetAllByTypePage(jobType, offset, limit)
}

func (a *App) CreateJob(job *model.Job) (*model.Job, *model.AppError) {
	return a.Srv.Jobs.CreateJob(job.Type, job.Data)
}

func (a *App) CancelJob(jobId string) *model.AppError {
	return a.Srv.Jobs.RequestCancellation(jobId)
}
