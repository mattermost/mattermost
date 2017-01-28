// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"io"
	"net/http"
	"strings"
	"unicode/utf8"

	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
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
	if err := checkIncomingWebHooks("updateIncomingHook", "api.webhook.update_incoming.disabled.app_error"); err != nil {
		c.Err = err
		return
	}

	if err := checkManageWebhooksPermission(c, "updateIncomingHook", "api.command.admin_only.app_error"); err != nil {
		c.Err = err
		return
	}

	c.LogAudit("attempt")

	hook := model.IncomingWebhookFromJson(r.Body)

	if hook == nil {
		c.SetInvalidParam("updateIncomingHook", "webhook")
		return
	}

	var oldHook *model.IncomingWebhook
	var result store.StoreResult

	if result = <-app.Srv.Store.Webhook().GetIncoming(hook.Id, true); result.Err != nil {
		c.LogAudit("no existing incoming hook found")
		c.Err = result.Err
		return
	}

	oldHook = result.Data.(*model.IncomingWebhook)
	cchan := app.Srv.Store.Channel().Get(hook.ChannelId, true)

	var channel *model.Channel
	if result = <-cchan; result.Err != nil {
		c.Err = result.Err
		return
	}

	channel = result.Data.(*model.Channel)
	if channel.Type != model.CHANNEL_OPEN && !app.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_READ_CHANNEL) {
		c.LogAudit("fail - bad channel permissions")
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	if c.Session.UserId != oldHook.UserId && !app.SessionHasPermissionToTeam(c.Session, c.TeamId, model.PERMISSION_MANAGE_OTHERS_WEBHOOKS) {
		c.LogAudit("fail - inappropriate permissions")
		c.Err = model.NewLocAppError("updateIncomingHook", "api.webhook.update_incoming.permissions.app_error", nil, "user_id="+c.Session.UserId)
		return
	}

	if c.TeamId != oldHook.TeamId {
		c.Err = model.NewLocAppError("UpdateIncomingHook", "api.webhook.team_mismatch.app_error", nil, "user_id="+c.Session.UserId)
		return
	}

	hook.UserId = oldHook.UserId
	hook.CreateAt = oldHook.CreateAt
	hook.UpdateAt = model.GetMillis()
	hook.TeamId = oldHook.TeamId
	hook.DeleteAt = oldHook.DeleteAt

	if result = <-app.Srv.Store.Webhook().UpdateIncoming(hook); result.Err != nil {
		c.Err = result.Err
		return
	}

	c.LogAudit("success")
	rhook := result.Data.(*model.IncomingWebhook)
	w.Write([]byte(rhook.ToJson()))
}

func deleteIncomingHook(c *Context, w http.ResponseWriter, r *http.Request) {
	if err := checkIncomingWebHooks("deleteIncomingHook", "api.webhook.delete_incoming.disabled.app_error"); err != nil {
		c.Err = err
		return
	}

	if err := checkManageWebhooksPermission(c, "deleteIncomingHook", "api.command.admin_only.app_error"); err != nil {
		c.Err = err
		return
	}

	c.LogAudit("attempt")

	props := model.MapFromJson(r.Body)

	id := props["id"]
	if len(id) == 0 {
		c.SetInvalidParam("deleteIncomingHook", "id")
		return
	}

	if result := <-app.Srv.Store.Webhook().GetIncoming(id, true); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		if c.Session.UserId != result.Data.(*model.IncomingWebhook).UserId && !app.SessionHasPermissionToTeam(c.Session, c.TeamId, model.PERMISSION_MANAGE_OTHERS_WEBHOOKS) {
			c.LogAudit("fail - inappropriate permissions")
			c.Err = model.NewLocAppError("deleteIncomingHook", "api.webhook.delete_incoming.permissions.app_error", nil, "user_id="+c.Session.UserId)
			return
		}
	}

	if err := (<-app.Srv.Store.Webhook().DeleteIncoming(id, model.GetMillis())).Err; err != nil {
		c.Err = err
		return
	}

	app.InvalidateCacheForWebhook(id)

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

