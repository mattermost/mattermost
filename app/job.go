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

func (a *App) GetJobsByTypesPage(jobType []string, page int, perPage int) ([]*model.Job, *model.AppError) {
	return a.GetJobsByTypes(jobType, page*perPage, perPage)
}

func (a *App) GetJobsByTypes(jobTypes []string, offset int, limit int) ([]*model.Job, *model.AppError) {
	jobs, err := a.Srv().Store.Job().GetAllByTypesPage(jobTypes, offset, limit)
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

func (a *App) SessionHasPermissionToCreateJob(session model.Session, job *model.Job) (bool, *model.Permission) {
	switch job.Type {
	case model.JOB_TYPE_BLEVE_POST_INDEXING:
		return a.SessionHasPermissionTo(session, model.PERMISSION_CREATE_POST_BLEVE_INDEXES_JOB), model.PERMISSION_CREATE_POST_BLEVE_INDEXES_JOB
	case model.JOB_TYPE_DATA_RETENTION:
		return a.SessionHasPermissionTo(session, model.PERMISSION_CREATE_DATA_RETENTION_JOB), model.PERMISSION_CREATE_DATA_RETENTION_JOB
	case model.JOB_TYPE_MESSAGE_EXPORT:
		return a.SessionHasPermissionTo(session, model.PERMISSION_CREATE_COMPLIANCE_EXPORT_JOB), model.PERMISSION_CREATE_COMPLIANCE_EXPORT_JOB
	case model.JOB_TYPE_ELASTICSEARCH_POST_INDEXING:
		return a.SessionHasPermissionTo(session, model.PERMISSION_CREATE_ELASTICSEARCH_POST_INDEXING_JOB), model.PERMISSION_CREATE_ELASTICSEARCH_POST_INDEXING_JOB
	case model.JOB_TYPE_ELASTICSEARCH_POST_AGGREGATION:
		return a.SessionHasPermissionTo(session, model.PERMISSION_CREATE_ELASTICSEARCH_POST_AGGREGATION_JOB), model.PERMISSION_CREATE_ELASTICSEARCH_POST_AGGREGATION_JOB
	case model.JOB_TYPE_LDAP_SYNC:
		return a.SessionHasPermissionTo(session, model.PERMISSION_CREATE_LDAP_SYNC_JOB), model.PERMISSION_CREATE_LDAP_SYNC_JOB
	case
		model.JOB_TYPE_MIGRATIONS,
		model.JOB_TYPE_PLUGINS,
		model.JOB_TYPE_PRODUCT_NOTICES,
		model.JOB_TYPE_EXPIRY_NOTIFY,
		model.JOB_TYPE_ACTIVE_USERS,
		model.JOB_TYPE_IMPORT_PROCESS,
		model.JOB_TYPE_IMPORT_DELETE,
		model.JOB_TYPE_EXPORT_PROCESS,
		model.JOB_TYPE_EXPORT_DELETE,
		model.JOB_TYPE_CLOUD:
		return a.SessionHasPermissionTo(session, model.PERMISSION_MANAGE_JOBS), model.PERMISSION_MANAGE_JOBS
	}

	return false, nil
}

func (a *App) SessionHasPermissionToReadJob(session model.Session, jobType string) (bool, *model.Permission) {
	switch jobType {
	case model.JOB_TYPE_DATA_RETENTION:
		return a.SessionHasPermissionTo(session, model.PERMISSION_READ_DATA_RETENTION_JOB), model.PERMISSION_READ_DATA_RETENTION_JOB
	case model.JOB_TYPE_MESSAGE_EXPORT:
		return a.SessionHasPermissionTo(session, model.PERMISSION_READ_COMPLIANCE_EXPORT_JOB), model.PERMISSION_READ_COMPLIANCE_EXPORT_JOB
	case model.JOB_TYPE_ELASTICSEARCH_POST_INDEXING:
		return a.SessionHasPermissionTo(session, model.PERMISSION_READ_ELASTICSEARCH_POST_INDEXING_JOB), model.PERMISSION_READ_ELASTICSEARCH_POST_INDEXING_JOB
	case model.JOB_TYPE_ELASTICSEARCH_POST_AGGREGATION:
		return a.SessionHasPermissionTo(session, model.PERMISSION_READ_ELASTICSEARCH_POST_AGGREGATION_JOB), model.PERMISSION_READ_ELASTICSEARCH_POST_AGGREGATION_JOB
	case model.JOB_TYPE_LDAP_SYNC:
		return a.SessionHasPermissionTo(session, model.PERMISSION_READ_LDAP_SYNC_JOB), model.PERMISSION_READ_LDAP_SYNC_JOB
	case
		model.JOB_TYPE_BLEVE_POST_INDEXING,
		model.JOB_TYPE_MIGRATIONS,
		model.JOB_TYPE_PLUGINS,
		model.JOB_TYPE_PRODUCT_NOTICES,
		model.JOB_TYPE_EXPIRY_NOTIFY,
		model.JOB_TYPE_ACTIVE_USERS,
		model.JOB_TYPE_IMPORT_PROCESS,
		model.JOB_TYPE_IMPORT_DELETE,
		model.JOB_TYPE_EXPORT_PROCESS,
		model.JOB_TYPE_EXPORT_DELETE,
		model.JOB_TYPE_CLOUD:
		return a.SessionHasPermissionTo(session, model.PERMISSION_READ_JOBS), model.PERMISSION_READ_JOBS
	}

	return false, nil
}
