// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"io"
	"net/http"
	"strings"

	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func InitWebhook() {
	l4g.Debug(utils.T("api.webhook.init.debug"))

	BaseRoutes.Hooks.Handle("/incoming/create", ApiUserRequired(createIncomingHook)).Methods("POST")
	BaseRoutes.Hooks.Handle("/incoming/update", ApiUserRequired(updateIncomingHook)).Methods("POST")
	BaseRoutes.Hooks.Handle("/incoming/delete", ApiUserRequired(deleteIncomingHook)).Methods("POST")
	BaseRoutes.Hooks.Handle("/incoming/list", ApiUserRequired(getIncomingHooks)).Methods("GET")

	BaseRoutes.Hooks.Handle("/outgoing/create", ApiUserRequired(createOutgoingHook)).Methods("POST")
	BaseRoutes.Hooks.Handle("/outgoing/update", ApiUserRequired(updateOutgoingHook)).Methods("POST")
	BaseRoutes.Hooks.Handle("/outgoing/regen_token", ApiUserRequired(regenOutgoingHookToken)).Methods("POST")
	BaseRoutes.Hooks.Handle("/outgoing/delete", ApiUserRequired(deleteOutgoingHook)).Methods("POST")
	BaseRoutes.Hooks.Handle("/outgoing/list", ApiUserRequired(getOutgoingHooks)).Methods("GET")

	BaseRoutes.Hooks.Handle("/{id:[A-Za-z0-9]+}", ApiAppHandler(incomingWebhook)).Methods("POST")

	// Old route. Remove eventually.
	mr := app.Srv.Router
	mr.Handle("/hooks/{id:[A-Za-z0-9]+}", ApiAppHandler(incomingWebhook)).Methods("POST")
}

func createIncomingHook(c *Context, w http.ResponseWriter, r *http.Request) {
	hook := model.IncomingWebhookFromJson(r.Body)
	if hook == nil {
		c.SetInvalidParam("createIncomingHook", "webhook")
		return
	}

	channel, err := app.GetChannel(hook.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("attempt")

	if !app.SessionHasPermissionToTeam(c.Session, channel.TeamId, model.PERMISSION_MANAGE_WEBHOOKS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_WEBHOOKS)
		return
	}

	if channel.Type != model.CHANNEL_OPEN && !app.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_READ_CHANNEL) {
		c.LogAudit("fail - bad channel permissions")
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	if incomingHook, err := app.CreateIncomingWebhookForChannel(c.Session.UserId, channel, hook); err != nil {
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

	oldHook, err := app.GetIncomingWebhook(hook.Id)
	if err != nil {
		c.Err = err
		return
	}

	if c.TeamId != oldHook.TeamId {
		c.Err = model.NewAppError("updateIncomingHook", "api.webhook.team_mismatch.app_error", nil, "user_id="+c.Session.UserId, http.StatusBadRequest)
		return
	}

	if !app.SessionHasPermissionToTeam(c.Session, oldHook.TeamId, model.PERMISSION_MANAGE_WEBHOOKS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_WEBHOOKS)
		return
	}

	if c.Session.UserId != hook.UserId && !app.SessionHasPermissionToTeam(c.Session, oldHook.TeamId, model.PERMISSION_MANAGE_OTHERS_WEBHOOKS) {
		c.LogAudit("fail - inappropriate permissions")
		c.SetPermissionError(model.PERMISSION_MANAGE_OTHERS_WEBHOOKS)
		return
	}

	channel, err := app.GetChannel(hook.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	if channel.Type != model.CHANNEL_OPEN && !app.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_READ_CHANNEL) {
		c.LogAudit("fail - bad channel permissions")
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	rhook, err := app.UpdateIncomingWebhook(oldHook, hook)
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

	hook, err := app.GetIncomingWebhook(id)
	if err != nil {
		c.Err = err
		return
	}

	if !app.SessionHasPermissionToTeam(c.Session, c.TeamId, model.PERMISSION_MANAGE_WEBHOOKS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_WEBHOOKS)
		return
	}

	c.LogAudit("attempt")

	if c.Session.UserId != hook.UserId && !app.SessionHasPermissionToTeam(c.Session, c.TeamId, model.PERMISSION_MANAGE_OTHERS_WEBHOOKS) {
		c.LogAudit("fail - inappropriate permissions")
		c.SetPermissionError(model.PERMISSION_MANAGE_OTHERS_WEBHOOKS)
		return
	}

	if err := app.DeleteIncomingWebhook(id); err != nil {
		c.LogAudit("fail")
		c.Err = err
		return
	}

	c.LogAudit("success")
	w.Write([]byte(model.MapToJson(props)))
}

