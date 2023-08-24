// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost-server/v6/audit"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

func (api *API) InitWebhook() {
	api.BaseRoutes.IncomingHooks.Handle("", api.APISessionRequired(createIncomingHook)).Methods("POST")
	api.BaseRoutes.IncomingHooks.Handle("", api.APISessionRequired(getIncomingHooks)).Methods("GET")
	api.BaseRoutes.IncomingHook.Handle("", api.APISessionRequired(getIncomingHook)).Methods("GET")
	api.BaseRoutes.IncomingHook.Handle("", api.APISessionRequired(updateIncomingHook)).Methods("PUT")
	api.BaseRoutes.IncomingHook.Handle("", api.APISessionRequired(deleteIncomingHook)).Methods("DELETE")

	api.BaseRoutes.OutgoingHooks.Handle("", api.APISessionRequired(createOutgoingHook)).Methods("POST")
	api.BaseRoutes.OutgoingHooks.Handle("", api.APISessionRequired(getOutgoingHooks)).Methods("GET")
	api.BaseRoutes.OutgoingHook.Handle("", api.APISessionRequired(getOutgoingHook)).Methods("GET")
	api.BaseRoutes.OutgoingHook.Handle("", api.APISessionRequired(updateOutgoingHook)).Methods("PUT")
	api.BaseRoutes.OutgoingHook.Handle("", api.APISessionRequired(deleteOutgoingHook)).Methods("DELETE")
	api.BaseRoutes.OutgoingHook.Handle("/regen_token", api.APISessionRequired(regenOutgoingHookToken)).Methods("POST")
}

