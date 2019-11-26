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

// UpdateUser updates a user.
//
// Minimum server version: 5.2
func (u *UserService) UpdateUser(user *model.User) (*model.User, error) {
	user, appErr := u.api.UpdateUser(user)

	return user, normalizeAppErr(appErr)
}

// GetUserStatus will get a user's status.
//
// Minimum server version: 5.2
func (u *UserService) GetUserStatus(userID string) (*model.Status, error) {
	status, appErr := u.api.GetUserStatus(userID)

	return status, normalizeAppErr(appErr)
}

// GetUserStatusesByIDs will return a list of user statuses based on the provided slice of user IDs.
//
// Minimum server version: 5.2
func (u *UserService) GetUserStatusesByIDs(userIDs []string) ([]*model.Status, error) {
	statuses, appErr := u.api.GetUserStatusesByIDs(userIDs)

	return statuses, normalizeAppErr(appErr)
}

// UpdateUserStatus will set a user's status until the user, or another integration/plugin, sets it back to online.
// The status parameter can be: "online", "away", "dnd", or "offline".
//
// Minimum server version: 5.2
func (u *UserService) UpdateUserStatus(userID, status string) (*model.Status, error) {
	status, appErr := u.api.UpdateUserStatus(userID, status)

	return status, normalizeAppErr(appErr)
}

// UpdateUserActive deactivates or reactivates an user.
//
// Minimum server version: 5.8
func (u *UserService) UpdateUserActive(userID string, active bool) error {
	appErr := u.api.UpdateUserActive(userID, active)

	return normalizeAppErr(appErr)
}

// GetUsersInChannel returns a page of users in a channel. Page counting starts at 0.
// The sortBy parameter can be: "username" or "status".
//
// Minimum server version: 5.6
func (u *UserService) GetUsersInChannel(channelID, sortBy string, page, perPage int) ([]*model.User, error) {
	users, appErr := u.api.GetUsersInChannel(channelID, sortBy, page, perPage)

	return users, normalizeAppErr(appErr)
}

// SearchUsers returns a list of users based on some search criteria.
//
// Minimum server version: 5.6
func (u *UserService) SearchUsers(search *model.UserSearch) ([]*model.User, error) {
	users, appErr := u.api.SearchUsers(search)

	return users, normalizeAppErr(appErr)
}

// GetProfileImage gets user's profile image.
//
// Minimum server version: 5.6
func (u *UserService) GetProfileImage(userID string) ([]byte, error) {
	imageBytes, appErr := u.api.GetProfileImage(userID)

	return imageBytes, normalizeAppErr(appErr)
}

// SetProfileImage sets a user's profile image.
//
// Minimum server version: 5.6
func (u *UserService) SetProfileImage(userID string, data []byte) error {
	appErr := u.api.SetProfileImage(userID, data)

	return normalizeAppErr(appErr)
}

// HasPermissionTo check if the user has the permission at system scope.
//
// Minimum server version: 5.3
func (u *UserService) HasPermissionTo(userID string, permission *model.Permission) bool {
	return u.api.HasPermissionTo(userID, permission)
}

// HasPermissionToTeam check if the user has the permission at team scope.
//
// Minimum server version: 5.3
func (u *UserService) HasPermissionToTeam(userID, teamID string, permission *model.Permission) bool {
	return u.api.HasPermissionToTeam(userID, permission)
}

// HasPermissionToChannel check if the user has the permission at channel scope.
//
// Minimum server version: 5.3
func (u *UserService) HasPermissionToChannel(userID, channelID string, permission *model.Permission) bool {
	return u.api.HasPermissionToChannel(userID, permission)
}
