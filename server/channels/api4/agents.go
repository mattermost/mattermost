// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (api *API) InitAgents() {
	// GET /api/v4/agents
	api.BaseRoutes.Agents.Handle("", api.APISessionRequired(getAgents)).Methods(http.MethodGet)
	// GET /api/v4/llmservices
	api.BaseRoutes.LLMServices.Handle("", api.APISessionRequired(getLLMServices)).Methods(http.MethodGet)
}

func getAgents(c *Context, w http.ResponseWriter, r *http.Request) {
	agents, appErr := c.App.GetAgents(c.AppContext, c.AppContext.Session().UserId)
	if appErr != nil {
		c.Err = model.NewAppError("Api4.getAgents", "app.agents.get_agents.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
		return
	}

	jsonData, err := json.Marshal(agents)
	if err != nil {
		c.Err = model.NewAppError("Api4.getAgents", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(jsonData); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getLLMServices(c *Context, w http.ResponseWriter, r *http.Request) {
	services, appErr := c.App.GetLLMServices(c.AppContext, c.AppContext.Session().UserId)
	if appErr != nil {
		c.Err = model.NewAppError("Api4.getLLMServices", "app.agents.get_services.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
		return
	}

	jsonData, err := json.Marshal(services)
	if err != nil {
		c.Err = model.NewAppError("Api4.getLLMServices", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(jsonData); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
