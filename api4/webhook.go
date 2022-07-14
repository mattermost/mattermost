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
		c.SetInvalidParam("incoming_webhook")
		return
	}

	channel, err := c.App.GetChannel(c.AppContext, hook.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec := c.MakeAuditRecord("createIncomingHook", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("channel", channel)
	c.LogAudit("attempt")

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), channel.TeamId, model.PermissionManageIncomingWebhooks) {
		c.SetPermissionError(model.PermissionManageIncomingWebhooks)
		return
	}

	if channel.Type != model.ChannelTypeOpen && !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channel.Id, model.PermissionReadChannel) {
		c.LogAudit("fail - bad channel permissions")
		c.SetPermissionError(model.PermissionReadChannel)
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
	auditRec.AddMeta("hook", incomingHook)
	c.LogAudit("success")

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(incomingHook); err != nil {
		mlog.Warn("Error while writing response", mlog.Err(err))
	}
}

func updateIncomingHook(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireHookId()
	if c.Err != nil {
		return
	}

	var updatedHook model.IncomingWebhook
	if jsonErr := json.NewDecoder(r.Body).Decode(&updatedHook); jsonErr != nil {
		c.SetInvalidParam("incoming_webhook")
		return
	}

	// The hook being updated in the payload must be the same one as indicated in the URL.
	if updatedHook.Id != c.Params.HookId {
		c.SetInvalidParam("hook_id")
		return
	}

	auditRec := c.MakeAuditRecord("updateIncomingHook", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("hook_id", c.Params.HookId)
	c.LogAudit("attempt")

	oldHook, err := c.App.GetIncomingWebhook(c.Params.HookId)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.AddMeta("team_id", oldHook.TeamId)

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

	if channel.Type != model.ChannelTypeOpen && !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channel.Id, model.PermissionReadChannel) {
		c.LogAudit("fail - bad channel permissions")
		c.SetPermissionError(model.PermissionReadChannel)
		return
	}

	incomingHook, err := c.App.UpdateIncomingWebhook(oldHook, &updatedHook)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("success")

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(incomingHook); err != nil {
		mlog.Warn("Error while writing response", mlog.Err(err))
	}
}

func getIncomingHooks(c *Context, w http.ResponseWriter, r *http.Request) {
	teamId := r.URL.Query().Get("team_id")
	userId := c.AppContext.Session().UserId

	var hooks []*model.IncomingWebhook
	var err *model.AppError

	if teamId != "" {
		if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), teamId, model.PermissionManageIncomingWebhooks) {
			c.SetPermissionError(model.PermissionManageIncomingWebhooks)
			return
		}

		// Remove userId as a filter if they have permission to manage others.
		if c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), teamId, model.PermissionManageOthersIncomingWebhooks) {
			userId = ""
		}

		hooks, err = c.App.GetIncomingWebhooksForTeamPageByUser(teamId, userId, c.Params.Page, c.Params.PerPage)
	} else {
		if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageIncomingWebhooks) {
			c.SetPermissionError(model.PermissionManageIncomingWebhooks)
			return
		}

		// Remove userId as a filter if they have permission to manage others.
		if c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageOthersIncomingWebhooks) {
			userId = ""
		}

		hooks, err = c.App.GetIncomingWebhooksPageByUser(userId, c.Params.Page, c.Params.PerPage)
	}

	if err != nil {
		c.Err = err
		return
	}

	js, jsonErr := json.Marshal(hooks)
	if jsonErr != nil {
		c.Err = model.NewAppError("getIncomingHooks", "api.marshal_error", nil, jsonErr.Error(), http.StatusInternalServerError)
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
		(channel.Type != model.ChannelTypeOpen && !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), hook.ChannelId, model.PermissionReadChannel)) {
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
		mlog.Warn("Error while writing response", mlog.Err(err))
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
	auditRec.AddMeta("hook_id", hook.Id)
	auditRec.AddMeta("hook_display", hook.DisplayName)
	auditRec.AddMeta("channel_id", channel.Id)
	auditRec.AddMeta("channel_name", channel.Name)
	auditRec.AddMeta("team_id", hook.TeamId)

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), hook.TeamId, model.PermissionManageIncomingWebhooks) ||
		(channel.Type != model.ChannelTypeOpen && !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), hook.ChannelId, model.PermissionReadChannel)) {
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
		c.SetInvalidParam("outgoing_webhook")
		return
	}

	// The hook being updated in the payload must be the same one as indicated in the URL.
	if updatedHook.Id != c.Params.HookId {
		c.SetInvalidParam("hook_id")
		return
	}

	auditRec := c.MakeAuditRecord("updateOutgoingHook", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("hook_id", updatedHook.Id)
	auditRec.AddMeta("hook_display", updatedHook.DisplayName)
	auditRec.AddMeta("channel_id", updatedHook.ChannelId)
	auditRec.AddMeta("team_id", updatedHook.TeamId)
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
		mlog.Warn("Error while writing response", mlog.Err(err))
	}
}

