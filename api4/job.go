// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v5/model"
)

func (api *API) InitJob() {
	api.BaseRoutes.Jobs.Handle("", api.ApiSessionRequired(getJobs)).Methods("GET")
	api.BaseRoutes.Jobs.Handle("", api.ApiSessionRequired(createJob)).Methods("POST")
	api.BaseRoutes.Jobs.Handle("/{job_id:[A-Za-z0-9]+}", api.ApiSessionRequired(getJob)).Methods("GET")
	api.BaseRoutes.Jobs.Handle("/{job_id:[A-Za-z0-9]+}/cancel", api.ApiSessionRequired(cancelJob)).Methods("POST")
	api.BaseRoutes.Jobs.Handle("/type/{job_type:[A-Za-z0-9_-]+}", api.ApiSessionRequired(getJobsByType)).Methods("GET")
}

func getJob(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireJobId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_JOBS) {
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

func createJob(c *Context, w http.ResponseWriter, r *http.Request) {
	job := model.JobFromJson(r.Body)
	if job == nil {
		c.SetInvalidParam("job")
		return
	}

	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_JOBS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_JOBS)
		return
	}

	job, err := c.App.CreateJob(job)
	if err != nil {
		c.Err = err
		return
	}

	w.WriteHeader(http.StatusCreated)
	w.Write([]byte(job.ToJson()))
}

func getJobs(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_JOBS) {
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

	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_JOBS) {
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

	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_JOBS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_JOBS)
		return
	}

	if err := c.App.CancelJob(c.Params.JobId); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}
