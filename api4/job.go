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

	BaseRoutes.Jobs.Handle("/type/{job_type:[A-Za-z0-9_-]+}/statuses", ApiSessionRequired(getJobStatusesByType)).Methods("GET")
	BaseRoutes.Jobs.Handle("/{job_id:[A-Za-z0-9]+}/status", ApiSessionRequired(getJobStatus)).Methods("GET")
}

func getJobStatus(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireJobId()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if status, err := app.GetJobStatus(c.Params.JobId); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(status.ToJson()))
	}
}

func getJobStatusesByType(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireJobType()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if statuses, err := app.GetJobStatusesByTypePage(c.Params.JobType, c.Params.Page, c.Params.PerPage); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(model.JobStatusesToJson(statuses)))
	}
}
