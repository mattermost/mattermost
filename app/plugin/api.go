// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

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

	// Gets a team by its name
	GetTeamByName(name string) (*model.Team, *model.AppError)

	// Gets a user by its name
	GetUserByName(name string) (*model.User, *model.AppError)

	// Gets a channel by its name
	GetChannelByName(teamId, name string) (*model.Channel, *model.AppError)

	// Gets a direct message channel
	GetDirectChannel(userId1, userId2 string) (*model.Channel, *model.AppError)

	// Creates a post
	CreatePost(post *model.Post, teamId string) (*model.Post, *model.AppError)

	// Returns a localized string. If a request is given, its headers will be used to pick a locale.
	I18n(id string, r *http.Request) string
}
