// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (api *API) InitAI() {
	// GET /api/v4/ai/agents
	api.BaseRoutes.AI.Handle("/agents", api.APISessionRequired(getAIAgents)).Methods(http.MethodGet)
	// GET /api/v4/ai/services
	api.BaseRoutes.AI.Handle("/services", api.APISessionRequired(getAIServices)).Methods(http.MethodGet)
}

func getAIAgents(c *Context, w http.ResponseWriter, r *http.Request) {
	agents, appErr := c.App.GetAIAgents(c.AppContext, c.AppContext.Session().UserId)
	if appErr != nil {
		c.Err = model.NewAppError("Api4.getAIAgents", "app.ai.get_agents.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
		return
	}

	jsonData, err := json.Marshal(agents)
	if err != nil {
		c.Err = model.NewAppError("Api4.getAIAgents", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(jsonData); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getAIServices(c *Context, w http.ResponseWriter, r *http.Request) {
	services, appErr := c.App.GetAIServices(c.AppContext, c.AppContext.Session().UserId)
	if appErr != nil {
		c.Err = model.NewAppError("Api4.getAIServices", "app.ai.get_services.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
		return
	}

	jsonData, err := json.Marshal(services)
	if err != nil {
		c.Err = model.NewAppError("Api4.getAIServices", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(jsonData); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
