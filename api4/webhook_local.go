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

func (api *API) InitWebhookLocal() {
	api.BaseRoutes.IncomingHooks.Handle("", api.APILocal(localCreateIncomingHook)).Methods("POST")
	api.BaseRoutes.IncomingHooks.Handle("", api.APILocal(getIncomingHooks)).Methods("GET")
	api.BaseRoutes.IncomingHook.Handle("", api.APILocal(getIncomingHook)).Methods("GET")
	api.BaseRoutes.IncomingHook.Handle("", api.APILocal(updateIncomingHook)).Methods("PUT")
	api.BaseRoutes.IncomingHook.Handle("", api.APILocal(deleteIncomingHook)).Methods("DELETE")

	api.BaseRoutes.OutgoingHooks.Handle("", api.APILocal(localCreateOutgoingHook)).Methods("POST")
	api.BaseRoutes.OutgoingHooks.Handle("", api.APILocal(getOutgoingHooks)).Methods("GET")
	api.BaseRoutes.OutgoingHook.Handle("", api.APILocal(getOutgoingHook)).Methods("GET")
	api.BaseRoutes.OutgoingHook.Handle("", api.APILocal(updateOutgoingHook)).Methods("PUT")
	api.BaseRoutes.OutgoingHook.Handle("", api.APILocal(deleteOutgoingHook)).Methods("DELETE")
}

func localCreateIncomingHook(c *Context, w http.ResponseWriter, r *http.Request) {
	var hook model.IncomingWebhook
	if jsonErr := json.NewDecoder(r.Body).Decode(&hook); jsonErr != nil {
		c.SetInvalidParamWithErr("incoming_webhook", jsonErr)
		return
	}

	if hook.UserId == "" {
		c.SetInvalidParam("user_id")
		return
	}

	channel, err := c.App.GetChannel(c.AppContext, hook.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	if _, err = c.App.GetUser(hook.UserId); err != nil {
		c.Err = err
		return
	}

	auditRec := c.MakeAuditRecord("localCreateIncomingHook", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddEventParameter("hook", &hook)
	auditRec.AddEventParameter("channel", channel)
	c.LogAudit("attempt")

	incomingHook, err := c.App.CreateIncomingWebhookForChannel(hook.UserId, channel, &hook)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(incomingHook)
	auditRec.AddEventObjectType("incoming_webhook")
	c.LogAudit("success")

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(incomingHook); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func localCreateOutgoingHook(c *Context, w http.ResponseWriter, r *http.Request) {
	var hook model.OutgoingWebhook
	if jsonErr := json.NewDecoder(r.Body).Decode(&hook); jsonErr != nil {
		c.SetInvalidParamWithErr("outgoing_webhook", jsonErr)
		return
	}

	auditRec := c.MakeAuditRecord("createOutgoingHook", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddEventParameter("hook", &hook)
	c.LogAudit("attempt")

	if hook.CreatorId == "" {
		c.SetInvalidParam("creator_id")
		return
	}

	_, err := c.App.GetUser(hook.CreatorId)
	if err != nil {
		c.Err = err
		return
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