func createOutgoingHook(c *Context, w http.ResponseWriter, r *http.Request) {
	var hook model.OutgoingWebhook
	if jsonErr := json.NewDecoder(r.Body).Decode(&hook); jsonErr != nil {
		c.SetInvalidParam("outgoing_webhook")
		return
	}

	auditRec := c.MakeAuditRecord("createOutgoingHook", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("hook_id", hook.Id)
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
	auditRec.AddMeta("hook_display", rhook.DisplayName)
	auditRec.AddMeta("channel_id", rhook.ChannelId)
	auditRec.AddMeta("team_id", rhook.TeamId)
	c.LogAudit("success")

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(rhook); err != nil {
		mlog.Warn("Error while writing response", mlog.Err(err))
	}
}

func getOutgoingHooks(c *Context, w http.ResponseWriter, r *http.Request) {
	channelId := r.URL.Query().Get("channel_id")
	teamId := r.URL.Query().Get("team_id")
	userId := c.AppContext.Session().UserId

	var hooks []*model.OutgoingWebhook
	var err *model.AppError

	if channelId != "" {
		if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channelId, model.PermissionManageOutgoingWebhooks) {
			c.SetPermissionError(model.PermissionManageOutgoingWebhooks)
			return
		}

		// Remove userId as a filter if they have permission to manage others.
		if c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channelId, model.PermissionManageOthersOutgoingWebhooks) {
			userId = ""
		}

		hooks, err = c.App.GetOutgoingWebhooksForChannelPageByUser(channelId, userId, c.Params.Page, c.Params.PerPage)
	} else if teamId != "" {
		if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), teamId, model.PermissionManageOutgoingWebhooks) {
			c.SetPermissionError(model.PermissionManageOutgoingWebhooks)
			return
		}

		// Remove userId as a filter if they have permission to manage others.
		if c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), teamId, model.PermissionManageOthersOutgoingWebhooks) {
			userId = ""
		}

		hooks, err = c.App.GetOutgoingWebhooksForTeamPageByUser(teamId, userId, c.Params.Page, c.Params.PerPage)
	} else {
		if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageOutgoingWebhooks) {
			c.SetPermissionError(model.PermissionManageOutgoingWebhooks)
			return
		}

		// Remove userId as a filter if they have permission to manage others.
		if c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageOthersOutgoingWebhooks) {
			userId = ""
		}

		hooks, err = c.App.GetOutgoingWebhooksPageByUser(userId, c.Params.Page, c.Params.PerPage)
	}

	if err != nil {
		c.Err = err
		return
	}

	js, jsonErr := json.Marshal(hooks)
	if jsonErr != nil {
		c.Err = model.NewAppError("getOutgoingHooks", "api.marshal_error", nil, jsonErr.Error(), http.StatusInternalServerError)
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
		mlog.Warn("Error while writing response", mlog.Err(err))
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

	auditRec.Success()
	c.LogAudit("success")

	if err := json.NewEncoder(w).Encode(rhook); err != nil {
		mlog.Warn("Error while writing response", mlog.Err(err))
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
