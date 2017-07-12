package jira

import (
	"crypto/subtle"
	"encoding/json"
	"net/http"

	"github.com/mattermost/platform/app/plugin"
)

type Plugin struct {
	api           plugin.API
	Configuration Configuration
}

func (p *Plugin) Initialize(api plugin.API) {
	p.api = api
	if err := api.LoadConfiguration(&p.Configuration); err != nil {
		panic(err)
	}
	api.Router().HandleFunc("/webhook", p.handleWebhook).Methods("POST")
}

func (p *Plugin) handleWebhook(w http.ResponseWriter, r *http.Request) {
	if p.Configuration.Secret == "" || p.Configuration.UserId == "" {
		http.Error(w, "This plugin is not configured.", http.StatusForbidden)
	} else if subtle.ConstantTimeCompare([]byte(r.URL.Query().Get("secret")), []byte(p.Configuration.Secret)) != 1 {
		http.Error(w, "You must provide the configured secret.", http.StatusForbidden)
	} else {
		var webhook Webhook
		if err := json.NewDecoder(r.Body).Decode(&webhook); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
		} else if text, err := webhook.PostText(); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		} else if text != "" {
			if _, err := p.api.CreatePost(r.URL.Query().Get("team"), p.Configuration.UserId, r.URL.Query().Get("channel"), text); err != nil {
				http.Error(w, p.api.I18n(err.Message, r), err.StatusCode)
			}
		}
	}
}
