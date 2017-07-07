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

	BaseRoutes.Jobs.Handle("/type/{job_type:[A-Za-z0-9_-]+}/statuses", ApiSessionRequired(getJobsByType)).Methods("GET")
	BaseRoutes.Jobs.Handle("/{job_id:[A-Za-z0-9]+}/status", ApiSessionRequired(getJob)).Methods("GET")
}

func getJob(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireJobId()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if status, err := app.GetJob(c.Params.JobId); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(status.ToJson()))
	}
}

func getJobsByType(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireJobType()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if statuses, err := app.GetJobsByTypePage(c.Params.JobType, c.Params.Page, c.Params.PerPage); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(model.JobsToJson(statuses)))
	}
}
