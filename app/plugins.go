// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"encoding/json"
	"net/http"

	l4g "github.com/alecthomas/log4go"

	"github.com/gorilla/mux"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"

	"github.com/mattermost/platform/app/plugin"
	"github.com/mattermost/platform/app/plugin/jira"
)

type PluginAPI struct {
	id     string
	router *mux.Router
}

func (api *PluginAPI) LoadPluginConfiguration(dest interface{}) error {
	if b, err := json.Marshal(utils.Cfg.PluginSettings.Plugins[api.id]); err != nil {
		return err
	} else {
		return json.Unmarshal(b, dest)
	}
}

func (api *PluginAPI) PluginRouter() *mux.Router {
	return api.router
}

func (api *PluginAPI) GetTeamByName(name string) (*model.Team, *model.AppError) {
	return GetTeamByName(name)
}

func (api *PluginAPI) GetUserByName(name string) (*model.User, *model.AppError) {
	return GetUserByUsername(name)
}

func (api *PluginAPI) GetChannelByName(teamId, name string) (*model.Channel, *model.AppError) {
	return GetChannelByName(name, teamId)
}

func (api *PluginAPI) GetDirectChannel(userId1, userId2 string) (*model.Channel, *model.AppError) {
	return GetDirectChannel(userId1, userId2)
}

func (api *PluginAPI) CreatePost(post *model.Post, teamId string) (*model.Post, *model.AppError) {
	return CreatePost(post, teamId, true)
}

func (api *PluginAPI) I18n(id string, r *http.Request) string {
	if r != nil {
		f, _ := utils.GetTranslationsAndLocale(nil, r)
		return f(id)
	}
	f, _ := utils.GetTranslationsBySystemLocale()
	return f(id)
}

func InitPlugins() {
	plugins := map[string]plugin.Plugin{
		"jira": &jira.Plugin{},
	}
	for id, p := range plugins {
		l4g.Info("Initializing plugin: " + id)
		api := &PluginAPI{
			id:     id,
			router: Srv.Router.PathPrefix("/plugins/" + id).Subrouter(),
		}
		p.Initialize(api)
	}
	utils.AddConfigListener(func(before, after *model.Config) {
		for _, p := range plugins {
			p.OnConfigurationChange()
		}
	})
	for _, p := range plugins {
		p.OnConfigurationChange()
	}
}