func createIncomingHook(c *Context, w http.ResponseWriter, r *http.Request) {
	var hook model.IncomingWebhook
	if jsonErr := json.NewDecoder(r.Body).Decode(&hook); jsonErr != nil {
		c.SetInvalidParamWithErr("incoming_webhook", jsonErr)
		return
	}

	channel, err := c.App.GetChannel(c.AppContext, hook.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec := c.MakeAuditRecord("createIncomingHook", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameterAuditable(auditRec, "incoming_webhook", &hook)
	audit.AddEventParameterAuditable(auditRec, "channel", channel)
	c.LogAudit("attempt")

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), channel.TeamId, model.PermissionManageIncomingWebhooks) {
		c.SetPermissionError(model.PermissionManageIncomingWebhooks)
		return
	}

	if channel.Type != model.ChannelTypeOpen && !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channel.Id, model.PermissionReadChannelContent) {
		c.LogAudit("fail - bad channel permissions")
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	userId := c.AppContext.Session().UserId
	if hook.UserId != "" && hook.UserId != userId {
		if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), channel.TeamId, model.PermissionManageOthersIncomingWebhooks) {
			c.LogAudit("fail - inappropriate permissions")
			c.SetPermissionError(model.PermissionManageOthersIncomingWebhooks)
			return
		}

		if _, err = c.App.GetUser(hook.UserId); err != nil {
			c.Err = err
			return
		}

		userId = hook.UserId
	}

	incomingHook, err := c.App.CreateIncomingWebhookForChannel(userId, channel, &hook)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(incomingHook)
	auditRec.AddEventObjectType("hook")
	c.LogAudit("success")

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(incomingHook); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func updateIncomingHook(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireHookId()
	if c.Err != nil {
		return
	}

	var updatedHook model.IncomingWebhook
	if jsonErr := json.NewDecoder(r.Body).Decode(&updatedHook); jsonErr != nil {
		c.SetInvalidParamWithErr("incoming_webhook", jsonErr)
		return
	}

	// The hook being updated in the payload must be the same one as indicated in the URL.
	if updatedHook.Id != c.Params.HookId {
		c.SetInvalidParam("hook_id")
		return
	}

	auditRec := c.MakeAuditRecord("updateIncomingHook", audit.Fail)
	audit.AddEventParameter(auditRec, "hook_id", c.Params.HookId)
	audit.AddEventParameterAuditable(auditRec, "updated_hook", &updatedHook)
	defer c.LogAuditRec(auditRec)
	c.LogAudit("attempt")

	oldHook, err := c.App.GetIncomingWebhook(c.Params.HookId)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.AddEventPriorState(oldHook)
	auditRec.AddEventObjectType("incoming_webhook")

	if updatedHook.TeamId == "" {
		updatedHook.TeamId = oldHook.TeamId
	}

	if updatedHook.TeamId != oldHook.TeamId {
		c.Err = model.NewAppError("updateIncomingHook", "api.webhook.team_mismatch.app_error", nil, "user_id="+c.AppContext.Session().UserId, http.StatusBadRequest)
		return
	}

	channel, err := c.App.GetChannel(c.AppContext, updatedHook.ChannelId)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.AddMeta("channel_id", channel.Id)
	auditRec.AddMeta("channel_name", channel.Name)

	if channel.TeamId != updatedHook.TeamId {
		c.SetInvalidParam("channel_id")
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), channel.TeamId, model.PermissionManageIncomingWebhooks) {
		c.SetPermissionError(model.PermissionManageIncomingWebhooks)
		return
	}

	if c.AppContext.Session().UserId != oldHook.UserId && !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), channel.TeamId, model.PermissionManageOthersIncomingWebhooks) {
		c.LogAudit("fail - inappropriate permissions")
		c.SetPermissionError(model.PermissionManageOthersIncomingWebhooks)
		return
	}

	if channel.Type != model.ChannelTypeOpen && !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channel.Id, model.PermissionReadChannelContent) {
		c.LogAudit("fail - bad channel permissions")
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	incomingHook, err := c.App.UpdateIncomingWebhook(oldHook, &updatedHook)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.AddEventResultState(incomingHook)
	auditRec.Success()
	c.LogAudit("success")

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(incomingHook); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getIncomingHooks(c *Context, w http.ResponseWriter, r *http.Request) {
	var (
		teamID = r.URL.Query().Get("team_id")
		userID = c.AppContext.Session().UserId

		hooks  []*model.IncomingWebhook
		appErr *model.AppError
	)

	if teamID != "" {
		if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), teamID, model.PermissionManageIncomingWebhooks) {
			c.SetPermissionError(model.PermissionManageIncomingWebhooks)
			return
		}

		// Remove userId as a filter if they have permission to manage others.
		if c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), teamID, model.PermissionManageOthersIncomingWebhooks) {
			userID = ""
		}

		hooks, appErr = c.App.GetIncomingWebhooksForTeamPageByUser(teamID, userID, c.Params.Page, c.Params.PerPage)
	} else {
		if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageIncomingWebhooks) {
			c.SetPermissionError(model.PermissionManageIncomingWebhooks)
			return
		}

		// Remove userId as a filter if they have permission to manage others.
		if c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageOthersIncomingWebhooks) {
			userID = ""
		}

		hooks, appErr = c.App.GetIncomingWebhooksPageByUser(userID, c.Params.Page, c.Params.PerPage)
	}

	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(hooks)
	if err != nil {
		c.Err = model.NewAppError("getIncomingHooks", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.Write(js)
}

func getIncomingHook(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireHookId()
	if c.Err != nil {
		return
	}

	hookId := c.Params.HookId

	var err *model.AppError
	var hook *model.IncomingWebhook
	var channel *model.Channel

	hook, err = c.App.GetIncomingWebhook(hookId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec := c.MakeAuditRecord("getIncomingHook", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "hook_id", c.Params.HookId)
	auditRec.AddMeta("hook_id", hook.Id)
	auditRec.AddMeta("hook_display", hook.DisplayName)
	auditRec.AddMeta("channel_id", hook.ChannelId)
	auditRec.AddMeta("team_id", hook.TeamId)
	c.LogAudit("attempt")

	channel, err = c.App.GetChannel(c.AppContext, hook.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), hook.TeamId, model.PermissionManageIncomingWebhooks) ||
		(channel.Type != model.ChannelTypeOpen && !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), hook.ChannelId, model.PermissionReadChannelContent)) {
		c.LogAudit("fail - bad permissions")
		c.SetPermissionError(model.PermissionManageIncomingWebhooks)
		return
	}

	if c.AppContext.Session().UserId != hook.UserId && !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), hook.TeamId, model.PermissionManageOthersIncomingWebhooks) {
		c.LogAudit("fail - inappropriate permissions")
		c.SetPermissionError(model.PermissionManageOthersIncomingWebhooks)
		return
	}

	auditRec.Success()
	c.LogAudit("success")

	if err := json.NewEncoder(w).Encode(hook); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deleteIncomingHook(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireHookId()
	if c.Err != nil {
		return
	}

	hookId := c.Params.HookId

	var err *model.AppError
	var hook *model.IncomingWebhook
	var channel *model.Channel

	hook, err = c.App.GetIncomingWebhook(hookId)
	if err != nil {
		c.Err = err
		return
	}

	channel, err = c.App.GetChannel(c.AppContext, hook.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec := c.MakeAuditRecord("deleteIncomingHook", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "hook_id", c.Params.HookId)
	auditRec.AddMeta("hook_id", hook.Id)
	auditRec.AddMeta("hook_display", hook.DisplayName)
	auditRec.AddMeta("channel_id", channel.Id)
	auditRec.AddMeta("channel_name", channel.Name)
	auditRec.AddMeta("team_id", hook.TeamId)

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), hook.TeamId, model.PermissionManageIncomingWebhooks) ||
		(channel.Type != model.ChannelTypeOpen && !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), hook.ChannelId, model.PermissionReadChannelContent)) {
		c.LogAudit("fail - bad permissions")
		c.SetPermissionError(model.PermissionManageIncomingWebhooks)
		return
	}

	if c.AppContext.Session().UserId != hook.UserId && !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), hook.TeamId, model.PermissionManageOthersIncomingWebhooks) {
		c.LogAudit("fail - inappropriate permissions")
		c.SetPermissionError(model.PermissionManageOthersIncomingWebhooks)
		return
	}

	if err = c.App.DeleteIncomingWebhook(hookId); err != nil {
		c.Err = err
		return
	}

	auditRec.AddEventPriorState(hook)
	auditRec.AddEventObjectType("incoming_webhook")
	auditRec.Success()
	ReturnStatusOK(w)
}

