// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"
	"path"
	"path/filepath"
	"strconv"
	"time"

	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/audit"
	"github.com/mattermost/mattermost/server/v8/platform/shared/web"
)

func (api *API) InitJob() {
	api.BaseRoutes.Jobs.Handle("", api.APISessionRequired(getJobs)).Methods(http.MethodGet)
	api.BaseRoutes.Jobs.Handle("", api.APISessionRequired(createJob)).Methods(http.MethodPost)
	api.BaseRoutes.Jobs.Handle("/{job_id:[A-Za-z0-9]+}", api.APISessionRequired(getJob)).Methods(http.MethodGet)
	api.BaseRoutes.Jobs.Handle("/{job_id:[A-Za-z0-9]+}/download", api.APISessionRequiredTrustRequester(downloadJob)).Methods(http.MethodGet)
	api.BaseRoutes.Jobs.Handle("/{job_id:[A-Za-z0-9]+}/cancel", api.APISessionRequired(cancelJob)).Methods(http.MethodPost)
	api.BaseRoutes.Jobs.Handle("/type/{job_type:[A-Za-z0-9_-]+}", api.APISessionRequired(getJobsByType)).Methods(http.MethodGet)
	api.BaseRoutes.Jobs.Handle("/{job_id:[A-Za-z0-9]+}/status", api.APISessionRequired(updateJobStatus)).Methods(http.MethodPatch)
}

func getJob(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireJobId()
	if c.Err != nil {
		return
	}

	job, err := c.App.GetJob(c.AppContext, c.Params.JobId)
	if err != nil {
		c.Err = err
		return
	}

	hasPermission, permissionRequired := c.App.SessionHasPermissionToReadJob(*c.AppContext.Session(), job.Type)
	if permissionRequired == nil {
		c.Err = model.NewAppError("getJob", "api.job.retrieve.nopermissions", nil, "", http.StatusBadRequest)
		return
	}
	if !hasPermission {
		c.SetPermissionError(permissionRequired)
		return
	}

	if err := json.NewEncoder(w).Encode(job); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func downloadJob(c *Context, w http.ResponseWriter, r *http.Request) {
	config := c.App.Config()
	const oldFilePath = "export"
	const FileMime = "application/zip"

	c.RequireJobId()
	if c.Err != nil {
		return
	}

	if !*config.MessageExportSettings.DownloadExportResults {
		c.Err = model.NewAppError("downloadExportResultsNotEnabled", "app.job.download_export_results_not_enabled", nil, "", http.StatusNotImplemented)
		return
	}

	job, err := c.App.GetJob(c.AppContext, c.Params.JobId)
	if err != nil {
		c.Err = err
		return
	}

	// Currently, this endpoint only supports downloading the compliance report.
	// If you need to download another job type, you will need to alter this section of the code to accommodate it.
	if job.Type == model.JobTypeMessageExport && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionDownloadComplianceExportResult) {
		c.SetPermissionError(model.PermissionDownloadComplianceExportResult)
		return
	} else if job.Type != model.JobTypeMessageExport {
		c.Err = model.NewAppError("unableToDownloadJob", "api.job.unable_to_download_job.incorrect_job_type", nil, "", http.StatusBadRequest)
		return
	}

	isDownloadable, _ := strconv.ParseBool(job.Data["is_downloadable"])
	if !isDownloadable {
		c.Err = model.NewAppError("unableToDownloadJob", "api.job.unable_to_download_job", nil, "", http.StatusBadRequest)
		return
	}

	exportDir, ok := job.Data["export_dir"]
	fileName := path.Base(exportDir)
	if !ok || exportDir == "" || fileName == "/" || fileName == "." {
		// Could be a pre-overhaul job. Try the old method:
		fileName = job.Id + ".zip"
		filePath := filepath.Join(oldFilePath, fileName)
		var fileReader filestore.ReadCloseSeeker
		fileReader, err = c.App.ExportFileReader(filePath)
		if err != nil {
			c.Err = model.NewAppError("unableToDownloadJob", "api.job.unable_to_download_job", nil,
				"job.Data did not include export_dir, export_dir was malformed, or jobId.zip wasn't found",
				http.StatusNotFound).Wrap(err)
			return
		}
		defer fileReader.Close()

		// We are able to pass 0 for content size due to the fact that Golang's serveContent (https://golang.org/src/net/http/fs.go)
		// already sets that for us
		web.WriteFileResponse(fileName, FileMime, 0, time.UnixMilli(job.LastActivityAt), *c.App.Config().ServiceSettings.WebserverMode, fileReader, true, w, r)
		return
	}

	// We have a base directory, we're using that as the exported filename:
	fileName += ".zip"

	cleanedExportDir := filepath.Clean(exportDir)
	if !filepath.IsLocal(cleanedExportDir) {
		c.Err = model.NewAppError("unableToDownloadJob", "api.job.unable_to_download_job", nil,
			"job.Data did not include export_dir, export_dir was malformed, or jobId.zip wasn't found",
			http.StatusNotFound).Wrap(err)
		return
	}

	zipReader, err := c.App.ExportZipReader(cleanedExportDir, false)
	if err != nil {
		c.Err = model.NewAppError("unableToDownloadJob", "api.job.unable_to_download_job", nil,
			"error creating zip reader", http.StatusNotFound).Wrap(err)
		return
	}
	defer zipReader.Close()

	if err := web.WriteStreamResponse(w, zipReader, fileName, FileMime, true); err != nil {
		c.Err = model.NewAppError("unableToDownloadJob", "api.job.unable_to_download_job", nil,
			"failure to WriteStreamResponse", http.StatusInternalServerError).
			Wrap(err)
		return
	}
}

