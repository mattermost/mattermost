// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost-server/v6/model"
)

func (api *API) InitUsage() {
	// GET /api/v4/usage/integrations
	api.BaseRoutes.Usage.Handle("/integrations", api.APISessionRequired(getIntegrationsUsage)).Methods("GET")
}

func getIntegrationsUsage(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*c.App.Config().PluginSettings.Enable {
		json, err := json.Marshal(&model.IntegrationsUsage{})
		if err != nil {
			c.Err = model.NewAppError("Api4.getIntegrationsUsage", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Write(json)
		return
	}

	usage, appErr := c.App.GetIntegrationsUsage()
	if appErr != nil {
		c.Err = appErr
		return
	}

	json, err := json.Marshal(usage)
	if err != nil {
		c.Err = model.NewAppError("Api4.getIntegrationsUsage", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Write(json)
}