func updateOutgoingHook(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireHookId()
	if c.Err != nil {
		return
	}

	var updatedHook model.OutgoingWebhook
	if jsonErr := json.NewDecoder(r.Body).Decode(&updatedHook); jsonErr != nil {
		c.SetInvalidParamWithErr("outgoing_webhook", jsonErr)
		return
	}

	// The hook being updated in the payload must be the same one as indicated in the URL.
	if updatedHook.Id != c.Params.HookId {
		c.SetInvalidParam("hook_id")
		return
	}

	auditRec := c.MakeAuditRecord("updateOutgoingHook", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameterAuditable(auditRec, "updated_hook", &updatedHook)
	c.LogAudit("attempt")

	oldHook, err := c.App.GetOutgoingWebhook(c.Params.HookId)
	if err != nil {
		c.Err = err
		return
	}

	if updatedHook.TeamId == "" {
		updatedHook.TeamId = oldHook.TeamId
	}

	if updatedHook.TeamId != oldHook.TeamId {
		c.Err = model.NewAppError("updateOutgoingHook", "api.webhook.team_mismatch.app_error", nil, "user_id="+c.AppContext.Session().UserId, http.StatusBadRequest)
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), updatedHook.TeamId, model.PermissionManageOutgoingWebhooks) {
		c.SetPermissionError(model.PermissionManageOutgoingWebhooks)
		return
	}

	if c.AppContext.Session().UserId != oldHook.CreatorId && !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), updatedHook.TeamId, model.PermissionManageOthersOutgoingWebhooks) {
		c.LogAudit("fail - inappropriate permissions")
		c.SetPermissionError(model.PermissionManageOthersOutgoingWebhooks)
		return
	}

	updatedHook.CreatorId = c.AppContext.Session().UserId

	rhook, err := c.App.UpdateOutgoingWebhook(c.AppContext, oldHook, &updatedHook)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("success")

	if err := json.NewEncoder(w).Encode(rhook); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func createOutgoingHook(c *Context, w http.ResponseWriter, r *http.Request) {
	var hook model.OutgoingWebhook
	if jsonErr := json.NewDecoder(r.Body).Decode(&hook); jsonErr != nil {
		c.SetInvalidParamWithErr("outgoing_webhook", jsonErr)
		return
	}

	auditRec := c.MakeAuditRecord("createOutgoingHook", audit.Fail)
	audit.AddEventParameterAuditable(auditRec, "hook", &hook)
	defer c.LogAuditRec(auditRec)
	c.LogAudit("attempt")

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), hook.TeamId, model.PermissionManageOutgoingWebhooks) {
		c.SetPermissionError(model.PermissionManageOutgoingWebhooks)
		return
	}

	if hook.CreatorId == "" {
		hook.CreatorId = c.AppContext.Session().UserId
	} else {
		if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), hook.TeamId, model.PermissionManageOthersOutgoingWebhooks) {
			c.LogAudit("fail - inappropriate permissions")
			c.SetPermissionError(model.PermissionManageOthersOutgoingWebhooks)
			return
		}

		_, err := c.App.GetUser(hook.CreatorId)
		if err != nil {
			c.Err = err
			return
		}
	}

	rhook, err := c.App.CreateOutgoingWebhook(&hook)
	if err != nil {
		c.LogAudit("fail")
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(rhook)
	auditRec.AddEventObjectType("outgoing_webhook")
	c.LogAudit("success")

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(rhook); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getOutgoingHooks(c *Context, w http.ResponseWriter, r *http.Request) {
	var (
		query     = r.URL.Query()
		channelID = query.Get("channel_id")
		teamID    = query.Get("team_id")
		userID    = c.AppContext.Session().UserId

		hooks  []*model.OutgoingWebhook
		appErr *model.AppError
	)

	if channelID != "" {
		if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channelID, model.PermissionManageOutgoingWebhooks) {
			c.SetPermissionError(model.PermissionManageOutgoingWebhooks)
			return
		}

		// Remove userId as a filter if they have permission to manage others.
		if c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channelID, model.PermissionManageOthersOutgoingWebhooks) {
			userID = ""
		}

		hooks, appErr = c.App.GetOutgoingWebhooksForChannelPageByUser(channelID, userID, c.Params.Page, c.Params.PerPage)
	} else if teamID != "" {
		if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), teamID, model.PermissionManageOutgoingWebhooks) {
			c.SetPermissionError(model.PermissionManageOutgoingWebhooks)
			return
		}

		// Remove userId as a filter if they have permission to manage others.
		if c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), teamID, model.PermissionManageOthersOutgoingWebhooks) {
			userID = ""
		}

		hooks, appErr = c.App.GetOutgoingWebhooksForTeamPageByUser(teamID, userID, c.Params.Page, c.Params.PerPage)
	} else {
		if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageOutgoingWebhooks) {
			c.SetPermissionError(model.PermissionManageOutgoingWebhooks)
			return
		}

		// Remove userId as a filter if they have permission to manage others.
		if c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageOthersOutgoingWebhooks) {
			userID = ""
		}

		hooks, appErr = c.App.GetOutgoingWebhooksPageByUser(userID, c.Params.Page, c.Params.PerPage)
	}

	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(hooks)
	if err != nil {
		c.Err = model.NewAppError("getOutgoingHooks", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.Write(js)
}

func getOutgoingHook(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireHookId()
	if c.Err != nil {
		return
	}

	hook, err := c.App.GetOutgoingWebhook(c.Params.HookId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec := c.MakeAuditRecord("getOutgoingHook", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "hook_id", c.Params.HookId)
	auditRec.AddMeta("hook_id", hook.Id)
	auditRec.AddMeta("hook_display", hook.DisplayName)
	auditRec.AddMeta("channel_id", hook.ChannelId)
	auditRec.AddMeta("team_id", hook.TeamId)
	c.LogAudit("attempt")

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), hook.TeamId, model.PermissionManageOutgoingWebhooks) {
		c.SetPermissionError(model.PermissionManageOutgoingWebhooks)
		return
	}

	if c.AppContext.Session().UserId != hook.CreatorId && !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), hook.TeamId, model.PermissionManageOthersOutgoingWebhooks) {
		c.LogAudit("fail - inappropriate permissions")
		c.SetPermissionError(model.PermissionManageOthersOutgoingWebhooks)
		return
	}

	auditRec.Success()
	c.LogAudit("success")

	if err := json.NewEncoder(w).Encode(hook); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func regenOutgoingHookToken(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireHookId()
	if c.Err != nil {
		return
	}

	hook, err := c.App.GetOutgoingWebhook(c.Params.HookId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec := c.MakeAuditRecord("regenOutgoingHookToken", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("hook_id", hook.Id)
	auditRec.AddMeta("hook_display", hook.DisplayName)
	auditRec.AddMeta("channel_id", hook.ChannelId)
	auditRec.AddMeta("team_id", hook.TeamId)
	c.LogAudit("attempt")

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), hook.TeamId, model.PermissionManageOutgoingWebhooks) {
		c.SetPermissionError(model.PermissionManageOutgoingWebhooks)
		return
	}

	if c.AppContext.Session().UserId != hook.CreatorId && !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), hook.TeamId, model.PermissionManageOthersOutgoingWebhooks) {
		c.LogAudit("fail - inappropriate permissions")
		c.SetPermissionError(model.PermissionManageOthersOutgoingWebhooks)
		return
	}

	rhook, err := c.App.RegenOutgoingWebhookToken(hook)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.AddEventResultState(rhook)
	auditRec.AddEventObjectType("outgoing_webhook")
	auditRec.Success()
	c.LogAudit("success")

	if err := json.NewEncoder(w).Encode(rhook); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deleteOutgoingHook(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireHookId()
	if c.Err != nil {
		return
	}

	hook, err := c.App.GetOutgoingWebhook(c.Params.HookId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec := c.MakeAuditRecord("deleteOutgoingHook", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "hook_id", c.Params.HookId)
	auditRec.AddMeta("hook_id", hook.Id)
	auditRec.AddMeta("hook_display", hook.DisplayName)
	auditRec.AddMeta("channel_id", hook.ChannelId)
	auditRec.AddMeta("team_id", hook.TeamId)
	c.LogAudit("attempt")

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), hook.TeamId, model.PermissionManageOutgoingWebhooks) {
		c.SetPermissionError(model.PermissionManageOutgoingWebhooks)
		return
	}

	if c.AppContext.Session().UserId != hook.CreatorId && !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), hook.TeamId, model.PermissionManageOthersOutgoingWebhooks) {
		c.LogAudit("fail - inappropriate permissions")
		c.SetPermissionError(model.PermissionManageOthersOutgoingWebhooks)
		return
	}

	if err := c.App.DeleteOutgoingWebhook(hook.Id); err != nil {
		c.LogAudit("fail")
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("success")

	ReturnStatusOK(w)
}
