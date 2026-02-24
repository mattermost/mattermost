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

func (api *API) InitRecap() {
	api.BaseRoutes.Recaps.Handle("", api.APISessionRequired(createRecap)).Methods(http.MethodPost)
	api.BaseRoutes.Recaps.Handle("", api.APISessionRequired(getRecaps)).Methods(http.MethodGet)
	api.BaseRoutes.Recaps.Handle("/{recap_id:[A-Za-z0-9]+}", api.APISessionRequired(getRecap)).Methods(http.MethodGet)
	api.BaseRoutes.Recaps.Handle("/{recap_id:[A-Za-z0-9]+}/read", api.APISessionRequired(markRecapAsRead)).Methods(http.MethodPost)
	api.BaseRoutes.Recaps.Handle("/{recap_id:[A-Za-z0-9]+}/regenerate", api.APISessionRequired(regenerateRecap)).Methods(http.MethodPost)
	api.BaseRoutes.Recaps.Handle("/{recap_id:[A-Za-z0-9]+}", api.APISessionRequired(deleteRecap)).Methods(http.MethodDelete)
}

func requireRecapsEnabled(c *Context) {
	if !c.App.Config().FeatureFlags.EnableAIRecaps {
		c.Err = model.NewAppError("requireRecapsEnabled", "api.recap.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}
}

// addRecapChannelIDsToAuditRec extracts channel IDs from a recap and adds them to the audit record.
// This logs which channels' content was accessed through the recap operation.
func addRecapChannelIDsToAuditRec(auditRec *model.AuditRecord, recap *model.Recap) {
	if len(recap.Channels) == 0 {
		return
	}
	channelIDs := make([]string, 0, len(recap.Channels))
	for _, channel := range recap.Channels {
		channelIDs = append(channelIDs, channel.ChannelId)
	}
	model.AddEventParameterToAuditRec(auditRec, "channel_ids", channelIDs)
}

func createRecap(c *Context, w http.ResponseWriter, r *http.Request) {
	requireRecapsEnabled(c)
	if c.Err != nil {
		return
	}

	var req model.CreateRecapRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		c.SetInvalidParamWithErr("body", err)
		return
	}

	if len(req.ChannelIds) == 0 {
		c.SetInvalidParam("channel_ids")
		return
	}

	if req.Title == "" {
		c.SetInvalidParam("title")
		return
	}

	if req.AgentID == "" {
		c.SetInvalidParam("agent_id")
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventCreateRecap, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddEventObjectType("recap")
	model.AddEventParameterToAuditRec(auditRec, "channel_ids", req.ChannelIds)
	model.AddEventParameterToAuditRec(auditRec, "title", req.Title)
	model.AddEventParameterToAuditRec(auditRec, "agent_id", req.AgentID)

	recap, err := c.App.CreateRecap(c.AppContext, req.Title, req.ChannelIds, req.AgentID)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(recap)

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(recap); err != nil {
		c.Logger.Warn("Error encoding response", mlog.Err(err))
	}
}

func getRecap(c *Context, w http.ResponseWriter, r *http.Request) {
	requireRecapsEnabled(c)
	if c.Err != nil {
		return
	}

	c.RequireRecapId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventGetRecap, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddEventObjectType("recap")
	model.AddEventParameterToAuditRec(auditRec, "recap_id", c.Params.RecapId)

	recap, err := c.App.GetRecap(c.AppContext, c.Params.RecapId)
	if err != nil {
		c.Err = err
		return
	}

	if recap.UserId != c.AppContext.Session().UserId {
		c.Err = model.NewAppError("getRecap", "api.recap.permission_denied", nil, "", http.StatusForbidden)
		return
	}

	// Log channel IDs accessed through viewing this recap summary
	addRecapChannelIDsToAuditRec(auditRec, recap)

	auditRec.Success()
	auditRec.AddEventResultState(recap)

	if err := json.NewEncoder(w).Encode(recap); err != nil {
		c.Logger.Warn("Error encoding response", mlog.Err(err))
	}
}

func getRecaps(c *Context, w http.ResponseWriter, r *http.Request) {
	requireRecapsEnabled(c)
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventGetRecaps, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelAPI)
	model.AddEventParameterToAuditRec(auditRec, "page", c.Params.Page)
	model.AddEventParameterToAuditRec(auditRec, "per_page", c.Params.PerPage)

	recaps, err := c.App.GetRecapsForUser(c.AppContext, c.Params.Page, c.Params.PerPage)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	if len(recaps) > 0 {
		auditRec.AddMeta("recap_count", len(recaps))
	}

	if err := json.NewEncoder(w).Encode(recaps); err != nil {
		c.Logger.Warn("Error encoding response", mlog.Err(err))
	}
}

func markRecapAsRead(c *Context, w http.ResponseWriter, r *http.Request) {
	requireRecapsEnabled(c)
	if c.Err != nil {
		return
	}

	c.RequireRecapId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventMarkRecapAsRead, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddEventObjectType("recap")
	model.AddEventParameterToAuditRec(auditRec, "recap_id", c.Params.RecapId)

	// Check permissions
	recap, err := c.App.GetRecap(c.AppContext, c.Params.RecapId)
	if err != nil {
		c.Err = err
		return
	}

	if recap.UserId != c.AppContext.Session().UserId {
		c.Err = model.NewAppError("markRecapAsRead", "api.recap.permission_denied", nil, "", http.StatusForbidden)
		return
	}

	auditRec.AddEventPriorState(recap)

	updatedRecap, err := c.App.MarkRecapAsRead(c.AppContext, recap)
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

func regenerateRecap(c *Context, w http.ResponseWriter, r *http.Request) {
	requireRecapsEnabled(c)
	if c.Err != nil {
		return
	}

	c.RequireRecapId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventRegenerateRecap, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddEventObjectType("recap")
	model.AddEventParameterToAuditRec(auditRec, "recap_id", c.Params.RecapId)

	// Check permissions
	recap, err := c.App.GetRecap(c.AppContext, c.Params.RecapId)
	if err != nil {
		c.Err = err
		return
	}

	if recap.UserId != c.AppContext.Session().UserId {
		c.Err = model.NewAppError("regenerateRecap", "api.recap.permission_denied", nil, "", http.StatusForbidden)
		return
	}

	// Log channel IDs that will be re-summarized
	addRecapChannelIDsToAuditRec(auditRec, recap)

	auditRec.AddEventPriorState(recap)

	updatedRecap, err := c.App.RegenerateRecap(c.AppContext, c.AppContext.Session().UserId, recap)
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

func deleteRecap(c *Context, w http.ResponseWriter, r *http.Request) {
	requireRecapsEnabled(c)
	if c.Err != nil {
		return
	}

	c.RequireRecapId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventDeleteRecap, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddEventObjectType("recap")
	model.AddEventParameterToAuditRec(auditRec, "recap_id", c.Params.RecapId)

	// Check permissions
	recap, err := c.App.GetRecap(c.AppContext, c.Params.RecapId)
	if err != nil {
		c.Err = err
		return
	}

	if recap.UserId != c.AppContext.Session().UserId {
		c.Err = model.NewAppError("deleteRecap", "api.recap.permission_denied", nil, "", http.StatusForbidden)
		return
	}

	auditRec.AddEventPriorState(recap)

	if err := c.App.DeleteRecap(c.AppContext, c.Params.RecapId); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}
