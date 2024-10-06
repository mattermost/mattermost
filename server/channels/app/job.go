// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func (a *App) GetJob(c request.CTX, id string) (*model.Job, *model.AppError) {
	job, err := a.Srv().Store().Job().Get(c, id)
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

func (a *App) GetJobsByTypePage(c request.CTX, jobType string, page int, perPage int) ([]*model.Job, *model.AppError) {
	return a.GetJobsByType(c, jobType, page*perPage, perPage)
}

func (a *App) GetJobsByType(c request.CTX, jobType string, offset int, limit int) ([]*model.Job, *model.AppError) {
	jobs, err := a.Srv().Store().Job().GetAllByTypePage(c, jobType, offset, limit)
	if err != nil {
		return nil, model.NewAppError("GetJobsByType", "app.job.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return jobs, nil
}

func (a *App) GetJobsByTypesPage(c request.CTX, jobType []string, page int, perPage int) ([]*model.Job, *model.AppError) {
	return a.GetJobsByTypes(c, jobType, page*perPage, perPage)
}

func (a *App) GetJobsByTypes(c request.CTX, jobTypes []string, offset int, limit int) ([]*model.Job, *model.AppError) {
	jobs, err := a.Srv().Store().Job().GetAllByTypesPage(c, jobTypes, offset, limit)
	if err != nil {
		return nil, model.NewAppError("GetJobsByType", "app.job.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return jobs, nil
}

func (a *App) GetJobsByTypeAndStatus(c request.CTX, jobTypes []string, status string, page int, perPage int) ([]*model.Job, *model.AppError) {
	jobs, err := a.Srv().Store().Job().GetAllByTypeAndStatusPage(c, jobTypes, status, page*perPage, perPage)
	if err != nil {
		return nil, model.NewAppError("GetAllByTypeAndStatusPage", "app.job.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return jobs, nil
}

func (a *App) CreateJob(c request.CTX, job *model.Job) (*model.Job, *model.AppError) {
	return a.Srv().Jobs.CreateJob(c, job.Type, job.Data)
}

func (a *App) CancelJob(c request.CTX, jobId string) *model.AppError {
	return a.Srv().Jobs.RequestCancellation(c, jobId)
}

func (a *App) UpdateJobStatus(c request.CTX, job *model.Job, newStatus string) *model.AppError {
	switch newStatus {
	case model.JobStatusPending:
		return a.Srv().Jobs.SetJobPending(job)
	case model.JobStatusCancelRequested:
		return a.Srv().Jobs.RequestCancellation(c, job.Id)
	case model.JobStatusCanceled:
		return a.Srv().Jobs.SetJobCanceled(job)
	default:
		return model.NewAppError("UpdateJobStatus", "app.job.update_status.app_error", nil, "", http.StatusInternalServerError)
	}
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

func (a *App) SessionHasPermissionToManageJob(session model.Session, job *model.Job) (bool, *model.Permission) {
	var permission *model.Permission

	switch job.Type {
	case model.JobTypeBlevePostIndexing:
		permission = model.PermissionManagePostBleveIndexesJob
	case model.JobTypeDataRetention:
		permission = model.PermissionManageDataRetentionJob
	case model.JobTypeMessageExport:
		permission = model.PermissionManageComplianceExportJob
	case model.JobTypeElasticsearchPostIndexing:
		permission = model.PermissionManageElasticsearchPostIndexingJob
	case model.JobTypeElasticsearchPostAggregation:
		permission = model.PermissionManageElasticsearchPostAggregationJob
	case model.JobTypeLdapSync:
		permission = model.PermissionManageLdapSyncJob
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
		permission = model.PermissionManageJobs
	}

	if permission == nil {
		return false, nil
	}

	return a.SessionHasPermissionTo(session, permission), permission
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
		model.JobTypeMobileSessionMetadata,
		model.JobTypeExtractContent:
		return a.SessionHasPermissionTo(session, model.PermissionReadJobs), model.PermissionReadJobs
	}

	return false, nil
}
