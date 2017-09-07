package plugin

import (
	"github.com/mattermost/mattermost-server/model"
)

type API interface {
	// LoadPluginConfiguration loads the plugin's configuration. dest should be a pointer to a
	// struct that the configuration JSON can be unmarshalled to.
	LoadPluginConfiguration(dest interface{}) error

	// GetTeamByName gets a team by its name.
	GetTeamByName(name string) (*model.Team, *model.AppError)

	// GetUserByUsername gets a user by their username.
	GetUserByUsername(name string) (*model.User, *model.AppError)

	// GetChannelByName gets a channel by its name.
	GetChannelByName(name, teamId string) (*model.Channel, *model.AppError)

	// CreatePost creates a post.
	CreatePost(post *model.Post) (*model.Post, *model.AppError)
}
