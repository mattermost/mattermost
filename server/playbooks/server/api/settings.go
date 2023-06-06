// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"net/http"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-server/server/v8/playbooks/client"
	"github.com/mattermost/mattermost-server/server/v8/playbooks/server/config"
	"github.com/mattermost/mattermost-server/server/v8/playbooks/server/playbooks"
)

// SettingsHandler is the API handler.
type SettingsHandler struct {
	*ErrorHandler
	api    playbooks.ServicesAPI
	config config.Service
}

// NewSettingsHandler returns a new settings api handler
func NewSettingsHandler(router *mux.Router, api playbooks.ServicesAPI, configService config.Service) *SettingsHandler {
	handler := &SettingsHandler{
		ErrorHandler: &ErrorHandler{},
		api:          api,
		config:       configService,
	}

	settingsRouter := router.PathPrefix("/settings").Subrouter()
	settingsRouter.HandleFunc("", handler.getSettings).Methods(http.MethodGet)

	return handler
}

func (h *SettingsHandler) getSettings(w http.ResponseWriter, r *http.Request) {
	cfg := h.config.GetConfiguration()
	settings := client.GlobalSettings{
		EnableExperimentalFeatures: cfg.EnableExperimentalFeatures,
	}

	ReturnJSON(w, &settings, http.StatusOK)
}
