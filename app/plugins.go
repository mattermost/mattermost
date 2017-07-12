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
	configuration interface{}
	router        *mux.Router
}

func (api *PluginAPI) LoadConfiguration(dest interface{}) error {
	if api.configuration == nil {
		return nil
	}
	if b, err := json.Marshal(api.configuration); err != nil {
		return err
	} else {
		return json.Unmarshal(b, dest)
	}
}

func (api *PluginAPI) Router() *mux.Router {
	return api.router
}

func (api *PluginAPI) CreatePost(teamId, userId, channelNameOrId, text string) (*model.Post, *model.AppError) {
	if channel, err := GetOrCreateChannel(teamId, userId, channelNameOrId); err != nil {
		return nil, err
	} else {
		return CreatePost(&model.Post{
			ChannelId: channel.Id,
			Message:   text,
			Type:      model.POST_DEFAULT,
			UserId:    userId,
		}, teamId, true)
	}
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
	for id, p := range map[string]plugin.Plugin{
		"jira": &jira.Plugin{},
	} {
		l4g.Info("Initializing plugin: " + id)
		p.Initialize(&PluginAPI{
			configuration: utils.Cfg.PluginSettings.Plugins[id],
			router:        Srv.Router.PathPrefix("/plugins/" + id).Subrouter(),
		})
	}
}
