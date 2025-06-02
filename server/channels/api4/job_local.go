// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/audit"
)

func (api *API) InitJobLocal() {
	api.BaseRoutes.Jobs.Handle("", api.APILocal(getJobs)).Methods(http.MethodGet)
	api.BaseRoutes.Jobs.Handle("", api.APILocal(localCreateJob)).Methods(http.MethodPost)
	api.BaseRoutes.Jobs.Handle("/{job_id:[A-Za-z0-9]+}", api.APILocal(getJob)).Methods(http.MethodGet)
	api.BaseRoutes.Jobs.Handle("/{job_id:[A-Za-z0-9]+}/cancel", api.APILocal(cancelJob)).Methods(http.MethodPost)
	api.BaseRoutes.Jobs.Handle("/type/{job_type:[A-Za-z0-9_-]+}", api.APILocal(getJobsByType)).Methods(http.MethodGet)
	api.BaseRoutes.Jobs.Handle("/{job_id:[A-Za-z0-9]+}/status", api.APILocal(updateJobStatus)).Methods(http.MethodPatch)
}

func localCreateJob(c *Context, w http.ResponseWriter, r *http.Request) {
	var job model.Job
	if jsonErr := json.NewDecoder(r.Body).Decode(&job); jsonErr != nil {
		c.SetInvalidParamWithErr("job", jsonErr)
		return
	}

	auditRec := c.MakeAuditRecord("localCreateJob", audit.Fail)
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
