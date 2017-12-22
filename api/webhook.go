// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"net/http"

	"github.com/mattermost/mattermost-server/model"
)

func (api *API) InitWebhook() {
	api.BaseRoutes.Hooks.Handle("/incoming/create", api.ApiUserRequired(createIncomingHook)).Methods("POST")
	api.BaseRoutes.Hooks.Handle("/incoming/update", api.ApiUserRequired(updateIncomingHook)).Methods("POST")
	api.BaseRoutes.Hooks.Handle("/incoming/delete", api.ApiUserRequired(deleteIncomingHook)).Methods("POST")
	api.BaseRoutes.Hooks.Handle("/incoming/list", api.ApiUserRequired(getIncomingHooks)).Methods("GET")

	api.BaseRoutes.Hooks.Handle("/outgoing/create", api.ApiUserRequired(createOutgoingHook)).Methods("POST")
	api.BaseRoutes.Hooks.Handle("/outgoing/update", api.ApiUserRequired(updateOutgoingHook)).Methods("POST")
	api.BaseRoutes.Hooks.Handle("/outgoing/regen_token", api.ApiUserRequired(regenOutgoingHookToken)).Methods("POST")
	api.BaseRoutes.Hooks.Handle("/outgoing/delete", api.ApiUserRequired(deleteOutgoingHook)).Methods("POST")
	api.BaseRoutes.Hooks.Handle("/outgoing/list", api.ApiUserRequired(getOutgoingHooks)).Methods("GET")
}

func createIncomingHook(c *Context, w http.ResponseWriter, r *http.Request) {
	hook := model.IncomingWebhookFromJson(r.Body)
	if hook == nil {
		c.SetInvalidParam("createIncomingHook", "webhook")
		return
	}

	channel, err := c.App.GetChannel(hook.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("attempt")

	if !c.App.SessionHasPermissionToTeam(c.Session, channel.TeamId, model.PERMISSION_MANAGE_WEBHOOKS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_WEBHOOKS)
		return
	}

	if channel.Type != model.CHANNEL_OPEN && !c.App.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_READ_CHANNEL) {
		c.LogAudit("fail - bad channel permissions")
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	if incomingHook, err := c.App.CreateIncomingWebhookForChannel(c.Session.UserId, channel, hook); err != nil {
		c.Err = err
		return
	} else {
		c.LogAudit("success")
		w.Write([]byte(incomingHook.ToJson()))
	}
}

func updateIncomingHook(c *Context, w http.ResponseWriter, r *http.Request) {

	hook := model.IncomingWebhookFromJson(r.Body)

	if hook == nil {
		c.SetInvalidParam("updateIncomingHook", "webhook")
		return
	}

	c.LogAudit("attempt")

	oldHook, err := c.App.GetIncomingWebhook(hook.Id)
	if err != nil {
		c.Err = err
		return
	}

	if c.TeamId != oldHook.TeamId {
		c.Err = model.NewAppError("updateIncomingHook", "api.webhook.team_mismatch.app_error", nil, "user_id="+c.Session.UserId, http.StatusBadRequest)
		return
	}

	if !c.App.SessionHasPermissionToTeam(c.Session, oldHook.TeamId, model.PERMISSION_MANAGE_WEBHOOKS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_WEBHOOKS)
		return
	}

	if c.Session.UserId != oldHook.UserId && !c.App.SessionHasPermissionToTeam(c.Session, oldHook.TeamId, model.PERMISSION_MANAGE_OTHERS_WEBHOOKS) {
		c.LogAudit("fail - inappropriate permissions")
		c.SetPermissionError(model.PERMISSION_MANAGE_OTHERS_WEBHOOKS)
		return
	}

	channel, err := c.App.GetChannel(hook.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	if channel.Type != model.CHANNEL_OPEN && !c.App.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_READ_CHANNEL) {
		c.LogAudit("fail - bad channel permissions")
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	rhook, err := c.App.UpdateIncomingWebhook(oldHook, hook)
	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("success")
	w.Write([]byte(rhook.ToJson()))
}

func deleteIncomingHook(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	id := props["id"]
	if len(id) == 0 {
		c.SetInvalidParam("deleteIncomingHook", "id")
		return
	}

	hook, err := c.App.GetIncomingWebhook(id)
	if err != nil {
		c.Err = err
		return
	}

	if !c.App.SessionHasPermissionToTeam(c.Session, c.TeamId, model.PERMISSION_MANAGE_WEBHOOKS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_WEBHOOKS)
		return
	}

	c.LogAudit("attempt")

	if c.Session.UserId != hook.UserId && !c.App.SessionHasPermissionToTeam(c.Session, c.TeamId, model.PERMISSION_MANAGE_OTHERS_WEBHOOKS) {
		c.LogAudit("fail - inappropriate permissions")
		c.SetPermissionError(model.PERMISSION_MANAGE_OTHERS_WEBHOOKS)
		return
	}

	if err := c.App.DeleteIncomingWebhook(id); err != nil {
		c.LogAudit("fail")
		c.Err = err
		return
	}

	c.LogAudit("success")
	w.Write([]byte(model.MapToJson(props)))
}

