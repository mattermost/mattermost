// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	l4g "code.google.com/p/log4go"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"net/http"
)

func InitWebhook(r *mux.Router) {
	l4g.Debug("Initializing webhook api routes")

	sr := r.PathPrefix("/hooks").Subrouter()
	sr.Handle("/incoming/create", ApiUserRequired(createIncomingHook)).Methods("POST")
	sr.Handle("/incoming/delete", ApiUserRequired(deleteIncomingHook)).Methods("POST")
	sr.Handle("/incoming/list", ApiUserRequired(getIncomingHooks)).Methods("GET")
}

func createIncomingHook(c *Context, w http.ResponseWriter, r *http.Request) {
	if !utils.Cfg.ServiceSettings.EnableIncomingWebhooks {
		c.Err = model.NewAppError("createIncomingHook", "Incoming webhooks have been disabled by the system admin.", "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	c.LogAudit("attempt")

	hook := model.IncomingWebhookFromJson(r.Body)

	if hook == nil {
		c.SetInvalidParam("createIncomingHook", "webhook")
		return
	}

	cchan := Srv.Store.Channel().Get(hook.ChannelId)
	pchan := Srv.Store.Channel().CheckPermissionsTo(c.Session.TeamId, hook.ChannelId, c.Session.UserId)

	hook.UserId = c.Session.UserId
	hook.TeamId = c.Session.TeamId

	var channel *model.Channel
	if result := <-cchan; result.Err != nil {
		c.Err = result.Err
		return
	} else {
		channel = result.Data.(*model.Channel)
	}

	if !c.HasPermissionsToChannel(pchan, "createIncomingHook") && channel.Type != model.CHANNEL_OPEN {
		c.LogAudit("fail - bad channel permissions")
		return
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
		c.Err = model.NewAppError("createIncomingHook", "Incoming webhooks have been disabled by the system admin.", "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
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
			c.LogAudit("fail - inappropriate conditions")
			c.Err = model.NewAppError("deleteIncomingHook", "Inappropriate permissions to delete incoming webhook", "user_id="+c.Session.UserId)
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
		c.Err = model.NewAppError("createIncomingHook", "Incoming webhooks have been disabled by the system admin.", "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	if result := <-Srv.Store.Webhook().GetIncomingByUser(c.Session.UserId); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		hooks := result.Data.([]*model.IncomingWebhook)
		w.Write([]byte(model.IncomingWebhookListToJson(hooks)))
	}
}
