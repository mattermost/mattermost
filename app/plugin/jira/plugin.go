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

	var userId string
	var text string
	var webhook Webhook

	if err := json.NewDecoder(r.Body).Decode(&webhook); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	} else if text, err = webhook.PostText(); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	} else if text == "" {
		return
	}

	channelParam := r.URL.Query().Get("channel")
	if channelParam == "" {
		http.Error(w, "You must provide a channel.", http.StatusBadRequest)
		return
	}

	if user, err := p.api.GetUserByName(config.UserName); err != nil {
		http.Error(w, p.api.I18n(err.Message, r), err.StatusCode)
		return
	} else {
		userId = user.Id
	}

	var channel *model.Channel

	if channelParam[0] == '@' {
		if user2, err := p.api.GetUserByName(channelParam[1:]); err != nil {
			http.Error(w, p.api.I18n(err.Message, r), err.StatusCode)
			return
		} else if c, err := p.api.GetDirectChannel(userId, user2.Id); err != nil {
			http.Error(w, p.api.I18n(err.Message, r), err.StatusCode)
			return
		} else {
			channel = c
		}
	} else if team, err := p.api.GetTeamByName(r.URL.Query().Get("team")); err != nil {
		http.Error(w, p.api.I18n(err.Message, r), err.StatusCode)
		return
	} else if c, err := p.api.GetChannelByName(team.Id, channelParam); err != nil {
		http.Error(w, p.api.I18n(err.Message, r), err.StatusCode)
		return
	} else {
		channel = c
	}

	if _, err := p.api.CreatePost(channel.TeamId, userId, channel.Id, text); err != nil {
		http.Error(w, p.api.I18n(err.Message, r), err.StatusCode)
	}
}
