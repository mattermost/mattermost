// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"net/http"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-plugin-playbooks/server/config"

	"github.com/mattermost/mattermost/server/public/pluginapi"
)

// SettingsHandler is the API handler.
type SettingsHandler struct {
	*ErrorHandler
	pluginAPI *pluginapi.Client
	config    config.Service
}

// NewSettingsHandler returns a new settings api handler
func NewSettingsHandler(router *mux.Router, api *pluginapi.Client, configService config.Service) *SettingsHandler {
	handler := &SettingsHandler{
		ErrorHandler: &ErrorHandler{},
		pluginAPI:    api,
		config:       configService,
	}

	settingsRouter := router.PathPrefix("/settings").Subrouter()
	settingsRouter.HandleFunc("", handler.getSettings).Methods(http.MethodGet)

	return handler
}

func (h *SettingsHandler) getSettings(w http.ResponseWriter, r *http.Request) {
	settings := client.GlobalSettings{
		EnableExperimentalFeatures: h.config.IsExperimentalFeaturesEnabled(),
	}

	ReturnJSON(w, &settings, http.StatusOK)
}