func createJob(c *Context, w http.ResponseWriter, r *http.Request) {
	var job model.Job
	if jsonErr := json.NewDecoder(r.Body).Decode(&job); jsonErr != nil {
		c.SetInvalidParamWithErr("job", jsonErr)
		return
	}

	auditRec := c.MakeAuditRecord("createJob", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameterAuditable(auditRec, "job", &job)

	hasPermission, permissionRequired := c.App.SessionHasPermissionToCreateJob(*c.AppContext.Session(), &job)
	if permissionRequired == nil {
		c.Err = model.NewAppError("unableToCreateJob", "api.job.unable_to_create_job.incorrect_job_type", nil, "", http.StatusBadRequest)
		return
	}

	if !hasPermission {
		c.SetPermissionError(permissionRequired)
		return
	}

	rjob, err := c.App.CreateJob(c.AppContext, &job)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(rjob)
	auditRec.AddEventObjectType("job")

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(rjob); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getJobs(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.Err != nil {
		return
	}

	jobType := r.URL.Query().Get("job_type")
	var validJobTypes []string

	if jobType != "" {
		isValidJobType := model.IsValidJobType(jobType)
		if !isValidJobType {
			c.SetInvalidURLParam("job_type")
			return
		}
		hasPermission, permissionRequired := c.App.SessionHasPermissionToReadJob(*c.AppContext.Session(), jobType)
		if permissionRequired == nil {
			c.Err = model.NewAppError("getJobsByType", "api.job.retrieve.nopermissions", nil, "", http.StatusBadRequest)
			return
		}
		if !hasPermission {
			c.SetPermissionError(permissionRequired)
			return
		}
		validJobTypes = append(validJobTypes, jobType)
	} else {
		for _, jType := range model.AllJobTypes {
			hasPermission, permissionRequired := c.App.SessionHasPermissionToReadJob(*c.AppContext.Session(), jType)
			if permissionRequired == nil {
				c.Logger.Warn("The job types of a job you are trying to retrieve does not contain permissions", mlog.String("jobType", jType))
				continue
			}
			if hasPermission {
				validJobTypes = append(validJobTypes, jType)
			}
		}
	}

	if len(validJobTypes) == 0 {
		c.SetPermissionError()
		return
	}

	status := r.URL.Query().Get("status")
	isValidStatus := model.IsValidJobStatus(status)
	if status != "" && !isValidStatus {
		c.Err = model.NewAppError("getJobs", "api.job.status.invalid", nil, "", http.StatusBadRequest)
	}

	var jobs []*model.Job
	var appErr *model.AppError

	if status == "" {
		jobs, appErr = c.App.GetJobsByTypesPage(c.AppContext, validJobTypes, c.Params.Page, c.Params.PerPage)
	} else {
		jobs, appErr = c.App.GetJobsByTypeAndStatus(c.AppContext, validJobTypes, status, c.Params.Page, c.Params.PerPage)
	}

	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(jobs)
	if err != nil {
		c.Err = model.NewAppError("getJobs", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getJobsByType(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireJobType()
	if c.Err != nil {
		return
	}

	hasPermission, permissionRequired := c.App.SessionHasPermissionToReadJob(*c.AppContext.Session(), c.Params.JobType)
	if permissionRequired == nil {
		c.Err = model.NewAppError("getJobsByType", "api.job.retrieve.nopermissions", nil, "", http.StatusBadRequest)
		return
	}
	if !hasPermission {
		c.SetPermissionError(permissionRequired)
		return
	}

	jobs, appErr := c.App.GetJobsByTypePage(c.AppContext, c.Params.JobType, c.Params.Page, c.Params.PerPage)
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(jobs)
	if err != nil {
		c.Err = model.NewAppError("getJobsByType", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func cancelJob(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireJobId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("cancelJob", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "job_id", c.Params.JobId)

	job, err := c.App.GetJob(c.AppContext, c.Params.JobId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.AddEventPriorState(job)
	auditRec.AddEventObjectType("job")

	// if permission to create, permission to cancel, same permission
	hasPermission, permissionRequired := c.App.SessionHasPermissionToCreateJob(*c.AppContext.Session(), job)
	if permissionRequired == nil {
		c.Err = model.NewAppError("unableToCancelJob", "api.job.unable_to_create_job.incorrect_job_type", nil, "", http.StatusBadRequest)
		return
	}

	if !hasPermission {
		c.SetPermissionError(permissionRequired)
		return
	}

	if err := c.App.CancelJob(c.AppContext, c.Params.JobId); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()

	ReturnStatusOK(w)
}

func updateJobStatus(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireJobId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("updateJobStatus", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "job_id", c.Params.JobId)

	props := model.StringInterfaceFromJSON(r.Body)
	status, ok := props["status"].(string)
	if !ok {
		c.SetInvalidParam("status")
		return
	}

	force, ok := props["force"].(bool)
	if !ok {
		force = false
	}

	job, err := c.App.GetJob(c.AppContext, c.Params.JobId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.AddEventPriorState(job)
	auditRec.AddEventObjectType("job")

	hasPermission, permissionRequired := c.App.SessionHasPermissionToManageJob(*c.AppContext.Session(), job)
	if permissionRequired == nil {
		c.Err = model.NewAppError("updateJobStatus", "api.job.unable_to_manage_job.incorrect_job_type", nil, "", http.StatusBadRequest)
		return
	}

	if !hasPermission {
		c.SetPermissionError(permissionRequired)
		return
	}

	if !force && !job.IsValidStatusChange(status) {
		c.Err = model.NewAppError("updateJobStatus", "api.job.status.invalid", nil, "", http.StatusBadRequest)
		return
	}

	if err := c.App.UpdateJobStatus(c.AppContext, job, status); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()

	ReturnStatusOK(w)
}
