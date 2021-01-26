// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v5/audit"
	"github.com/mattermost/mattermost-server/v5/model"
)

func (api *API) InitWebhook() {
	api.BaseRoutes.IncomingHooks.Handle("", api.ApiSessionRequired(createIncomingHook)).Methods("POST")
	api.BaseRoutes.IncomingHooks.Handle("", api.ApiSessionRequired(getIncomingHooks)).Methods("GET")
	api.BaseRoutes.IncomingHook.Handle("", api.ApiSessionRequired(getIncomingHook)).Methods("GET")
	api.BaseRoutes.IncomingHook.Handle("", api.ApiSessionRequired(updateIncomingHook)).Methods("PUT")
	api.BaseRoutes.IncomingHook.Handle("", api.ApiSessionRequired(deleteIncomingHook)).Methods("DELETE")

	api.BaseRoutes.OutgoingHooks.Handle("", api.ApiSessionRequired(createOutgoingHook)).Methods("POST")
	api.BaseRoutes.OutgoingHooks.Handle("", api.ApiSessionRequired(getOutgoingHooks)).Methods("GET")
	api.BaseRoutes.OutgoingHook.Handle("", api.ApiSessionRequired(getOutgoingHook)).Methods("GET")
	api.BaseRoutes.OutgoingHook.Handle("", api.ApiSessionRequired(updateOutgoingHook)).Methods("PUT")
	api.BaseRoutes.OutgoingHook.Handle("", api.ApiSessionRequired(deleteOutgoingHook)).Methods("DELETE")
	api.BaseRoutes.OutgoingHook.Handle("/regen_token", api.ApiSessionRequired(regenOutgoingHookToken)).Methods("POST")
}

