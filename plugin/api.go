// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package plugin

import (
	"github.com/mattermost/mattermost-server/model"
)

// The API can be used to retrieve data or perform actions on behalf of the plugin. Most methods
// have direct counterparts in the REST API and very similar behavior.
//
// Plugins can obtain access to the API by implementing the OnActivate hook.
type API interface {
	// LoadPluginConfiguration loads the plugin's configuration. dest should be a pointer to a
	// struct that the configuration JSON can be unmarshalled to.
	LoadPluginConfiguration(dest interface{}) error

	// CreateUser creates a user.
	CreateUser(user *model.User) (*model.User, *model.AppError)

	// DeleteUser deletes a user.
	DeleteUser(userId string) *model.AppError

	// GetUser gets a user.
	GetUser(userId string) (*model.User, *model.AppError)

	// GetUserByEmail gets a user by their email address.
	GetUserByEmail(email string) (*model.User, *model.AppError)

	// GetUserByUsername gets a user by their username.
	GetUserByUsername(name string) (*model.User, *model.AppError)

	// UpdateUser updates a user.
	UpdateUser(user *model.User) (*model.User, *model.AppError)

	// CreateTeam creates a team.
	CreateTeam(team *model.Team) (*model.Team, *model.AppError)

	// DeleteTeam deletes a team.
	DeleteTeam(teamId string) *model.AppError

	// GetTeam gets a team.
	GetTeam(teamId string) (*model.Team, *model.AppError)

	// GetTeamByName gets a team by its name.
	GetTeamByName(name string) (*model.Team, *model.AppError)

	// UpdateTeam updates a team.
	UpdateTeam(team *model.Team) (*model.Team, *model.AppError)

	// CreateChannel creates a channel.
	CreateChannel(channel *model.Channel) (*model.Channel, *model.AppError)

	// DeleteChannel deletes a channel.
	DeleteChannel(channelId string) *model.AppError

	// GetChannel gets a channel.
	GetChannel(channelId string) (*model.Channel, *model.AppError)

	// GetChannelByName gets a channel by its name.
	GetChannelByName(name, teamId string) (*model.Channel, *model.AppError)

	// GetDirectChannel gets a direct message channel.
	GetDirectChannel(userId1, userId2 string) (*model.Channel, *model.AppError)

	// GetGroupChannel gets a group message channel.
	GetGroupChannel(userIds []string) (*model.Channel, *model.AppError)

	// UpdateChannel updates a channel.
	UpdateChannel(channel *model.Channel) (*model.Channel, *model.AppError)

	// CreatePost creates a post.
	CreatePost(post *model.Post) (*model.Post, *model.AppError)

	// DeletePost deletes a post.
	DeletePost(postId string) *model.AppError

	// GetPost gets a post.
	GetPost(postId string) (*model.Post, *model.AppError)

	// UpdatePost updates a post.
	UpdatePost(post *model.Post) (*model.Post, *model.AppError)

	// SetKey will persistently store a key-value pair uniquely per plugin.
	SetKey(key string, value interface{}) *model.AppError

	// GetKey will get a key-value pair previously stored by SetKey. Returns nil if
	// key does not exist.
	GetKey(key string) (*model.PluginStoreValue, *model.AppError)

	// DeleteKey will delete a key-value pair previously stored by SetKey. Returns nil if
	// key does not exist.
	DeleteKey(key string) *model.AppError
}
