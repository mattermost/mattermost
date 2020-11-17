// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v5/audit"
	"github.com/mattermost/mattermost-server/v5/model"
)

func (api *API) InitJobLocal() {
	api.BaseRoutes.Jobs.Handle("", api.ApiLocal(getJobs)).Methods("GET")
	api.BaseRoutes.Jobs.Handle("", api.ApiLocal(localCreateJob)).Methods("POST")
	api.BaseRoutes.Jobs.Handle("/{job_id:[A-Za-z0-9]+}", api.ApiLocal(getJob)).Methods("GET")
	api.BaseRoutes.Jobs.Handle("/{job_id:[A-Za-z0-9]+}/cancel", api.ApiLocal(localCancelJob)).Methods("POST")
	api.BaseRoutes.Jobs.Handle("/type/{job_type:[A-Za-z0-9_-]+}", api.ApiLocal(getJobsByType)).Methods("GET")
}

func localCreateJob(c *Context, w http.ResponseWriter, r *http.Request) {
	job := model.JobFromJson(r.Body)
	if job == nil {
		c.SetInvalidParam("job")
		return
	}

	auditRec := c.MakeAuditRecord("localCreateJob", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("job", job)

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

func localCancelJob(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireJobId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("localCancelJob", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("job_id", c.Params.JobId)

	if err := c.App.CancelJob(c.Params.JobId); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()

	ReturnStatusOK(w)
}