func checkOutgoingWebHooks(where string, id string) *model.AppError {
	if !utils.Cfg.ServiceSettings.EnableOutgoingWebhooks {
		err := model.NewLocAppError(where, id, nil, "")
		err.StatusCode = http.StatusNotImplemented
		return err
	}

	return nil
}

func checkIncomingWebHooks(where string, id string) *model.AppError {
	if !utils.Cfg.ServiceSettings.EnableIncomingWebhooks {
		err := model.NewLocAppError(where, id, nil, "")
		err.StatusCode = http.StatusNotImplemented
		return err
	}

	return nil
}

func checkManageWebhooksPermission(c *Context, where string, id string) *model.AppError {
	if !app.SessionHasPermissionToTeam(c.Session, c.TeamId, model.PERMISSION_MANAGE_WEBHOOKS) {
		err := model.NewLocAppError(where, id, nil, "")
		err.StatusCode = http.StatusForbidden
		return err
	}

	return nil
}

func checkValidOutgoingHook(hook *model.OutgoingWebhook, c *Context, where string, id string) *model.AppError {
	if len(hook.ChannelId) != 0 {
		cchan := app.Srv.Store.Channel().Get(hook.ChannelId, true)

		var channel *model.Channel
		var result store.StoreResult
		if result = <-cchan; result.Err != nil {
			return result.Err
		}

		channel = result.Data.(*model.Channel)

		if channel.Type != model.CHANNEL_OPEN {
			c.LogAudit("fail - not open channel")
			return model.NewLocAppError(where, "api.webhook."+id+".not_open.app_error", nil, "")
		}

		if channel.TeamId != c.TeamId {
			c.LogAudit("fail - cannot update command to a different team")
			return model.NewLocAppError(where, "api.webhook."+id+".permissions.app_error", nil, "")
		}
	} else if len(hook.TriggerWords) == 0 {
		return model.NewLocAppError(where, "api.webhook."+id+".triggers.app_error", nil, "")
	}

	return nil
}

func createOutgoingHook(c *Context, w http.ResponseWriter, r *http.Request) {
	if err := checkOutgoingWebHooks("createOutgoingHook", "api.webhook.create_outgoing.disabled.app_error"); err != nil {
		c.Err = err
		return
	}

	if err := checkManageWebhooksPermission(c, "createOutgoingHook", "api.command.admin_only.app_error"); err != nil {
		c.Err = err
		return
	}

	c.LogAudit("attempt")

	hook := model.OutgoingWebhookFromJson(r.Body)

	if hook == nil {
		c.SetInvalidParam("createOutgoingHook", "webhook")
		return
	}

	hook.CreatorId = c.Session.UserId
	hook.TeamId = c.TeamId

	if err := checkValidOutgoingHook(hook, c, "createOutgoingHook", "create_outgoing"); err != nil {
		c.Err = err
		return
	}

	if result := <-app.Srv.Store.Webhook().GetOutgoingByTeam(c.TeamId); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		allHooks := result.Data.([]*model.OutgoingWebhook)

		for _, existingOutHook := range allHooks {
			urlIntersect := utils.StringArrayIntersection(existingOutHook.CallbackURLs, hook.CallbackURLs)
			triggerIntersect := utils.StringArrayIntersection(existingOutHook.TriggerWords, hook.TriggerWords)

			if existingOutHook.ChannelId == hook.ChannelId && len(urlIntersect) != 0 && len(triggerIntersect) != 0 {
				c.Err = model.NewLocAppError("createOutgoingHook", "api.webhook.create_outgoing.intersect.app_error", nil, "")
				return
			}
		}
	}

	if result := <-app.Srv.Store.Webhook().SaveOutgoing(hook); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		c.LogAudit("success")
		rhook := result.Data.(*model.OutgoingWebhook)
		w.Write([]byte(rhook.ToJson()))
	}
}

