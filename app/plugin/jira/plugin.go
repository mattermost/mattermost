package jira

import (
	"crypto/subtle"
	"encoding/json"
	"net/http"
	"sync/atomic"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/app/plugin"
)

type Plugin struct {
	plugin.Base
	api           plugin.API
	configuration atomic.Value
}

func (p *Plugin) Initialize(api plugin.API) {
	p.api = api
	p.OnConfigurationChange()
	api.PluginRouter().HandleFunc("/webhook", p.handleWebhook).Methods("POST")
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

func (p *Plugin) handleWebhook(w http.ResponseWriter, r *http.Request) {
	config := p.config()
	if config.Secret == "" || config.UserId == "" {
		http.Error(w, "This plugin is not configured.", http.StatusForbidden)
	} else if subtle.ConstantTimeCompare([]byte(r.URL.Query().Get("secret")), []byte(config.Secret)) != 1 {
		http.Error(w, "You must provide the configured secret.", http.StatusForbidden)
	} else {
		var webhook Webhook
		if err := json.NewDecoder(r.Body).Decode(&webhook); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
		} else if text, err := webhook.PostText(); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		} else if text != "" {
			if _, err := p.api.CreatePost(r.URL.Query().Get("team"), config.UserId, r.URL.Query().Get("channel"), text); err != nil {
				http.Error(w, p.api.I18n(err.Message, r), err.StatusCode)
			}
		}
	}
}
