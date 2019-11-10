// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"bytes"
	"io/ioutil"
	"net/http"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/services/tracing"
)

func (api *API) InitJob() {
	api.BaseRoutes.Jobs.Handle("", api.ApiSessionRequired(getJobs)).Methods("GET")
	api.BaseRoutes.Jobs.Handle("", api.ApiSessionRequired(createJob)).Methods("POST")
	api.BaseRoutes.Jobs.Handle("/{job_id:[A-Za-z0-9]+}", api.ApiSessionRequired(getJob)).Methods("GET")
	api.BaseRoutes.Jobs.Handle("/{job_id:[A-Za-z0-9]+}/cancel", api.ApiSessionRequired(cancelJob)).Methods("POST")
	api.BaseRoutes.Jobs.Handle("/type/{job_type:[A-Za-z0-9_-]+}", api.ApiSessionRequired(getJobsByType)).Methods("GET")
}

func getJob(c *Context, w http.ResponseWriter, r *http.Request) {
	span, ctx := tracing.StartSpanWithParentByContext(c.App.Context, "api4:job:getJob")
	c.App.Context = ctx
	var bodyBytes []byte
	if r.Body != nil {
		bodyBytes, _ = ioutil.ReadAll(r.Body)
		r.Body = ioutil.NopCloser(bytes.NewBuffer(bodyBytes))
		span.SetTag("body", string(bodyBytes))
	}

	span.SetTag("JobId", c.Params.JobId)
	defer span.Finish()
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
	span, ctx := tracing.StartSpanWithParentByContext(c.App.Context, "api4:job:createJob")
	c.App.Context = ctx
	var bodyBytes []byte
	if r.Body != nil {
		bodyBytes, _ = ioutil.ReadAll(r.Body)
		r.Body = ioutil.NopCloser(bytes.NewBuffer(bodyBytes))
		span.SetTag("body", string(bodyBytes))
	}

	defer span.Finish()
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
	span, ctx := tracing.StartSpanWithParentByContext(c.App.Context, "api4:job:getJobs")
	c.App.Context = ctx
	var bodyBytes []byte
	if r.Body != nil {
		bodyBytes, _ = ioutil.ReadAll(r.Body)
		r.Body = ioutil.NopCloser(bytes.NewBuffer(bodyBytes))
		span.SetTag("body", string(bodyBytes))
	}

	span.SetTag("Page", c.Params.Page)
	span.SetTag("PerPage", c.Params.PerPage)
	defer span.Finish()
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
	span, ctx := tracing.StartSpanWithParentByContext(c.App.Context, "api4:job:getJobsByType")
	c.App.Context = ctx
	var bodyBytes []byte
	if r.Body != nil {
		bodyBytes, _ = ioutil.ReadAll(r.Body)
		r.Body = ioutil.NopCloser(bytes.NewBuffer(bodyBytes))
		span.SetTag("body", string(bodyBytes))
	}

	span.SetTag("JobType", c.Params.JobType)
	span.SetTag("Page", c.Params.Page)
	span.SetTag("PerPage", c.Params.PerPage)
	defer span.Finish()
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
	span, ctx := tracing.StartSpanWithParentByContext(c.App.Context, "api4:job:cancelJob")
	c.App.Context = ctx
	var bodyBytes []byte
	if r.Body != nil {
		bodyBytes, _ = ioutil.ReadAll(r.Body)
		r.Body = ioutil.NopCloser(bytes.NewBuffer(bodyBytes))
		span.SetTag("body", string(bodyBytes))
	}

	span.SetTag("JobId", c.Params.JobId)
	defer span.Finish()
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
