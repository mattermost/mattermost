// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app"
)

func (api *API) InitScheduledRecap() {
	api.BaseRoutes.ScheduledRecaps.Handle("", api.APISessionRequired(createScheduledRecap)).Methods(http.MethodPost)
	api.BaseRoutes.ScheduledRecaps.Handle("", api.APISessionRequired(getScheduledRecaps)).Methods(http.MethodGet)
	api.BaseRoutes.ScheduledRecap.Handle("", api.APISessionRequired(getScheduledRecap)).Methods(http.MethodGet)
	api.BaseRoutes.ScheduledRecap.Handle("", api.APISessionRequired(updateScheduledRecap)).Methods(http.MethodPut)
	api.BaseRoutes.ScheduledRecap.Handle("", api.APISessionRequired(deleteScheduledRecap)).Methods(http.MethodDelete)
	api.BaseRoutes.ScheduledRecap.Handle("/pause", api.APISessionRequired(pauseScheduledRecap)).Methods(http.MethodPost)
	api.BaseRoutes.ScheduledRecap.Handle("/resume", api.APISessionRequired(resumeScheduledRecap)).Methods(http.MethodPost)
}

func createScheduledRecap(c *Context, w http.ResponseWriter, r *http.Request) {
	requireRecapsEnabled(c)
	if c.Err != nil {
		return
	}

	var recap model.ScheduledRecap
	if err := json.NewDecoder(r.Body).Decode(&recap); err != nil {
		c.SetInvalidParamWithErr("body", err)
		return
	}

	// Validate required fields
	if recap.Title == "" {
		c.SetInvalidParam("title")
		return
	}
	if recap.DaysOfWeek == 0 {
		c.SetInvalidParam("days_of_week")
		return
	}
	if recap.TimeOfDay == "" {
		c.SetInvalidParam("time_of_day")
		return
	}
	if recap.Timezone == "" {
		c.SetInvalidParam("timezone")
		return
	}
	if recap.TimePeriod == "" {
		c.SetInvalidParam("time_period")
		return
	}
	if recap.ChannelMode == "" {
		c.SetInvalidParam("channel_mode")
		return
	}
	if recap.AgentId == "" {
		c.SetInvalidParam("agent_id")
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventCreateScheduledRecap, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddEventObjectType("scheduled_recap")
	model.AddEventParameterToAuditRec(auditRec, "title", recap.Title)
	model.AddEventParameterToAuditRec(auditRec, "agent_id", recap.AgentId)
	model.AddEventParameterToAuditRec(auditRec, "channel_mode", recap.ChannelMode)

	savedRecap, err := c.App.CreateScheduledRecap(c.AppContext, &recap)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(savedRecap)

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(savedRecap); err != nil {
		c.Logger.Warn("Error encoding response", mlog.Err(err))
	}
}

func getScheduledRecap(c *Context, w http.ResponseWriter, r *http.Request) {
	requireRecapsEnabled(c)
	if c.Err != nil {
		return
	}

	c.RequireScheduledRecapId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventGetScheduledRecap, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddEventObjectType("scheduled_recap")
	model.AddEventParameterToAuditRec(auditRec, "scheduled_recap_id", c.Params.ScheduledRecapId)

	recap, err := c.App.GetScheduledRecap(c.AppContext, c.Params.ScheduledRecapId)
	if err != nil {
		c.Err = err
		return
	}

	// Authorization check: user can only view their own recaps
	if recap.UserId != c.AppContext.Session().UserId {
		c.Err = model.NewAppError("getScheduledRecap", "api.scheduled_recap.permission_denied", nil, "", http.StatusForbidden)
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(recap)

	if err := json.NewEncoder(w).Encode(recap); err != nil {
		c.Logger.Warn("Error encoding response", mlog.Err(err))
	}
}

func getScheduledRecaps(c *Context, w http.ResponseWriter, r *http.Request) {
	requireRecapsEnabled(c)
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventGetScheduledRecaps, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelAPI)
	model.AddEventParameterToAuditRec(auditRec, "page", c.Params.Page)
	model.AddEventParameterToAuditRec(auditRec, "per_page", c.Params.PerPage)

	recaps, err := c.App.GetScheduledRecapsForUser(c.AppContext, c.Params.Page, c.Params.PerPage)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	if len(recaps) > 0 {
		auditRec.AddMeta("scheduled_recap_count", len(recaps))
	}

	if err := json.NewEncoder(w).Encode(recaps); err != nil {
		c.Logger.Warn("Error encoding response", mlog.Err(err))
	}
}

func updateScheduledRecap(c *Context, w http.ResponseWriter, r *http.Request) {
	requireRecapsEnabled(c)
	if c.Err != nil {
		return
	}

	c.RequireScheduledRecapId()
	if c.Err != nil {
		return
	}

	var recap model.ScheduledRecap
	if err := json.NewDecoder(r.Body).Decode(&recap); err != nil {
		c.SetInvalidParamWithErr("body", err)
		return
	}

	// Ensure ID matches URL param
	recap.Id = c.Params.ScheduledRecapId

	// Fetch existing recap to check ownership
	existingRecap, err := c.App.GetScheduledRecap(c.AppContext, c.Params.ScheduledRecapId)
	if err != nil {
		c.Err = err
		return
	}

	// Authorization check
	if existingRecap.UserId != c.AppContext.Session().UserId {
		c.Err = model.NewAppError("updateScheduledRecap", "api.scheduled_recap.permission_denied", nil, "", http.StatusForbidden)
		return
	}

	// Preserve fields that shouldn't be changed via update
	recap.UserId = existingRecap.UserId
	recap.CreateAt = existingRecap.CreateAt

	auditRec := c.MakeAuditRecord(model.AuditEventUpdateScheduledRecap, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddEventObjectType("scheduled_recap")
	model.AddEventParameterToAuditRec(auditRec, "scheduled_recap_id", c.Params.ScheduledRecapId)
	auditRec.AddEventPriorState(existingRecap)

	updatedRecap, err := c.App.UpdateScheduledRecap(c.AppContext, &recap)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(updatedRecap)

	if err := json.NewEncoder(w).Encode(updatedRecap); err != nil {
		c.Logger.Warn("Error encoding response", mlog.Err(err))
	}
}

func deleteScheduledRecap(c *Context, w http.ResponseWriter, r *http.Request) {
	requireRecapsEnabled(c)
	if c.Err != nil {
		return
	}

	c.RequireScheduledRecapId()
	if c.Err != nil {
		return
	}

	// Fetch existing recap to check ownership
	existingRecap, err := c.App.GetScheduledRecap(c.AppContext, c.Params.ScheduledRecapId)
	if err != nil {
		c.Err = err
		return
	}

	// Authorization check
	if existingRecap.UserId != c.AppContext.Session().UserId {
		c.Err = model.NewAppError("deleteScheduledRecap", "api.scheduled_recap.permission_denied", nil, "", http.StatusForbidden)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventDeleteScheduledRecap, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddEventObjectType("scheduled_recap")
	model.AddEventParameterToAuditRec(auditRec, "scheduled_recap_id", c.Params.ScheduledRecapId)
	auditRec.AddEventPriorState(existingRecap)

	if err := c.App.DeleteScheduledRecap(c.AppContext, c.Params.ScheduledRecapId); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func pauseScheduledRecap(c *Context, w http.ResponseWriter, r *http.Request) {
	requireRecapsEnabled(c)
	if c.Err != nil {
		return
	}

	c.RequireScheduledRecapId()
	if c.Err != nil {
		return
	}

	// Fetch existing recap to check ownership
	existingRecap, err := c.App.GetScheduledRecap(c.AppContext, c.Params.ScheduledRecapId)
	if err != nil {
		c.Err = err
		return
	}

	// Authorization check
	if existingRecap.UserId != c.AppContext.Session().UserId {
		c.Err = model.NewAppError("pauseScheduledRecap", "api.scheduled_recap.permission_denied", nil, "", http.StatusForbidden)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventPauseScheduledRecap, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddEventObjectType("scheduled_recap")
	model.AddEventParameterToAuditRec(auditRec, "scheduled_recap_id", c.Params.ScheduledRecapId)
	auditRec.AddEventPriorState(existingRecap)

	pausedRecap, err := c.App.PauseScheduledRecap(c.AppContext, c.Params.ScheduledRecapId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(pausedRecap)

	if err := json.NewEncoder(w).Encode(pausedRecap); err != nil {
		c.Logger.Warn("Error encoding response", mlog.Err(err))
	}
}

func resumeScheduledRecap(c *Context, w http.ResponseWriter, r *http.Request) {
	requireRecapsEnabled(c)
	if c.Err != nil {
		return
	}

	c.RequireScheduledRecapId()
	if c.Err != nil {
		return
	}

	// Fetch existing recap to check ownership
	existingRecap, err := c.App.GetScheduledRecap(c.AppContext, c.Params.ScheduledRecapId)
	if err != nil {
		c.Err = err
		return
	}

	// Authorization check
	if existingRecap.UserId != c.AppContext.Session().UserId {
		c.Err = model.NewAppError("resumeScheduledRecap", "api.scheduled_recap.permission_denied", nil, "", http.StatusForbidden)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventResumeScheduledRecap, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddEventObjectType("scheduled_recap")
	model.AddEventParameterToAuditRec(auditRec, "scheduled_recap_id", c.Params.ScheduledRecapId)
	auditRec.AddEventPriorState(existingRecap)

	resumedRecap, err := c.App.ResumeScheduledRecap(c.AppContext, c.Params.ScheduledRecapId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(resumedRecap)

	if err := json.NewEncoder(w).Encode(resumedRecap); err != nil {
		c.Logger.Warn("Error encoding response", mlog.Err(err))
	}
}
