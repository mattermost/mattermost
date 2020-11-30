// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v5/audit"
	"github.com/mattermost/mattermost-server/v5/model"
)

func (api *API) InitWebhookLocal() {
	api.BaseRoutes.IncomingHooks.Handle("", api.ApiLocal(localCreateIncomingHook)).Methods("POST")
	api.BaseRoutes.IncomingHooks.Handle("", api.ApiLocal(getIncomingHooks)).Methods("GET")
	api.BaseRoutes.IncomingHook.Handle("", api.ApiLocal(getIncomingHook)).Methods("GET")
	api.BaseRoutes.IncomingHook.Handle("", api.ApiLocal(updateIncomingHook)).Methods("PUT")
	api.BaseRoutes.IncomingHook.Handle("", api.ApiLocal(deleteIncomingHook)).Methods("DELETE")

	api.BaseRoutes.OutgoingHooks.Handle("", api.ApiLocal(getOutgoingHooks)).Methods("GET")
	api.BaseRoutes.OutgoingHook.Handle("", api.ApiLocal(getOutgoingHook)).Methods("GET")
	api.BaseRoutes.OutgoingHook.Handle("", api.ApiLocal(updateOutgoingHook)).Methods("PUT")
	api.BaseRoutes.OutgoingHook.Handle("", api.ApiLocal(deleteOutgoingHook)).Methods("DELETE")
}

func localCreateIncomingHook(c *Context, w http.ResponseWriter, r *http.Request) {
	hook := model.IncomingWebhookFromJson(r.Body)
	if hook == nil {
		c.SetInvalidParam("incoming_webhook")
		return
	}

	if hook.UserId == "" {
		c.SetInvalidParam("user_id")
		return
	}

	channel, err := c.App.GetChannel(hook.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	if _, err := c.App.GetUser(hook.UserId); err != nil {
		c.Err = err
		return
	}

	auditRec := c.MakeAuditRecord("localCreateIncomingHook", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("channel", channel)
	c.LogAudit("attempt")

	incomingHook, err := c.App.CreateIncomingWebhookForChannel(hook.UserId, channel, hook)
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
