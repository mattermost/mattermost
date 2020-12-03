// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

func (a *App) GetJob(id string) (*model.Job, *model.AppError) {
	job, err := a.Srv().Store.Job().Get(id)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetJob", "app.job.get.app_error", nil, nfErr.Error(), http.StatusNotFound)
		default:
			return nil, model.NewAppError("GetJob", "app.job.get.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	return job, nil
}

func (a *App) GetJobsPage(page int, perPage int) ([]*model.Job, *model.AppError) {
	return a.GetJobs(page*perPage, perPage)
}

func (a *App) GetJobs(offset int, limit int) ([]*model.Job, *model.AppError) {
	jobs, err := a.Srv().Store.Job().GetAllPage(offset, limit)
	if err != nil {
		return nil, model.NewAppError("GetJobs", "app.job.get_all.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return jobs, nil
}

func (a *App) GetJobsByTypePage(jobType string, page int, perPage int) ([]*model.Job, *model.AppError) {
	return a.GetJobsByType(jobType, page*perPage, perPage)
}

func (a *App) GetJobsByType(jobType string, offset int, limit int) ([]*model.Job, *model.AppError) {
	jobs, err := a.Srv().Store.Job().GetAllByTypePage(jobType, offset, limit)
	if err != nil {
		return nil, model.NewAppError("GetJobsByType", "app.job.get_all.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return jobs, nil
}

func (a *App) CreateJob(job *model.Job) (*model.Job, *model.AppError) {
	return a.Srv().Jobs.CreateJob(job.Type, job.Data)
}

func (a *App) CancelJob(jobId string) *model.AppError {
	return a.Srv().Jobs.RequestCancellation(jobId)
}
