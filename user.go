package pluginapi

import (
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
)

// UserService exposes methods to read and write the users of a Mattermost server.
type UserService struct {
	api plugin.API
}

// CreateUser creates a user.
//
// Minimum server version: 5.2
func (u *UserService) CreateUser(user *model.User) (*model.User, error) {
	user, appErr := u.api.CreateUser(user)

	return user, normalizeAppErr(appErr)
}

// DeleteUser deletes a user.
//
// Minimum server version: 5.2
func (u *UserService) DeleteUser(userID string) error {
	appErr := u.api.DeleteUser(userID)

	return normalizeAppErr(appErr)
}

// GetUsers a list of users based on search options.
//
// Minimum server version: 5.10
func (u *UserService) GetUsers(options *model.UserGetOptions) ([]*model.User, error) {
	users, appErr := u.api.GetUsers(options)

	return users, normalizeAppErr(appErr)
}

// GetUser gets a user.
//
// Minimum server version: 5.2
func (u *UserService) GetUser(userID string) (*model.User, error) {
	user, appErr := u.api.GetUser(userID)

	return user, normalizeAppErr(appErr)
}

// GetUserByEmail gets a user by their email address.
//
// Minimum server version: 5.2
func (u *UserService) GetUserByEmail(email string) (*model.User, error) {
	user, appErr := u.api.GetUserByEmail(email)

	return user, normalizeAppErr(appErr)
}

// GetUserByUsername gets a user by their username.
//
// Minimum server version: 5.2
func (u *UserService) GetUserByUsername(username string) (*model.User, error) {
	user, appErr := u.api.GetUserByUsername(username)

	return user, normalizeAppErr(appErr)
}

// GetUsersByUsernames gets users by their usernames.
//
// Minimum server version: 5.6
func (u *UserService) GetUsersByUsernames(usernames []string) ([]*model.User, error) {
	users, appErr := u.api.GetUsersByUsernames(usernames)

	return users, normalizeAppErr(appErr)
}

// GetUsersInTeam gets users in team.
//
// Minimum server version: 5.6
func (u *UserService) GetUsersInTeam(teamID string, page int, perPage int) ([]*model.User, error) {
	users, appErr := u.api.GetUsersInTeam(teamID, page, perPage)

	return users, normalizeAppErr(appErr)
}
