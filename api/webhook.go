// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"io"
	"net/http"
	"strings"

	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
)

func InitWebhook() {
	l4g.Debug(utils.T("api.webhook.init.debug"))

	BaseRoutes.Hooks.Handle("/incoming/create", ApiUserRequired(createIncomingHook)).Methods("POST")
	BaseRoutes.Hooks.Handle("/incoming/delete", ApiUserRequired(deleteIncomingHook)).Methods("POST")
	BaseRoutes.Hooks.Handle("/incoming/list", ApiUserRequired(getIncomingHooks)).Methods("GET")

	BaseRoutes.Hooks.Handle("/outgoing/create", ApiUserRequired(createOutgoingHook)).Methods("POST")
	BaseRoutes.Hooks.Handle("/outgoing/regen_token", ApiUserRequired(regenOutgoingHookToken)).Methods("POST")
	BaseRoutes.Hooks.Handle("/outgoing/delete", ApiUserRequired(deleteOutgoingHook)).Methods("POST")
	BaseRoutes.Hooks.Handle("/outgoing/list", ApiUserRequired(getOutgoingHooks)).Methods("GET")

	BaseRoutes.Hooks.Handle("/{id:[A-Za-z0-9]+}", ApiAppHandler(incomingWebhook)).Methods("POST")

	// Old route. Remove eventually.
	mr := Srv.Router
	mr.Handle("/hooks/{id:[A-Za-z0-9]+}", ApiAppHandler(incomingWebhook)).Methods("POST")
}

