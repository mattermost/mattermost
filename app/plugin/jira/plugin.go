// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package jira

import (
	"crypto/subtle"
	"encoding/json"
	"net/http"
	"sync/atomic"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/app/plugin"
	"github.com/mattermost/platform/model"
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
	if !config.Enabled || config.Secret == "" || config.UserName == "" {
		http.Error(w, "This plugin is not configured.", http.StatusForbidden)
		return
	} else if subtle.ConstantTimeCompare([]byte(r.URL.Query().Get("secret")), []byte(config.Secret)) != 1 {
		http.Error(w, "You must provide the configured secret.", http.StatusForbidden)
		return
	}

	var webhook Webhook

	if err := json.NewDecoder(r.Body).Decode(&webhook); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
	} else if attachment, err := webhook.SlackAttachment(); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	} else if attachment == nil {
		return
	} else if r.URL.Query().Get("channel") == "" {
		http.Error(w, "You must provide a channel.", http.StatusBadRequest)
	} else if user, err := p.api.GetUserByName(config.UserName); err != nil {
		http.Error(w, p.api.I18n(err.Message, r), err.StatusCode)
	} else if team, err := p.api.GetTeamByName(r.URL.Query().Get("team")); err != nil {
		http.Error(w, p.api.I18n(err.Message, r), err.StatusCode)
	} else if channel, err := p.api.GetChannelByName(team.Id, r.URL.Query().Get("channel")); err != nil {
		http.Error(w, p.api.I18n(err.Message, r), err.StatusCode)
	} else if _, err := p.api.CreatePost(&model.Post{
		ChannelId: channel.Id,
		Type:      model.POST_SLACK_ATTACHMENT,
		UserId:    user.Id,
		Props: map[string]interface{}{
			"from_webhook": "true",
			"attachments":  []*model.SlackAttachment{attachment},
		},
	}, channel.TeamId); err != nil {
		http.Error(w, p.api.I18n(err.Message, r), err.StatusCode)
	}
}