func getOutgoingHooks(c *Context, w http.ResponseWriter, r *http.Request) {
	if err := checkOutgoingWebHooks("getOutgoingHooks", "api.webhook.get_outgoing.disabled.app_error"); err != nil {
		c.Err = err
		return
	}

	if err := checkManageWebhooksPermission(c, "getOutgoingHooks", "api.command.admin_only.app_error"); err != nil {
		c.Err = err
		return
	}

	if result := <-app.Srv.Store.Webhook().GetOutgoingByTeam(c.TeamId); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		hooks := result.Data.([]*model.OutgoingWebhook)
		w.Write([]byte(model.OutgoingWebhookListToJson(hooks)))
	}
}

func updateOutgoingHook(c *Context, w http.ResponseWriter, r *http.Request) {
	if err := checkOutgoingWebHooks("updateOutgoingHook", "api.webhook.update_outgoing.disabled.app_error"); err != nil {
		c.Err = err
		return
	}

	if err := checkManageWebhooksPermission(c, "updateOutgoingHook", "api.command.admin_only.app_error"); err != nil {
		c.Err = err
		return
	}

	c.LogAudit("attempt")

	hook := model.OutgoingWebhookFromJson(r.Body)

	if hook == nil {
		c.SetInvalidParam("updateOutgoingHook", "webhook")
		return
	}

	if err := checkValidOutgoingHook(hook, c, "updateOutgoingHook", "update_outgoing"); err != nil {
		c.Err = err
		return
	}

	var result store.StoreResult
	if result = <-app.Srv.Store.Webhook().GetOutgoingByTeam(c.TeamId); result.Err != nil {
		c.Err = result.Err
		return
	}

	allHooks := result.Data.([]*model.OutgoingWebhook)

	for _, existingOutHook := range allHooks {
		urlIntersect := utils.StringArrayIntersection(existingOutHook.CallbackURLs, hook.CallbackURLs)
		triggerIntersect := utils.StringArrayIntersection(existingOutHook.TriggerWords, hook.TriggerWords)

		if existingOutHook.ChannelId == hook.ChannelId && len(urlIntersect) != 0 && len(triggerIntersect) != 0 && existingOutHook.Id != hook.Id {
			c.Err = model.NewLocAppError("updateOutgoingHook", "api.webhook.update_outgoing.intersect.app_error", nil, "")
			return
		}
	}

	if result = <-app.Srv.Store.Webhook().GetOutgoing(hook.Id); result.Err != nil {
		c.LogAudit("fail - no existing outgoing webhook found")
		c.Err = result.Err
		return
	}

	oldHook := result.Data.(*model.OutgoingWebhook)
	if c.TeamId != oldHook.TeamId {
		c.Err = model.NewLocAppError("UpdateOutgoingHook", "api.webhook.team_mismatch.app_error", nil, "user_id="+c.Session.UserId)
		return
	}

	hook.CreatorId = oldHook.CreatorId
	hook.CreateAt = oldHook.CreateAt
	hook.DeleteAt = oldHook.DeleteAt
	hook.TeamId = oldHook.TeamId
	hook.UpdateAt = model.GetMillis()

	if result = <-app.Srv.Store.Webhook().UpdateOutgoing(hook); result.Err != nil {
		c.Err = result.Err
		return
	}

	c.LogAudit("success")
	rhook := result.Data.(*model.OutgoingWebhook)
	w.Write([]byte(rhook.ToJson()))
}