func createIncomingHook(c *Context, w http.ResponseWriter, r *http.Request) {
	hook := model.IncomingWebhookFromJson(r.Body)
	if hook == nil {
		c.SetInvalidParam("incoming_webhook")
		return
	}

	channel, err := c.App.GetChannel(hook.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec := c.MakeAuditRecord("createIncomingHook", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("channel", channel)
	c.LogAudit("attempt")

	if !c.App.SessionHasPermissionToTeam(*c.App.Session(), channel.TeamId, model.PERMISSION_MANAGE_INCOMING_WEBHOOKS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_INCOMING_WEBHOOKS)
		return
	}

	if channel.Type != model.CHANNEL_OPEN && !c.App.SessionHasPermissionToChannel(*c.App.Session(), channel.Id, model.PERMISSION_READ_CHANNEL) {
		c.LogAudit("fail - bad channel permissions")
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	userId := c.App.Session().UserId
	if hook.UserId != "" && hook.UserId != userId {
		if !c.App.SessionHasPermissionToTeam(*c.App.Session(), channel.TeamId, model.PERMISSION_MANAGE_OTHERS_INCOMING_WEBHOOKS) {
			c.LogAudit("fail - innapropriate permissions")
			c.SetPermissionError(model.PERMISSION_MANAGE_OTHERS_INCOMING_WEBHOOKS)
			return
		}

		if _, err = c.App.GetUser(hook.UserId); err != nil {
			c.Err = err
			return
		}

		userId = hook.UserId
	}

	incomingHook, err := c.App.CreateIncomingWebhookForChannel(userId, channel, hook)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddMeta("hook", incomingHook)
	c.LogAudit("success")

	w.WriteHeader(http.StatusCreated)
	w.Write([]byte(incomingHook.ToJson()))
}

func updateIncomingHook(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireHookId()
	if c.Err != nil {
		return
	}

	updatedHook := model.IncomingWebhookFromJson(r.Body)
	if updatedHook == nil {
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
		c.Err = model.NewAppError("updateIncomingHook", "api.webhook.team_mismatch.app_error", nil, "user_id="+c.App.Session().UserId, http.StatusBadRequest)
		return
	}

	channel, err := c.App.GetChannel(updatedHook.ChannelId)
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

	if !c.App.SessionHasPermissionToTeam(*c.App.Session(), channel.TeamId, model.PERMISSION_MANAGE_INCOMING_WEBHOOKS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_INCOMING_WEBHOOKS)
		return
	}

	if c.App.Session().UserId != oldHook.UserId && !c.App.SessionHasPermissionToTeam(*c.App.Session(), channel.TeamId, model.PERMISSION_MANAGE_OTHERS_INCOMING_WEBHOOKS) {
		c.LogAudit("fail - inappropriate permissions")
		c.SetPermissionError(model.PERMISSION_MANAGE_OTHERS_INCOMING_WEBHOOKS)
		return
	}

	if channel.Type != model.CHANNEL_OPEN && !c.App.SessionHasPermissionToChannel(*c.App.Session(), channel.Id, model.PERMISSION_READ_CHANNEL) {
		c.LogAudit("fail - bad channel permissions")
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	incomingHook, err := c.App.UpdateIncomingWebhook(oldHook, updatedHook)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("success")

	w.WriteHeader(http.StatusCreated)
	w.Write([]byte(incomingHook.ToJson()))
}

func getIncomingHooks(c *Context, w http.ResponseWriter, r *http.Request) {
	teamId := r.URL.Query().Get("team_id")
	userId := c.App.Session().UserId

	var hooks []*model.IncomingWebhook
	var err *model.AppError

	if teamId != "" {
		if !c.App.SessionHasPermissionToTeam(*c.App.Session(), teamId, model.PERMISSION_MANAGE_INCOMING_WEBHOOKS) {
			c.SetPermissionError(model.PERMISSION_MANAGE_INCOMING_WEBHOOKS)
			return
		}

		// Remove userId as a filter if they have permission to manage others.
		if c.App.SessionHasPermissionToTeam(*c.App.Session(), teamId, model.PERMISSION_MANAGE_OTHERS_INCOMING_WEBHOOKS) {
			userId = ""
		}

		hooks, err = c.App.GetIncomingWebhooksForTeamPageByUser(teamId, userId, c.Params.Page, c.Params.PerPage)
	} else {
		if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_MANAGE_INCOMING_WEBHOOKS) {
			c.SetPermissionError(model.PERMISSION_MANAGE_INCOMING_WEBHOOKS)
			return
		}

		// Remove userId as a filter if they have permission to manage others.
		if c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_MANAGE_OTHERS_INCOMING_WEBHOOKS) {
			userId = ""
		}

		hooks, err = c.App.GetIncomingWebhooksPageByUser(userId, c.Params.Page, c.Params.PerPage)
	}

	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.IncomingWebhookListToJson(hooks)))
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

	channel, err = c.App.GetChannel(hook.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.App.Session(), hook.TeamId, model.PERMISSION_MANAGE_INCOMING_WEBHOOKS) ||
		(channel.Type != model.CHANNEL_OPEN && !c.App.SessionHasPermissionToChannel(*c.App.Session(), hook.ChannelId, model.PERMISSION_READ_CHANNEL)) {
		c.LogAudit("fail - bad permissions")
		c.SetPermissionError(model.PERMISSION_MANAGE_INCOMING_WEBHOOKS)
		return
	}

	if c.App.Session().UserId != hook.UserId && !c.App.SessionHasPermissionToTeam(*c.App.Session(), hook.TeamId, model.PERMISSION_MANAGE_OTHERS_INCOMING_WEBHOOKS) {
		c.LogAudit("fail - inappropriate permissions")
		c.SetPermissionError(model.PERMISSION_MANAGE_OTHERS_INCOMING_WEBHOOKS)
		return
	}

	auditRec.Success()
	c.LogAudit("success")

	w.Write([]byte(hook.ToJson()))
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

	channel, err = c.App.GetChannel(hook.ChannelId)
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

	if !c.App.SessionHasPermissionToTeam(*c.App.Session(), hook.TeamId, model.PERMISSION_MANAGE_INCOMING_WEBHOOKS) ||
		(channel.Type != model.CHANNEL_OPEN && !c.App.SessionHasPermissionToChannel(*c.App.Session(), hook.ChannelId, model.PERMISSION_READ_CHANNEL)) {
		c.LogAudit("fail - bad permissions")
		c.SetPermissionError(model.PERMISSION_MANAGE_INCOMING_WEBHOOKS)
		return
	}

	if c.App.Session().UserId != hook.UserId && !c.App.SessionHasPermissionToTeam(*c.App.Session(), hook.TeamId, model.PERMISSION_MANAGE_OTHERS_INCOMING_WEBHOOKS) {
		c.LogAudit("fail - inappropriate permissions")
		c.SetPermissionError(model.PERMISSION_MANAGE_OTHERS_INCOMING_WEBHOOKS)
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

	updatedHook := model.OutgoingWebhookFromJson(r.Body)
	if updatedHook == nil {
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
		c.Err = model.NewAppError("updateOutgoingHook", "api.webhook.team_mismatch.app_error", nil, "user_id="+c.App.Session().UserId, http.StatusBadRequest)
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.App.Session(), updatedHook.TeamId, model.PERMISSION_MANAGE_OUTGOING_WEBHOOKS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_OUTGOING_WEBHOOKS)
		return
	}

	if c.App.Session().UserId != oldHook.CreatorId && !c.App.SessionHasPermissionToTeam(*c.App.Session(), updatedHook.TeamId, model.PERMISSION_MANAGE_OTHERS_OUTGOING_WEBHOOKS) {
		c.LogAudit("fail - inappropriate permissions")
		c.SetPermissionError(model.PERMISSION_MANAGE_OTHERS_OUTGOING_WEBHOOKS)
		return
	}

	updatedHook.CreatorId = c.App.Session().UserId

	rhook, err := c.App.UpdateOutgoingWebhook(oldHook, updatedHook)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("success")

	w.Write([]byte(rhook.ToJson()))
}

