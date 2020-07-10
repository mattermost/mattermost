// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"fmt"
	"net/http"
	"time"

	"github.com/mattermost/mattermost-server/v5/audit"
	"github.com/mattermost/mattermost-server/v5/model"
)

const FILE_PATH = "export/%s/%s"

func (api *API) InitJob() {
	api.BaseRoutes.Jobs.Handle("", api.ApiSessionRequired(getJobs)).Methods("GET")
	api.BaseRoutes.Jobs.Handle("", api.ApiSessionRequired(createJob)).Methods("POST")
	api.BaseRoutes.Jobs.Handle("/{job_id:[A-Za-z0-9]+}", api.ApiSessionRequired(getJob)).Methods("GET")
	api.BaseRoutes.Jobs.Handle("/{job_id:[A-Za-z0-9]+}/download", api.ApiSessionRequiredTrustRequester(downloadJob)).Methods("GET")
	api.BaseRoutes.Jobs.Handle("/{job_id:[A-Za-z0-9]+}/cancel", api.ApiSessionRequired(cancelJob)).Methods("POST")
	api.BaseRoutes.Jobs.Handle("/type/{job_type:[A-Za-z0-9_-]+}", api.ApiSessionRequired(getJobsByType)).Methods("GET")
}

func getJob(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireJobId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_MANAGE_JOBS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_JOBS)
		return
	}

	job, err := c.App.GetJob(c.Params.JobId)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(job.ToJson()))
}

func downloadJob(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireJobId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_MANAGE_JOBS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_JOBS)
		return
	}

	job, err := c.App.GetJob(c.Params.JobId)
	if err != nil {
		c.Err = err
		return
	}

	filePath := fmt.Sprintf(FILE_PATH, job.Id, model.FILE_INFO[job.Data["export_type"]]["fileName"])
	fileReader, err := c.App.FileReader(filePath)
	if err != nil {
		c.Err = err
		c.Err.StatusCode = http.StatusNotFound
		return
	}
	defer fileReader.Close()

	err = writeFileResponse(model.FILE_INFO[job.Data["export_type"]]["fileName"], model.FILE_INFO[job.Data["export_type"]]["fileMime"], 0, time.Unix(0, job.LastActivityAt*int64(1000*1000)), *c.App.Config().ServiceSettings.WebserverMode, fileReader, true, w, r)
	if err != nil {
		c.Err = err
		return
	}
}

func createJob(c *Context, w http.ResponseWriter, r *http.Request) {
	job := model.JobFromJson(r.Body)
	if job == nil {
		c.SetInvalidParam("job")
		return
	}

	auditRec := c.MakeAuditRecord("createJob", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("job", job)

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_MANAGE_JOBS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_JOBS)
		return
	}

	job, err := c.App.CreateJob(job)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddMeta("job", job) // overwrite meta

	w.WriteHeader(http.StatusCreated)
	w.Write([]byte(job.ToJson()))
}

func getJobs(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_MANAGE_JOBS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_JOBS)
		return
	}

	jobs, err := c.App.GetJobsPage(c.Params.Page, c.Params.PerPage)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.JobsToJson(jobs)))
}

func getJobsByType(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireJobType()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_MANAGE_JOBS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_JOBS)
		return
	}

	jobs, err := c.App.GetJobsByTypePage(c.Params.JobType, c.Params.Page, c.Params.PerPage)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.JobsToJson(jobs)))
}

func cancelJob(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireJobId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("cancelJob", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("job_id", c.Params.JobId)

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_MANAGE_JOBS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_JOBS)
		return
	}

	if err := c.App.CancelJob(c.Params.JobId); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()

	ReturnStatusOK(w)
}
