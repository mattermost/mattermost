package plugin

import (
	"net/http"

	"github.com/gorilla/mux"
	"github.com/mattermost/platform/model"
)

type API interface {
	// Loads the plugin's configuration
	LoadPluginConfiguration(dest interface{}) error

	// The plugin's router
	PluginRouter() *mux.Router

	// Creates a post
	CreatePost(teamId, userId, channelNameOrId, text string) (*model.Post, *model.AppError)

	// Returns a localized string. If a request is given, its headers will be used to pick a locale.
	I18n(id string, r *http.Request) string
}
