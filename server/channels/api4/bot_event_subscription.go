// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// botEventsCursorMaxSkew is how far ahead of the server clock a cursor may be.
const botEventsCursorMaxSkew = 60 * 1000

func (api *API) InitBotEventSubscription() {
	api.BaseRoutes.Bot.Handle("/event_subscription", api.APISessionRequired(upsertBotEventSubscription)).Methods(http.MethodPut)
	api.BaseRoutes.Bot.Handle("/event_subscription", api.APISessionRequired(getBotEventSubscription)).Methods(http.MethodGet)
	api.BaseRoutes.Bot.Handle("/event_subscription", api.APISessionRequired(deleteBotEventSubscription)).Methods(http.MethodDelete)
	api.BaseRoutes.Bot.Handle("/event_subscription/regenerate_secret", api.APISessionRequired(regenerateBotEventSubscriptionSecret)).Methods(http.MethodPost)
	api.BaseRoutes.Bot.Handle("/event_subscription/enable", api.APISessionRequired(enableBotEventSubscription)).Methods(http.MethodPost)
	api.BaseRoutes.Bot.Handle("/events", api.APISessionRequired(getBotEvents)).Methods(http.MethodGet)
}

func writeBotEventSubscription(c *Context, w http.ResponseWriter, status int, sub *model.BotEventSubscription) {
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(sub); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// requireBotEventSubscriptionManager checks that the session may manage the bot's
// subscription. The secret is returned by some of these routes, so OAuth sessions
// are rejected where asked, matching personal access token management.
func requireBotEventSubscriptionManager(c *Context, botUserId string, rejectOAuth bool) bool {
	if appErr := c.App.SessionHasPermissionToManageBot(c.AppContext, *c.AppContext.Session(), botUserId); appErr != nil {
		c.Err = appErr
		return false
	}
	if rejectOAuth && c.AppContext.Session().IsOAuth {
		c.SetPermissionError(model.PermissionManageBots)
		return false
	}
	return true
}

func upsertBotEventSubscription(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireBotUserId()
	if c.Err != nil {
		return
	}
	botUserId := c.Params.BotUserId

	var patch *model.BotEventSubscriptionPatch
	if err := json.NewDecoder(r.Body).Decode(&patch); err != nil || patch == nil {
		c.SetInvalidParamWithErr("event_subscription", err)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventUpdateBotEventSubscription, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "bot_user_id", botUserId)
	model.AddEventParameterAuditableToAuditRec(auditRec, "event_subscription", patch)

	if !requireBotEventSubscriptionManager(c, botUserId, true) {
		return
	}

	sub, created, appErr := c.App.CreateOrUpdateBotEventSubscription(c.AppContext, botUserId, patch)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventObjectType("bot_event_subscription")
	auditRec.AddEventResultState(sub)

	status := http.StatusOK
	if created {
		status = http.StatusCreated
	}
	writeBotEventSubscription(c, w, status, sub)
}

func getBotEventSubscription(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireBotUserId()
	if c.Err != nil {
		return
	}
	botUserId := c.Params.BotUserId

	if !requireBotEventSubscriptionManager(c, botUserId, false) {
		return
	}

	sub, appErr := c.App.GetBotEventSubscription(c.AppContext, botUserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	writeBotEventSubscription(c, w, http.StatusOK, sub)
}

func deleteBotEventSubscription(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireBotUserId()
	if c.Err != nil {
		return
	}
	botUserId := c.Params.BotUserId

	auditRec := c.MakeAuditRecord(model.AuditEventDeleteBotEventSubscription, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "bot_user_id", botUserId)

	if !requireBotEventSubscriptionManager(c, botUserId, false) {
		return
	}

	if appErr := c.App.DeleteBotEventSubscription(c.AppContext, botUserId); appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventObjectType("bot_event_subscription")

	ReturnStatusOK(w)
}

func regenerateBotEventSubscriptionSecret(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireBotUserId()
	if c.Err != nil {
		return
	}
	botUserId := c.Params.BotUserId

	auditRec := c.MakeAuditRecord(model.AuditEventRegenerateBotEventSubscriptionSecret, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "bot_user_id", botUserId)

	if !requireBotEventSubscriptionManager(c, botUserId, true) {
		return
	}

	sub, appErr := c.App.RegenerateBotEventSubscriptionSecret(c.AppContext, botUserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventObjectType("bot_event_subscription")
	auditRec.AddEventResultState(sub)

	writeBotEventSubscription(c, w, http.StatusOK, sub)
}

func enableBotEventSubscription(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireBotUserId()
	if c.Err != nil {
		return
	}
	botUserId := c.Params.BotUserId

	auditRec := c.MakeAuditRecord(model.AuditEventEnableBotEventSubscription, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "bot_user_id", botUserId)

	if !requireBotEventSubscriptionManager(c, botUserId, false) {
		return
	}

	sub, appErr := c.App.EnableBotEventSubscription(c.AppContext, botUserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventObjectType("bot_event_subscription")
	auditRec.AddEventResultState(sub)

	writeBotEventSubscription(c, w, http.StatusOK, sub)
}

func getBotEvents(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireBotUserId()
	if c.Err != nil {
		return
	}
	botUserId := c.Params.BotUserId

	if c.AppContext.Session().UserId != botUserId {
		c.Err = model.NewAppError("getBotEvents", "api.bot_event.pull.not_bot_session.app_error", nil, "", http.StatusForbidden)
		return
	}

	opts, ok := parseBotEventsOptions(c, r)
	if !ok {
		return
	}

	list, appErr := c.App.GetBotEvents(c.AppContext.WithContext(r.Context()), botUserId, opts)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(list); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func parseBotEventsOptions(c *Context, r *http.Request) (model.BotEventsOptions, bool) {
	query := r.URL.Query()
	opts := model.BotEventsOptions{Limit: model.BotEventsDefaultLimit}

	if raw := query.Get("cursor"); raw != "" {
		cursor, err := model.DecodeBotEventCursor(raw)
		if err != nil || cursor.CreateAt > model.GetMillis()+botEventsCursorMaxSkew {
			c.SetInvalidURLParam("cursor")
			return opts, false
		}
		opts.Cursor = &cursor
	}

	if raw := query.Get("limit"); raw != "" {
		limit, err := strconv.Atoi(raw)
		if err != nil {
			c.SetInvalidURLParam("limit")
			return opts, false
		}
		if limit > 0 {
			opts.Limit = min(limit, model.BotEventsMaxLimit)
		}
	}

	if raw := query.Get("wait"); raw != "" {
		seconds, err := strconv.Atoi(raw)
		if err != nil || seconds < 0 {
			c.SetInvalidURLParam("wait")
			return opts, false
		}
		opts.Wait = time.Duration(min(seconds, int(model.BotEventsMaxWait/time.Second))) * time.Second
	}

	return opts, true
}