func deleteOutgoingHook(c *Context, w http.ResponseWriter, r *http.Request) {
	if err := checkOutgoingWebHooks("deleteOutgoingHook", "api.webhook.delete_outgoing.disabled.app_error"); err != nil {
		c.Err = err
		return
	}

	if err := checkManageWebhooksPermission(c, "deleteOutgoingHook", "api.command.admin_only.app_error"); err != nil {
		c.Err = err
		return
	}

	c.LogAudit("attempt")

	props := model.MapFromJson(r.Body)

	id := props["id"]
	if len(id) == 0 {
		c.SetInvalidParam("deleteIncomingHook", "id")
		return
	}

	if result := <-app.Srv.Store.Webhook().GetOutgoing(id); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		if c.Session.UserId != result.Data.(*model.OutgoingWebhook).CreatorId && !app.SessionHasPermissionToTeam(c.Session, c.TeamId, model.PERMISSION_MANAGE_OTHERS_WEBHOOKS) {
			c.LogAudit("fail - inappropriate permissions")
			c.Err = model.NewLocAppError("deleteOutgoingHook", "api.webhook.delete_outgoing.permissions.app_error", nil, "user_id="+c.Session.UserId)
			return
		}
	}

	if err := (<-app.Srv.Store.Webhook().DeleteOutgoing(id, model.GetMillis())).Err; err != nil {
		c.Err = err
		return
	}

	c.LogAudit("success")
	w.Write([]byte(model.MapToJson(props)))
}

func regenOutgoingHookToken(c *Context, w http.ResponseWriter, r *http.Request) {
	if err := checkOutgoingWebHooks("regenOutgoingHookToken", "api.webhook.regen_outgoing_token.disabled.app_error"); err != nil {
		c.Err = err
		return
	}

	if err := checkManageWebhooksPermission(c, "regenOutgoingHookToken", "api.command.admin_only.app_error"); err != nil {
		c.Err = err
		return
	}

	c.LogAudit("attempt")

	props := model.MapFromJson(r.Body)

	id := props["id"]
	if len(id) == 0 {
		c.SetInvalidParam("regenOutgoingHookToken", "id")
		return
	}

	var hook *model.OutgoingWebhook
	if result := <-app.Srv.Store.Webhook().GetOutgoing(id); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		hook = result.Data.(*model.OutgoingWebhook)

		if c.TeamId != hook.TeamId && c.Session.UserId != hook.CreatorId && !app.SessionHasPermissionToTeam(c.Session, c.TeamId, model.PERMISSION_MANAGE_OTHERS_WEBHOOKS) {
			c.LogAudit("fail - inappropriate permissions")
			c.Err = model.NewLocAppError("regenOutgoingHookToken", "api.webhook.regen_outgoing_token.permissions.app_error", nil, "user_id="+c.Session.UserId)
			return
		}
	}

	hook.Token = model.NewId()

	if result := <-app.Srv.Store.Webhook().UpdateOutgoing(hook); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		w.Write([]byte(result.Data.(*model.OutgoingWebhook).ToJson()))
	}
}

