// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package ldapextras

import (
	"fmt"
	"net/http"
	"sync/atomic"

	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/mux"

	"github.com/mattermost/mattermost-server/app/plugin"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

type Plugin struct {
	plugin.Base
	api           plugin.API
	configuration atomic.Value
}

func (p *Plugin) Initialize(api plugin.API) {
	p.api = api
	p.OnConfigurationChange()
	api.PluginRouter().HandleFunc("/users/{user_id:[A-Za-z0-9]+}/attributes", p.handleGetAttributes).Methods("GET")
}

func (p *Plugin) config() *Configuration {
	return p.configuration.Load().(*Configuration)
}

func (p *Plugin) OnConfigurationChange() {
	var configuration Configuration
	if err := p.api.LoadPluginConfiguration(&configuration); err != nil {
		l4g.Error(err.Error())
	}
	p.configuration.Store(&configuration)
}

func (p *Plugin) handleGetAttributes(w http.ResponseWriter, r *http.Request) {
	config := p.config()
	if !config.Enabled || len(config.Attributes) == 0 {
		http.Error(w, "This plugin is not configured", http.StatusNotImplemented)
		return
	}

	session, err := p.api.GetSessionFromRequest(r)

	if session == nil || err != nil {
		http.Error(w, "Invalid session", http.StatusUnauthorized)
		return
	}

	// Only requires a valid session, no other permission checks required

	params := mux.Vars(r)
	id := params["user_id"]

	if len(id) != 26 {
		http.Error(w, "Invalid user id", http.StatusUnauthorized)
	}

	attributes, err := p.api.GetLdapUserAttributes(id, config.Attributes)
	if err != nil {
		err.Translate(utils.T)
		http.Error(w, fmt.Sprintf("Errored getting attributes: %v", err.Error()), http.StatusInternalServerError)
	}

	w.Write([]byte(model.MapToJson(attributes)))
}