func createOutgoingHook(c *Context, w http.ResponseWriter, r *http.Request) {
	hook := model.OutgoingWebhookFromJson(r.Body)
	if hook == nil {
		c.SetInvalidParam("outgoing_webhook")
		return
	}

	auditRec := c.MakeAuditRecord("createOutgoingHook", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("hook_id", hook.Id)
	c.LogAudit("attempt")

	if !c.App.SessionHasPermissionToTeam(*c.App.Session(), hook.TeamId, model.PERMISSION_MANAGE_OUTGOING_WEBHOOKS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_OUTGOING_WEBHOOKS)
		return
	}

	if hook.CreatorId == "" {
		hook.CreatorId = c.App.Session().UserId
	} else {
		if !c.App.SessionHasPermissionToTeam(*c.App.Session(), hook.TeamId, model.PERMISSION_MANAGE_OTHERS_OUTGOING_WEBHOOKS) {
			c.LogAudit("fail - innapropriate permissions")
			c.SetPermissionError(model.PERMISSION_MANAGE_OTHERS_OUTGOING_WEBHOOKS)
			return
		}

		_, err := c.App.GetUser(hook.CreatorId)
		if err != nil {
			c.Err = err
			return
		}
	}

	rhook, err := c.App.CreateOutgoingWebhook(hook)
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
	w.Write([]byte(rhook.ToJson()))
}

