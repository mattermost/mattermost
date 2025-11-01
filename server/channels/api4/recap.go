// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (api *API) InitRecap() {
	api.BaseRoutes.Recaps.Handle("", api.APISessionRequired(createRecap)).Methods(http.MethodPost)
	api.BaseRoutes.Recaps.Handle("", api.APISessionRequired(getRecaps)).Methods(http.MethodGet)
	api.BaseRoutes.Recaps.Handle("/{recap_id:[A-Za-z0-9]+}", api.APISessionRequired(getRecap)).Methods(http.MethodGet)
	api.BaseRoutes.Recaps.Handle("/{recap_id:[A-Za-z0-9]+}/read", api.APISessionRequired(markRecapAsRead)).Methods(http.MethodPost)
	api.BaseRoutes.Recaps.Handle("/{recap_id:[A-Za-z0-9]+}/regenerate", api.APISessionRequired(regenerateRecap)).Methods(http.MethodPost)
	api.BaseRoutes.Recaps.Handle("/{recap_id:[A-Za-z0-9]+}", api.APISessionRequired(deleteRecap)).Methods(http.MethodDelete)
}

func requireRecapsEnabled(c *Context) {
	if !c.App.Config().FeatureFlags.EnableAIRecaps {
		c.Err = model.NewAppError("requireRecapsEnabled", "api.recap.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}
}

func createRecap(c *Context, w http.ResponseWriter, r *http.Request) {
	requireRecapsEnabled(c)
	if c.Err != nil {
		return
	}

	var req model.CreateRecapRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		c.SetInvalidParamWithErr("body", err)
		return
	}

	if len(req.ChannelIds) == 0 {
		c.SetInvalidParam("channel_ids")
		return
	}

	if req.Title == "" {
		c.SetInvalidParam("title")
		return
	}

	if req.AgentID == "" {
		c.SetInvalidParam("agent_id")
		return
	}

	userID := c.AppContext.Session().UserId
	recap, err := c.App.CreateRecap(c.AppContext, userID, req.Title, req.ChannelIds, req.AgentID)
	if err != nil {
		c.Err = err
		return
	}

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(recap); err != nil {
		c.Logger.Warn("Error encoding response", mlog.Err(err))
	}
}

func getRecap(c *Context, w http.ResponseWriter, r *http.Request) {
	requireRecapsEnabled(c)
	if c.Err != nil {
		return
	}

	c.RequireRecapId()
	if c.Err != nil {
		return
	}

	recap, err := c.App.GetRecap(c.AppContext, c.AppContext.Session().UserId, c.Params.RecapId)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(recap); err != nil {
		c.Logger.Warn("Error encoding response", mlog.Err(err))
	}
}

func getRecaps(c *Context, w http.ResponseWriter, r *http.Request) {
	requireRecapsEnabled(c)
	if c.Err != nil {
		return
	}

	userID := c.AppContext.Session().UserId
	recaps, err := c.App.GetRecapsForUser(c.AppContext, userID, c.Params.Page, c.Params.PerPage)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(recaps); err != nil {
		c.Logger.Warn("Error encoding response", mlog.Err(err))
	}
}

func markRecapAsRead(c *Context, w http.ResponseWriter, r *http.Request) {
	requireRecapsEnabled(c)
	if c.Err != nil {
		return
	}

	c.RequireRecapId()
	if c.Err != nil {
		return
	}

	userID := c.AppContext.Session().UserId
	recap, err := c.App.MarkRecapAsRead(c.AppContext, userID, c.Params.RecapId)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(recap); err != nil {
		c.Logger.Warn("Error encoding response", mlog.Err(err))
	}
}

func regenerateRecap(c *Context, w http.ResponseWriter, r *http.Request) {
	requireRecapsEnabled(c)
	if c.Err != nil {
		return
	}

	c.RequireRecapId()
	if c.Err != nil {
		return
	}

	userID := c.AppContext.Session().UserId
	recap, err := c.App.RegenerateRecap(c.AppContext, userID, c.Params.RecapId)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(recap); err != nil {
		c.Logger.Warn("Error encoding response", mlog.Err(err))
	}
}

func deleteRecap(c *Context, w http.ResponseWriter, r *http.Request) {
	requireRecapsEnabled(c)
	if c.Err != nil {
		return
	}

	c.RequireRecapId()
	if c.Err != nil {
		return
	}

	userID := c.AppContext.Session().UserId
	if err := c.App.DeleteRecap(c.AppContext, userID, c.Params.RecapId); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}