func getIncomingHooks(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionToTeam(c.Session, c.TeamId, model.PERMISSION_MANAGE_WEBHOOKS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_WEBHOOKS)
		return
	}

	if hooks, err := c.App.GetIncomingWebhooksForTeamPage(c.TeamId, 0, 100); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(model.IncomingWebhookListToJson(hooks)))
	}
}

func createOutgoingHook(c *Context, w http.ResponseWriter, r *http.Request) {
	hook := model.OutgoingWebhookFromJson(r.Body)
	if hook == nil {
		c.SetInvalidParam("createOutgoingHook", "webhook")
		return
	}

	c.LogAudit("attempt")

	hook.TeamId = c.TeamId
	hook.CreatorId = c.Session.UserId

	if !c.App.SessionHasPermissionToTeam(c.Session, hook.TeamId, model.PERMISSION_MANAGE_WEBHOOKS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_WEBHOOKS)
		return
	}

	if rhook, err := c.App.CreateOutgoingWebhook(hook); err != nil {
		c.LogAudit("fail")
		c.Err = err
		return
	} else {
		c.LogAudit("success")
		w.Write([]byte(rhook.ToJson()))
	}
}

func getOutgoingHooks(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionToTeam(c.Session, c.TeamId, model.PERMISSION_MANAGE_WEBHOOKS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_WEBHOOKS)
		return
	}

	if hooks, err := c.App.GetOutgoingWebhooksForTeamPage(c.TeamId, 0, 100); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(model.OutgoingWebhookListToJson(hooks)))
	}
}

func updateOutgoingHook(c *Context, w http.ResponseWriter, r *http.Request) {
	c.LogAudit("attempt")

	hook := model.OutgoingWebhookFromJson(r.Body)

	if hook == nil {
		c.SetInvalidParam("updateOutgoingHook", "webhook")
		return
	}

	oldHook, err := c.App.GetOutgoingWebhook(hook.Id)
	if err != nil {
		c.Err = err
		return
	}

	if c.TeamId != oldHook.TeamId {
		c.Err = model.NewAppError("updateOutgoingHook", "api.webhook.team_mismatch.app_error", nil, "user_id="+c.Session.UserId, http.StatusForbidden)
		return
	}

	if !c.App.SessionHasPermissionToTeam(c.Session, oldHook.TeamId, model.PERMISSION_MANAGE_WEBHOOKS) {
		c.LogAudit("fail - inappropriate permissions")
		c.SetPermissionError(model.PERMISSION_MANAGE_WEBHOOKS)
		return
	}

	if c.Session.UserId != oldHook.CreatorId && !c.App.SessionHasPermissionToTeam(c.Session, oldHook.TeamId, model.PERMISSION_MANAGE_OTHERS_WEBHOOKS) {
		c.LogAudit("fail - inappropriate permissions")
		c.SetPermissionError(model.PERMISSION_MANAGE_OTHERS_WEBHOOKS)
		return
	}

	rhook, err := c.App.UpdateOutgoingWebhook(oldHook, hook)
	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("success")
	w.Write([]byte(rhook.ToJson()))
}

func deleteOutgoingHook(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	id := props["id"]
	if len(id) == 0 {
		c.SetInvalidParam("deleteIncomingHook", "id")
		return
	}

	c.LogAudit("attempt")

	if !c.App.SessionHasPermissionToTeam(c.Session, c.TeamId, model.PERMISSION_MANAGE_WEBHOOKS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_WEBHOOKS)
		return
	}

	hook, err := c.App.GetOutgoingWebhook(id)
	if err != nil {
		c.Err = err
		return
	}

	if c.Session.UserId != hook.CreatorId && !c.App.SessionHasPermissionToTeam(c.Session, hook.TeamId, model.PERMISSION_MANAGE_OTHERS_WEBHOOKS) {
		c.LogAudit("fail - inappropriate permissions")
		c.SetPermissionError(model.PERMISSION_MANAGE_OTHERS_WEBHOOKS)
		return
	}

	if err := c.App.DeleteOutgoingWebhook(id); err != nil {
		c.LogAudit("fail")
		c.Err = err
		return
	}

	c.LogAudit("success")
	w.Write([]byte(model.MapToJson(props)))
}

func regenOutgoingHookToken(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	id := props["id"]
	if len(id) == 0 {
		c.SetInvalidParam("regenOutgoingHookToken", "id")
		return
	}

	hook, err := c.App.GetOutgoingWebhook(id)
	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("attempt")

	if c.TeamId != hook.TeamId {
		c.Err = model.NewAppError("regenOutgoingHookToken", "api.webhook.team_mismatch.app_error", nil, "user_id="+c.Session.UserId, http.StatusForbidden)
		return
	}

	if !c.App.SessionHasPermissionToTeam(c.Session, hook.TeamId, model.PERMISSION_MANAGE_WEBHOOKS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_WEBHOOKS)
		return
	}

	if c.Session.UserId != hook.CreatorId && !c.App.SessionHasPermissionToTeam(c.Session, c.TeamId, model.PERMISSION_MANAGE_OTHERS_WEBHOOKS) {
		c.LogAudit("fail - inappropriate permissions")
		c.SetPermissionError(model.PERMISSION_MANAGE_OTHERS_WEBHOOKS)
		return
	}

	if rhook, err := c.App.RegenOutgoingWebhookToken(hook); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(rhook.ToJson()))
	}
}