func incomingWebhook(c *Context, w http.ResponseWriter, r *http.Request) {
	if err := checkIncomingWebHooks("incomingWebhook", "web.incoming_webhook.disabled.app_error"); err != nil {
		c.Err = err
		return
	}

	params := mux.Vars(r)
	id := params["id"]

	hchan := app.Srv.Store.Webhook().GetIncoming(id, true)

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

	if parsedRequest == nil {
		c.Err = model.NewLocAppError("incomingWebhook", "web.incoming_webhook.parse.app_error", nil, "")
		return
	}

	text := parsedRequest.Text
	if len(text) == 0 && parsedRequest.Attachments == nil {
		c.Err = model.NewLocAppError("incomingWebhook", "web.incoming_webhook.text.app_error", nil, "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	textSize := utf8.RuneCountInString(text)
	if textSize > model.POST_MESSAGE_MAX_RUNES {
		c.Err = model.NewLocAppError("incomingWebhook", "web.incoming_webhook.text.length.app_error", map[string]interface{}{"Max": model.POST_MESSAGE_MAX_RUNES, "Actual": textSize}, "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	channelName := parsedRequest.ChannelName
	webhookType := parsedRequest.Type

	// attachments is in here for slack compatibility
	if parsedRequest.Attachments != nil {
		if len(parsedRequest.Props) == 0 {
			parsedRequest.Props = make(model.StringInterface)
		}
		parsedRequest.Props["attachments"] = parsedRequest.Attachments

		attachmentSize := utf8.RuneCountInString(model.StringInterfaceToJson(parsedRequest.Props))
		// Minus 100 to leave room for setting post type in the Props
		if attachmentSize > model.POST_PROPS_MAX_RUNES-100 {
			c.Err = model.NewLocAppError("incomingWebhook", "web.incoming_webhook.attachment.app_error", map[string]interface{}{"Max": model.POST_PROPS_MAX_RUNES - 100, "Actual": attachmentSize}, "")
			c.Err.StatusCode = http.StatusBadRequest
			return
		}

		webhookType = model.POST_SLACK_ATTACHMENT
	}

	var hook *model.IncomingWebhook
	if result := <-hchan; result.Err != nil {
		c.Err = model.NewLocAppError("incomingWebhook", "web.incoming_webhook.invalid.app_error", nil, "err="+result.Err.Message)
		return
	} else {
		hook = result.Data.(*model.IncomingWebhook)
	}

	var channel *model.Channel
	var cchan store.StoreChannel
	var directUserId string

	if len(channelName) != 0 {
		if channelName[0] == '@' {
			if result := <-app.Srv.Store.User().GetByUsername(channelName[1:]); result.Err != nil {
				c.Err = model.NewLocAppError("incomingWebhook", "web.incoming_webhook.user.app_error", nil, "err="+result.Err.Message)
				return
			} else {
				directUserId = result.Data.(*model.User).Id
				channelName = model.GetDMNameFromIds(directUserId, hook.UserId)
			}
		} else if channelName[0] == '#' {
			channelName = channelName[1:]
		}

		cchan = app.Srv.Store.Channel().GetByName(hook.TeamId, channelName, true)
	} else {
		cchan = app.Srv.Store.Channel().Get(hook.ChannelId, true)
	}

	overrideUsername := parsedRequest.Username
	overrideIconUrl := parsedRequest.IconURL

	result := <-cchan
	if result.Err != nil && result.Err.Id == store.MISSING_CHANNEL_ERROR && directUserId != "" {
		newChanResult := <-app.Srv.Store.Channel().CreateDirectChannel(directUserId, hook.UserId)
		if newChanResult.Err != nil {
			c.Err = model.NewLocAppError("incomingWebhook", "web.incoming_webhook.channel.app_error", nil, "err="+newChanResult.Err.Message)
			return
		} else {
			channel = newChanResult.Data.(*model.Channel)
			app.InvalidateCacheForUser(directUserId)
			app.InvalidateCacheForUser(hook.UserId)
		}
	} else if result.Err != nil {
		c.Err = model.NewLocAppError("incomingWebhook", "web.incoming_webhook.channel.app_error", nil, "err="+result.Err.Message)
		return
	} else {
		channel = result.Data.(*model.Channel)
	}

	// create a mock session
	c.Session = model.Session{
		UserId: hook.UserId,
		TeamMembers: []*model.TeamMember{{
			TeamId: hook.TeamId,
			UserId: hook.UserId,
			Roles:  model.ROLE_CHANNEL_USER.Id,
		}},
		IsOAuth: false,
	}

	c.TeamId = hook.TeamId

	if channel.Type != model.CHANNEL_OPEN && !app.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_READ_CHANNEL) {
		c.Err = model.NewLocAppError("incomingWebhook", "web.incoming_webhook.permissions.app_error", nil, "")
		return
	}
	c.Err = nil

	if _, err := app.CreateWebhookPost(hook.UserId, hook.TeamId, channel.Id, text, overrideUsername, overrideIconUrl, parsedRequest.Props, webhookType); err != nil {
		c.Err = err
		return
	}

	w.Header().Set("Content-Type", "text/plain")
	w.Write([]byte("ok"))
}
