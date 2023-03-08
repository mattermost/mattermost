// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/server/channels/store"
)

func (a *App) GetJob(id string) (*model.Job, *model.AppError) {
	job, err := a.Srv().Store().Job().Get(id)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetJob", "app.job.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetJob", "app.job.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return job, nil
}

func (a *App) GetJobsPage(page int, perPage int) ([]*model.Job, *model.AppError) {
	return a.GetJobs(page*perPage, perPage)
}

func (a *App) GetJobs(offset int, limit int) ([]*model.Job, *model.AppError) {
	jobs, err := a.Srv().Store().Job().GetAllPage(offset, limit)
	if err != nil {
		return nil, model.NewAppError("GetJobs", "app.job.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return jobs, nil
}

func (a *App) GetJobsByTypePage(jobType string, page int, perPage int) ([]*model.Job, *model.AppError) {
	return a.GetJobsByType(jobType, page*perPage, perPage)
}

func (a *App) GetJobsByType(jobType string, offset int, limit int) ([]*model.Job, *model.AppError) {
	jobs, err := a.Srv().Store().Job().GetAllByTypePage(jobType, offset, limit)
	if err != nil {
		return nil, model.NewAppError("GetJobsByType", "app.job.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return jobs, nil
}

func (a *App) GetJobsByTypesPage(jobType []string, page int, perPage int) ([]*model.Job, *model.AppError) {
	return a.GetJobsByTypes(jobType, page*perPage, perPage)
}

func (a *App) GetJobsByTypes(jobTypes []string, offset int, limit int) ([]*model.Job, *model.AppError) {
	jobs, err := a.Srv().Store().Job().GetAllByTypesPage(jobTypes, offset, limit)
	if err != nil {
		return nil, model.NewAppError("GetJobsByType", "app.job.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return jobs, nil
}

func (a *App) CreateJob(job *model.Job) (*model.Job, *model.AppError) {
	return a.Srv().Jobs.CreateJob(job.Type, job.Data)
}

func (a *App) CancelJob(jobId string) *model.AppError {
	return a.Srv().Jobs.RequestCancellation(jobId)
}

func (a *App) SessionHasPermissionToCreateJob(session model.Session, job *model.Job) (bool, *model.Permission) {
	switch job.Type {
	case model.JobTypeBlevePostIndexing:
		return a.SessionHasPermissionTo(session, model.PermissionCreatePostBleveIndexesJob), model.PermissionCreatePostBleveIndexesJob
	case model.JobTypeDataRetention:
		return a.SessionHasPermissionTo(session, model.PermissionCreateDataRetentionJob), model.PermissionCreateDataRetentionJob
	case model.JobTypeMessageExport:
		return a.SessionHasPermissionTo(session, model.PermissionCreateComplianceExportJob), model.PermissionCreateComplianceExportJob
	case model.JobTypeElasticsearchPostIndexing:
		return a.SessionHasPermissionTo(session, model.PermissionCreateElasticsearchPostIndexingJob), model.PermissionCreateElasticsearchPostIndexingJob
	case model.JobTypeElasticsearchPostAggregation:
		return a.SessionHasPermissionTo(session, model.PermissionCreateElasticsearchPostAggregationJob), model.PermissionCreateElasticsearchPostAggregationJob
	case model.JobTypeLdapSync:
		return a.SessionHasPermissionTo(session, model.PermissionCreateLdapSyncJob), model.PermissionCreateLdapSyncJob
	case
		model.JobTypeMigrations,
		model.JobTypePlugins,
		model.JobTypeProductNotices,
		model.JobTypeExpiryNotify,
		model.JobTypeActiveUsers,
		model.JobTypeImportProcess,
		model.JobTypeImportDelete,
		model.JobTypeExportProcess,
		model.JobTypeExportDelete,
		model.JobTypeCloud,
		model.JobTypeExtractContent:
		return a.SessionHasPermissionTo(session, model.PermissionManageJobs), model.PermissionManageJobs
	}

	return false, nil
}

func (a *App) SessionHasPermissionToReadJob(session model.Session, jobType string) (bool, *model.Permission) {
	switch jobType {
	case model.JobTypeDataRetention:
		return a.SessionHasPermissionTo(session, model.PermissionReadDataRetentionJob), model.PermissionReadDataRetentionJob
	case model.JobTypeMessageExport:
		return a.SessionHasPermissionTo(session, model.PermissionReadComplianceExportJob), model.PermissionReadComplianceExportJob
	case model.JobTypeElasticsearchPostIndexing:
		return a.SessionHasPermissionTo(session, model.PermissionReadElasticsearchPostIndexingJob), model.PermissionReadElasticsearchPostIndexingJob
	case model.JobTypeElasticsearchPostAggregation:
		return a.SessionHasPermissionTo(session, model.PermissionReadElasticsearchPostAggregationJob), model.PermissionReadElasticsearchPostAggregationJob
	case model.JobTypeLdapSync:
		return a.SessionHasPermissionTo(session, model.PermissionReadLdapSyncJob), model.PermissionReadLdapSyncJob
	case
		model.JobTypeBlevePostIndexing,
		model.JobTypeMigrations,
		model.JobTypePlugins,
		model.JobTypeProductNotices,
		model.JobTypeExpiryNotify,
		model.JobTypeActiveUsers,
		model.JobTypeImportProcess,
		model.JobTypeImportDelete,
		model.JobTypeExportProcess,
		model.JobTypeExportDelete,
		model.JobTypeCloud,
		model.JobTypeExtractContent:
		return a.SessionHasPermissionTo(session, model.PermissionReadJobs), model.PermissionReadJobs
	}

	return false, nil
}