func getOutgoingHooks(c *Context, w http.ResponseWriter, r *http.Request) {
	channelId := r.URL.Query().Get("channel_id")
	teamId := r.URL.Query().Get("team_id")
	userId := c.App.Session().UserId

	var hooks []*model.OutgoingWebhook
	var err *model.AppError

	if channelId != "" {
		if !c.App.SessionHasPermissionToChannel(*c.App.Session(), channelId, model.PERMISSION_MANAGE_OUTGOING_WEBHOOKS) {
			c.SetPermissionError(model.PERMISSION_MANAGE_OUTGOING_WEBHOOKS)
			return
		}

		// Remove userId as a filter if they have permission to manage others.
		if c.App.SessionHasPermissionToChannel(*c.App.Session(), channelId, model.PERMISSION_MANAGE_OTHERS_OUTGOING_WEBHOOKS) {
			userId = ""
		}

		hooks, err = c.App.GetOutgoingWebhooksForChannelPageByUser(channelId, userId, c.Params.Page, c.Params.PerPage)
	} else if teamId != "" {
		if !c.App.SessionHasPermissionToTeam(*c.App.Session(), teamId, model.PERMISSION_MANAGE_OUTGOING_WEBHOOKS) {
			c.SetPermissionError(model.PERMISSION_MANAGE_OUTGOING_WEBHOOKS)
			return
		}

		// Remove userId as a filter if they have permission to manage others.
		if c.App.SessionHasPermissionToTeam(*c.App.Session(), teamId, model.PERMISSION_MANAGE_OTHERS_OUTGOING_WEBHOOKS) {
			userId = ""
		}

		hooks, err = c.App.GetOutgoingWebhooksForTeamPageByUser(teamId, userId, c.Params.Page, c.Params.PerPage)
	} else {
		if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_MANAGE_OUTGOING_WEBHOOKS) {
			c.SetPermissionError(model.PERMISSION_MANAGE_OUTGOING_WEBHOOKS)
			return
		}

		// Remove userId as a filter if they have permission to manage others.
		if c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_MANAGE_OTHERS_OUTGOING_WEBHOOKS) {
			userId = ""
		}

		hooks, err = c.App.GetOutgoingWebhooksPageByUser(userId, c.Params.Page, c.Params.PerPage)
	}

	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.OutgoingWebhookListToJson(hooks)))
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

	if !c.App.SessionHasPermissionToTeam(*c.App.Session(), hook.TeamId, model.PERMISSION_MANAGE_OUTGOING_WEBHOOKS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_OUTGOING_WEBHOOKS)
		return
	}

	if c.App.Session().UserId != hook.CreatorId && !c.App.SessionHasPermissionToTeam(*c.App.Session(), hook.TeamId, model.PERMISSION_MANAGE_OTHERS_OUTGOING_WEBHOOKS) {
		c.LogAudit("fail - inappropriate permissions")
		c.SetPermissionError(model.PERMISSION_MANAGE_OTHERS_OUTGOING_WEBHOOKS)
		return
	}

	auditRec.Success()
	c.LogAudit("success")

	w.Write([]byte(hook.ToJson()))
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

	if !c.App.SessionHasPermissionToTeam(*c.App.Session(), hook.TeamId, model.PERMISSION_MANAGE_OUTGOING_WEBHOOKS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_OUTGOING_WEBHOOKS)
		return
	}

	if c.App.Session().UserId != hook.CreatorId && !c.App.SessionHasPermissionToTeam(*c.App.Session(), hook.TeamId, model.PERMISSION_MANAGE_OTHERS_OUTGOING_WEBHOOKS) {
		c.LogAudit("fail - inappropriate permissions")
		c.SetPermissionError(model.PERMISSION_MANAGE_OTHERS_OUTGOING_WEBHOOKS)
		return
	}

	rhook, err := c.App.RegenOutgoingWebhookToken(hook)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("success")

	w.Write([]byte(rhook.ToJson()))
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

	if !c.App.SessionHasPermissionToTeam(*c.App.Session(), hook.TeamId, model.PERMISSION_MANAGE_OUTGOING_WEBHOOKS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_OUTGOING_WEBHOOKS)
		return
	}

	if c.App.Session().UserId != hook.CreatorId && !c.App.SessionHasPermissionToTeam(*c.App.Session(), hook.TeamId, model.PERMISSION_MANAGE_OTHERS_OUTGOING_WEBHOOKS) {
		c.LogAudit("fail - inappropriate permissions")
		c.SetPermissionError(model.PERMISSION_MANAGE_OTHERS_OUTGOING_WEBHOOKS)
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