func createIncomingHook(c *Context, w http.ResponseWriter, r *http.Request) {
	if !utils.Cfg.ServiceSettings.EnableIncomingWebhooks {
		c.Err = model.NewLocAppError("createIncomingHook", "api.webhook.create_incoming.disabled.app_errror", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	if *utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations {
		if !(c.IsSystemAdmin() || c.IsTeamAdmin()) {
			c.Err = model.NewLocAppError("createIncomingHook", "api.command.admin_only.app_error", nil, "")
			c.Err.StatusCode = http.StatusForbidden
			return
		}
	}

	c.LogAudit("attempt")

	hook := model.IncomingWebhookFromJson(r.Body)

	if hook == nil {
		c.SetInvalidParam("createIncomingHook", "webhook")
		return
	}

	cchan := Srv.Store.Channel().Get(hook.ChannelId)
	pchan := Srv.Store.Channel().CheckPermissionsTo(c.TeamId, hook.ChannelId, c.Session.UserId)

	hook.UserId = c.Session.UserId
	hook.TeamId = c.TeamId

	var channel *model.Channel
	if result := <-cchan; result.Err != nil {
		c.Err = result.Err
		return
	} else {
		channel = result.Data.(*model.Channel)
	}

	if !c.HasPermissionsToChannel(pchan, "createIncomingHook") {
		if channel.Type != model.CHANNEL_OPEN || channel.TeamId != c.TeamId {
			c.LogAudit("fail - bad channel permissions")
			return
		}
		c.Err = nil
	}

	if result := <-Srv.Store.Webhook().SaveIncoming(hook); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		c.LogAudit("success")
		rhook := result.Data.(*model.IncomingWebhook)
		w.Write([]byte(rhook.ToJson()))
	}
}

func deleteIncomingHook(c *Context, w http.ResponseWriter, r *http.Request) {
	if !utils.Cfg.ServiceSettings.EnableIncomingWebhooks {
		c.Err = model.NewLocAppError("deleteIncomingHook", "api.webhook.delete_incoming.disabled.app_errror", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	if *utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations {
		if !(c.IsSystemAdmin() || c.IsTeamAdmin()) {
			c.Err = model.NewLocAppError("deleteIncomingHook", "api.command.admin_only.app_error", nil, "")
			c.Err.StatusCode = http.StatusForbidden
			return
		}
	}

	c.LogAudit("attempt")

	props := model.MapFromJson(r.Body)

	id := props["id"]
	if len(id) == 0 {
		c.SetInvalidParam("deleteIncomingHook", "id")
		return
	}

	if result := <-Srv.Store.Webhook().GetIncoming(id); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		if c.Session.UserId != result.Data.(*model.IncomingWebhook).UserId && !c.IsTeamAdmin() {
			c.LogAudit("fail - inappropriate permissions")
			c.Err = model.NewLocAppError("deleteIncomingHook", "api.webhook.delete_incoming.permissions.app_errror", nil, "user_id="+c.Session.UserId)
			return
		}
	}

	if err := (<-Srv.Store.Webhook().DeleteIncoming(id, model.GetMillis())).Err; err != nil {
		c.Err = err
		return
	}

	c.LogAudit("success")
	w.Write([]byte(model.MapToJson(props)))
}

func getIncomingHooks(c *Context, w http.ResponseWriter, r *http.Request) {
	if !utils.Cfg.ServiceSettings.EnableIncomingWebhooks {
		c.Err = model.NewLocAppError("getIncomingHooks", "api.webhook.get_incoming.disabled.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	if *utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations {
		if !(c.IsSystemAdmin() || c.IsTeamAdmin()) {
			c.Err = model.NewLocAppError("getIncomingHooks", "api.command.admin_only.app_error", nil, "")
			c.Err.StatusCode = http.StatusForbidden
			return
		}
	}

	if result := <-Srv.Store.Webhook().GetIncomingByTeam(c.TeamId); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		hooks := result.Data.([]*model.IncomingWebhook)
		w.Write([]byte(model.IncomingWebhookListToJson(hooks)))
	}
}

func createOutgoingHook(c *Context, w http.ResponseWriter, r *http.Request) {
	if !utils.Cfg.ServiceSettings.EnableOutgoingWebhooks {
		c.Err = model.NewLocAppError("createOutgoingHook", "api.webhook.create_outgoing.disabled.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	if *utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations {
		if !(c.IsSystemAdmin() || c.IsTeamAdmin()) {
			c.Err = model.NewLocAppError("createOutgoingHook", "api.command.admin_only.app_error", nil, "")
			c.Err.StatusCode = http.StatusForbidden
			return
		}
	}

	c.LogAudit("attempt")

	hook := model.OutgoingWebhookFromJson(r.Body)

	if hook == nil {
		c.SetInvalidParam("createOutgoingHook", "webhook")
		return
	}

	hook.CreatorId = c.Session.UserId
	hook.TeamId = c.TeamId

	if len(hook.ChannelId) != 0 {
		cchan := Srv.Store.Channel().Get(hook.ChannelId)
		pchan := Srv.Store.Channel().CheckPermissionsTo(c.TeamId, hook.ChannelId, c.Session.UserId)

		var channel *model.Channel
		if result := <-cchan; result.Err != nil {
			c.Err = result.Err
			return
		} else {
			channel = result.Data.(*model.Channel)
		}

		if channel.Type != model.CHANNEL_OPEN {
			c.LogAudit("fail - not open channel")
			c.Err = model.NewLocAppError("createOutgoingHook", "api.webhook.create_outgoing.not_open.app_error", nil, "")
			return
		}

		if !c.HasPermissionsToChannel(pchan, "createOutgoingHook") {
			if channel.Type != model.CHANNEL_OPEN || channel.TeamId != c.TeamId {
				c.LogAudit("fail - bad channel permissions")
				c.Err = model.NewLocAppError("createOutgoingHook", "api.webhook.create_outgoing.permissions.app_error", nil, "")
				return
			} else {
				c.Err = nil
			}
		}
	} else if len(hook.TriggerWords) == 0 {
		c.Err = model.NewLocAppError("createOutgoingHook", "api.webhook.create_outgoing.triggers.app_error", nil, "")
		return
	}

	if result := <-Srv.Store.Webhook().GetOutgoingByTeam(c.TeamId); result.Err != nil {
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

	if result := <-Srv.Store.Webhook().SaveOutgoing(hook); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		c.LogAudit("success")
		rhook := result.Data.(*model.OutgoingWebhook)
		w.Write([]byte(rhook.ToJson()))
	}
}

func getOutgoingHooks(c *Context, w http.ResponseWriter, r *http.Request) {
	if !utils.Cfg.ServiceSettings.EnableOutgoingWebhooks {
		c.Err = model.NewLocAppError("getOutgoingHooks", "api.webhook.get_outgoing.disabled.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	if *utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations {
		if !(c.IsSystemAdmin() || c.IsTeamAdmin()) {
			c.Err = model.NewLocAppError("getOutgoingHooks", "api.command.admin_only.app_error", nil, "")
			c.Err.StatusCode = http.StatusForbidden
			return
		}
	}

	if result := <-Srv.Store.Webhook().GetOutgoingByTeam(c.TeamId); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		hooks := result.Data.([]*model.OutgoingWebhook)
		w.Write([]byte(model.OutgoingWebhookListToJson(hooks)))
	}
}

func deleteOutgoingHook(c *Context, w http.ResponseWriter, r *http.Request) {
	if !utils.Cfg.ServiceSettings.EnableOutgoingWebhooks {
		c.Err = model.NewLocAppError("deleteOutgoingHook", "api.webhook.delete_outgoing.disabled.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	if *utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations {
		if !(c.IsSystemAdmin() || c.IsTeamAdmin()) {
			c.Err = model.NewLocAppError("deleteOutgoingHook", "api.command.admin_only.app_error", nil, "")
			c.Err.StatusCode = http.StatusForbidden
			return
		}
	}

	c.LogAudit("attempt")

	props := model.MapFromJson(r.Body)

	id := props["id"]
	if len(id) == 0 {
		c.SetInvalidParam("deleteIncomingHook", "id")
		return
	}

	if result := <-Srv.Store.Webhook().GetOutgoing(id); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		if c.Session.UserId != result.Data.(*model.OutgoingWebhook).CreatorId && !c.IsTeamAdmin() {
			c.LogAudit("fail - inappropriate permissions")
			c.Err = model.NewLocAppError("deleteOutgoingHook", "api.webhook.delete_outgoing.permissions.app_error", nil, "user_id="+c.Session.UserId)
			return
		}
	}

	if err := (<-Srv.Store.Webhook().DeleteOutgoing(id, model.GetMillis())).Err; err != nil {
		c.Err = err
		return
	}

	c.LogAudit("success")
	w.Write([]byte(model.MapToJson(props)))
}

func regenOutgoingHookToken(c *Context, w http.ResponseWriter, r *http.Request) {
	if !utils.Cfg.ServiceSettings.EnableOutgoingWebhooks {
		c.Err = model.NewLocAppError("regenOutgoingHookToken", "api.webhook.regen_outgoing_token.disabled.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	if *utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations {
		if !(c.IsSystemAdmin() || c.IsTeamAdmin()) {
			c.Err = model.NewLocAppError("regenOutgoingHookToken", "api.command.admin_only.app_error", nil, "")
			c.Err.StatusCode = http.StatusForbidden
			return
		}
	}

	c.LogAudit("attempt")

	props := model.MapFromJson(r.Body)

	id := props["id"]
	if len(id) == 0 {
		c.SetInvalidParam("regenOutgoingHookToken", "id")
		return
	}

	var hook *model.OutgoingWebhook
	if result := <-Srv.Store.Webhook().GetOutgoing(id); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		hook = result.Data.(*model.OutgoingWebhook)

		if c.TeamId != hook.TeamId && c.Session.UserId != hook.CreatorId && !c.IsTeamAdmin() {
			c.LogAudit("fail - inappropriate permissions")
			c.Err = model.NewLocAppError("regenOutgoingHookToken", "api.webhook.regen_outgoing_token.permissions.app_error", nil, "user_id="+c.Session.UserId)
			return
		}
	}

	hook.Token = model.NewId()

	if result := <-Srv.Store.Webhook().UpdateOutgoing(hook); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		w.Write([]byte(result.Data.(*model.OutgoingWebhook).ToJson()))
	}
}

func incomingWebhook(c *Context, w http.ResponseWriter, r *http.Request) {
	if !utils.Cfg.ServiceSettings.EnableIncomingWebhooks {
		c.Err = model.NewLocAppError("incomingWebhook", "web.incoming_webhook.disabled.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	params := mux.Vars(r)
	id := params["id"]

	hchan := Srv.Store.Webhook().GetIncoming(id)

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
		return
	}

	channelName := parsedRequest.ChannelName
	webhookType := parsedRequest.Type

	//attachments is in here for slack compatibility
	if parsedRequest.Attachments != nil {
		if len(parsedRequest.Props) == 0 {
			parsedRequest.Props = make(model.StringInterface)
		}
		parsedRequest.Props["attachments"] = parsedRequest.Attachments
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

	if len(channelName) != 0 {
		if channelName[0] == '@' {
			if result := <-Srv.Store.User().GetByUsername(channelName[1:]); result.Err != nil {
				c.Err = model.NewLocAppError("incomingWebhook", "web.incoming_webhook.user.app_error", nil, "err="+result.Err.Message)
				return
			} else {
				channelName = model.GetDMNameFromIds(result.Data.(*model.User).Id, hook.UserId)
			}
		} else if channelName[0] == '#' {
			channelName = channelName[1:]
		}

		cchan = Srv.Store.Channel().GetByName(hook.TeamId, channelName)
	} else {
		cchan = Srv.Store.Channel().Get(hook.ChannelId)
	}

	overrideUsername := parsedRequest.Username
	overrideIconUrl := parsedRequest.IconURL

	if result := <-cchan; result.Err != nil {
		c.Err = model.NewLocAppError("incomingWebhook", "web.incoming_webhook.channel.app_error", nil, "err="+result.Err.Message)
		return
	} else {
		channel = result.Data.(*model.Channel)
	}

	pchan := Srv.Store.Channel().CheckPermissionsTo(hook.TeamId, channel.Id, hook.UserId)

	// create a mock session
	c.Session = model.Session{
		UserId:      hook.UserId,
		TeamMembers: []*model.TeamMember{{TeamId: hook.TeamId, UserId: hook.UserId}},
		IsOAuth:     false,
	}

	c.TeamId = hook.TeamId

	if !c.HasPermissionsToChannel(pchan, "createIncomingHook") && channel.Type != model.CHANNEL_OPEN {
		c.Err = model.NewLocAppError("incomingWebhook", "web.incoming_webhook.permissions.app_error", nil, "")
		return
	}

	if _, err := CreateWebhookPost(c, channel.Id, text, overrideUsername, overrideIconUrl, parsedRequest.Props, webhookType); err != nil {
		c.Err = err
		return
	}

	w.Header().Set("Content-Type", "text/plain")
	w.Write([]byte("ok"))
}
