// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
)

func InitJob() {
	l4g.Info("Initializing job API routes")

	BaseRoutes.Jobs.Handle("", ApiSessionRequired(getJobs)).Methods("GET")
	BaseRoutes.Jobs.Handle("", ApiSessionRequired(createJob)).Methods("POST")
	BaseRoutes.Jobs.Handle("/{job_id:[A-Za-z0-9]+}", ApiSessionRequired(getJob)).Methods("GET")
	BaseRoutes.Jobs.Handle("/{job_id:[A-Za-z0-9]+}/cancel", ApiSessionRequired(cancelJob)).Methods("POST")
	BaseRoutes.Jobs.Handle("/type/{job_type:[A-Za-z0-9_-]+}", ApiSessionRequired(getJobsByType)).Methods("GET")
}

func getJob(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireJobId()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_JOBS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_JOBS)
		return
	}

	if job, err := app.GetJob(c.Params.JobId); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(job.ToJson()))
	}
}

func createJob(c *Context, w http.ResponseWriter, r *http.Request) {
	job := model.JobFromJson(r.Body)
	if job == nil {
		c.SetInvalidParam("job")
		return
	}

	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_JOBS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_JOBS)
		return
	}

	if job, err := app.CreateJob(job); err != nil {
		c.Err = err
		return
	} else {
		w.WriteHeader(http.StatusCreated)
		w.Write([]byte(job.ToJson()))
	}
}

func getJobs(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_JOBS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_JOBS)
		return
	}

	if jobs, err := app.GetJobsPage(c.Params.Page, c.Params.PerPage); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(model.JobsToJson(jobs)))
	}
}

func getJobsByType(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireJobType()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_JOBS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_JOBS)
		return
	}

	if jobs, err := app.GetJobsByTypePage(c.Params.JobType, c.Params.Page, c.Params.PerPage); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(model.JobsToJson(jobs)))
	}
}

func cancelJob(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireJobId()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_JOBS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_JOBS)
		return
	}

	if err := app.CancelJob(c.Params.JobId); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}