func getIncomingHooks(c *Context, w http.ResponseWriter, r *http.Request) {
	if !app.SessionHasPermissionToTeam(c.Session, c.TeamId, model.PERMISSION_MANAGE_WEBHOOKS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_WEBHOOKS)
		return
	}

	if hooks, err := app.GetIncomingWebhooksForTeamPage(c.TeamId, 0, 100); err != nil {
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

	if !app.SessionHasPermissionToTeam(c.Session, hook.TeamId, model.PERMISSION_MANAGE_WEBHOOKS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_WEBHOOKS)
		return
	}

	if rhook, err := app.CreateOutgoingWebhook(hook); err != nil {
		c.LogAudit("fail")
		c.Err = err
		return
	} else {
		c.LogAudit("success")
		w.Write([]byte(rhook.ToJson()))
	}
}

func getOutgoingHooks(c *Context, w http.ResponseWriter, r *http.Request) {
	if !app.SessionHasPermissionToTeam(c.Session, c.TeamId, model.PERMISSION_MANAGE_WEBHOOKS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_WEBHOOKS)
		return
	}

	if hooks, err := app.GetOutgoingWebhooksForTeamPage(c.TeamId, 0, 100); err != nil {
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

	oldHook, err := app.GetOutgoingWebhook(hook.Id)
	if err != nil {
		c.Err = err
		return
	}

	if c.TeamId != oldHook.TeamId {
		c.Err = model.NewAppError("updateOutgoingHook", "api.webhook.team_mismatch.app_error", nil, "user_id="+c.Session.UserId, http.StatusForbidden)
		return
	}

	if !app.SessionHasPermissionToTeam(c.Session, oldHook.TeamId, model.PERMISSION_MANAGE_WEBHOOKS) {
		c.LogAudit("fail - inappropriate permissions")
		c.SetPermissionError(model.PERMISSION_MANAGE_WEBHOOKS)
		return
	}

	if c.Session.UserId != oldHook.CreatorId && !app.SessionHasPermissionToTeam(c.Session, oldHook.TeamId, model.PERMISSION_MANAGE_OTHERS_WEBHOOKS) {
		c.LogAudit("fail - inappropriate permissions")
		c.SetPermissionError(model.PERMISSION_MANAGE_OTHERS_WEBHOOKS)
		return
	}

	rhook, err := app.UpdateOutgoingWebhook(oldHook, hook)
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

	if !app.SessionHasPermissionToTeam(c.Session, c.TeamId, model.PERMISSION_MANAGE_WEBHOOKS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_WEBHOOKS)
		return
	}

	hook, err := app.GetOutgoingWebhook(id)
	if err != nil {
		c.Err = err
		return
	}

	if c.Session.UserId != hook.CreatorId && !app.SessionHasPermissionToTeam(c.Session, hook.TeamId, model.PERMISSION_MANAGE_OTHERS_WEBHOOKS) {
		c.LogAudit("fail - inappropriate permissions")
		c.SetPermissionError(model.PERMISSION_MANAGE_OTHERS_WEBHOOKS)
		return
	}

	if err := app.DeleteOutgoingWebhook(id); err != nil {
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

	hook, err := app.GetOutgoingWebhook(id)
	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("attempt")

	if c.TeamId != hook.TeamId {
		c.Err = model.NewAppError("regenOutgoingHookToken", "api.webhook.team_mismatch.app_error", nil, "user_id="+c.Session.UserId, http.StatusForbidden)
		return
	}

	if !app.SessionHasPermissionToTeam(c.Session, hook.TeamId, model.PERMISSION_MANAGE_WEBHOOKS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_WEBHOOKS)
		return
	}

	if c.Session.UserId != hook.CreatorId && !app.SessionHasPermissionToTeam(c.Session, c.TeamId, model.PERMISSION_MANAGE_OTHERS_WEBHOOKS) {
		c.LogAudit("fail - inappropriate permissions")
		c.SetPermissionError(model.PERMISSION_MANAGE_OTHERS_WEBHOOKS)
		return
	}

	if rhook, err := app.RegenOutgoingWebhookToken(hook); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(rhook.ToJson()))
	}
}

func incomingWebhook(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["id"]

	r.ParseForm()

	var payload io.Reader
	contentType := r.Header.Get("Content-Type")
	if strings.Split(contentType, "; ")[0] == "application/x-www-form-urlencoded" {
		payload = strings.NewReader(r.FormValue("payload"))
	} else {
		payload = r.Body
	}

	if utils.Cfg.LogSettings.EnableWebhookDebugging {
		var err error
		payload, err = utils.DebugReader(
			payload,
			utils.T("api.webhook.incoming.debug"),
		)
		if err != nil {
			c.Err = model.NewLocAppError(
				"incomingWebhook",
				"api.webhook.incoming.debug.error",
				nil,
				err.Error(),
			)
			return
		}
	}

	parsedRequest := model.IncomingWebhookRequestFromJson(payload)

	err := app.HandleIncomingWebhook(id, parsedRequest)
	if err != nil {
		c.Err = err
		return
	}

	w.Header().Set("Content-Type", "text/plain")
	w.Write([]byte("ok"))
}
