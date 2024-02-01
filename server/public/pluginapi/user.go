package pluginapi

import (
	"bytes"
	"io"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

// UserService exposes methods to manipulate users.
type UserService struct {
	api plugin.API
}

// Get gets a user.
//
// Minimum server version: 5.2
func (u *UserService) Get(userID string) (*model.User, error) {
	user, appErr := u.api.GetUser(userID)

	return user, normalizeAppErr(appErr)
}

// GetByEmail gets a user by their email address.
//
// Minimum server version: 5.2
func (u *UserService) GetByEmail(email string) (*model.User, error) {
	user, appErr := u.api.GetUserByEmail(email)

	return user, normalizeAppErr(appErr)
}

// GetByUsername gets a user by their username.
//
// Minimum server version: 5.2
func (u *UserService) GetByUsername(username string) (*model.User, error) {
	user, appErr := u.api.GetUserByUsername(username)

	return user, normalizeAppErr(appErr)
}

// List a list of users based on search options.
//
// Minimum server version: 5.10
func (u *UserService) List(options *model.UserGetOptions) ([]*model.User, error) {
	users, appErr := u.api.GetUsers(options)

	return users, normalizeAppErr(appErr)
}

// ListByUsernames gets users by their usernames.
//
// Minimum server version: 5.6
func (u *UserService) ListByUsernames(usernames []string) ([]*model.User, error) {
	users, appErr := u.api.GetUsersByUsernames(usernames)

	return users, normalizeAppErr(appErr)
}

// ListInChannel returns a page of users in a channel. Page counting starts at 0.
// The sortBy parameter can be: "username" or "status".
//
// Minimum server version: 5.6
func (u *UserService) ListInChannel(channelID, sortBy string, page, perPage int) ([]*model.User, error) {
	users, appErr := u.api.GetUsersInChannel(channelID, sortBy, page, perPage)

	return users, normalizeAppErr(appErr)
}

// ListInTeam gets users in team.
//
// Minimum server version: 5.6
func (u *UserService) ListInTeam(teamID string, page, perPage int) ([]*model.User, error) {
	users, appErr := u.api.GetUsersInTeam(teamID, page, perPage)

	return users, normalizeAppErr(appErr)
}

// Search returns a list of users based on some search criteria.
//
// Minimum server version: 5.6
func (u *UserService) Search(search *model.UserSearch) ([]*model.User, error) {
	users, appErr := u.api.SearchUsers(search)

	return users, normalizeAppErr(appErr)
}

// Create creates a user.
//
// Minimum server version: 5.2
func (u *UserService) Create(user *model.User) error {
	createdUser, appErr := u.api.CreateUser(user)
	if appErr != nil {
		return normalizeAppErr(appErr)
	}

	*user = *createdUser

	return nil
}

// Update updates a user.
//
// Minimum server version: 5.2
func (u *UserService) Update(user *model.User) error {
	updatedUser, appErr := u.api.UpdateUser(user)
	if appErr != nil {
		return normalizeAppErr(appErr)
	}

	*user = *updatedUser

	return nil
}

// Delete deletes a user.
//
// Minimum server version: 5.2
func (u *UserService) Delete(userID string) error {
	appErr := u.api.DeleteUser(userID)

	return normalizeAppErr(appErr)
}

// GetStatus will get a user's status.
//
// Minimum server version: 5.2
func (u *UserService) GetStatus(userID string) (*model.Status, error) {
	status, appErr := u.api.GetUserStatus(userID)

	return status, normalizeAppErr(appErr)
}

// ListStatusesByIDs will return a list of user statuses based on the provided slice of user IDs.
//
// Minimum server version: 5.2
func (u *UserService) ListStatusesByIDs(userIDs []string) ([]*model.Status, error) {
	statuses, appErr := u.api.GetUserStatusesByIds(userIDs)

	return statuses, normalizeAppErr(appErr)
}

// UpdateStatus will set a user's status until the user, or another integration/plugin, sets it back to online.
// The status parameter can be: "online", "away", "dnd", or "offline".
//
// Minimum server version: 5.2
func (u *UserService) UpdateStatus(userID, status string) (*model.Status, error) {
	rStatus, appErr := u.api.UpdateUserStatus(userID, status)

	return rStatus, normalizeAppErr(appErr)
}

// UpdateActive deactivates or reactivates an user.
//
// Minimum server version: 5.8
func (u *UserService) UpdateActive(userID string, active bool) error {
	appErr := u.api.UpdateUserActive(userID, active)

	return normalizeAppErr(appErr)
}

// GetProfileImage gets user's profile image.
//
// Minimum server version: 5.6
func (u *UserService) GetProfileImage(userID string) (io.Reader, error) {
	contentBytes, appErr := u.api.GetProfileImage(userID)
	if appErr != nil {
		return nil, normalizeAppErr(appErr)
	}

	return bytes.NewReader(contentBytes), nil
}

// SetProfileImage sets a user's profile image.
//
// Minimum server version: 5.6
func (u *UserService) SetProfileImage(userID string, content io.Reader) error {
	contentBytes, err := io.ReadAll(content)
	if err != nil {
		return err
	}

	return normalizeAppErr(u.api.SetProfileImage(userID, contentBytes))
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
	return u.api.HasPermissionToTeam(userID, teamID, permission)
}

// HasPermissionToChannel check if the user has the permission at channel scope.
//
// Minimum server version: 5.3
func (u *UserService) HasPermissionToChannel(userID, channelID string, permission *model.Permission) bool {
	return u.api.HasPermissionToChannel(userID, channelID, permission)
}

// RolesGrantPermission check if the specified roles grant the specified permission
//
// Minimum server version: 6.3
func (u *UserService) RolesGrantPermission(roleNames []string, permissionID string) bool {
	return u.api.RolesGrantPermission(roleNames, permissionID)
}

// GetLDAPAttributes will return LDAP attributes for a user.
// The attributes parameter should be a list of attributes to pull.
// Returns a map with attribute names as keys and the user's attributes as values.
// Requires an enterprise license, LDAP to be configured and for the user to use LDAP as an authentication method.
//
// Minimum server version: 5.3
func (u *UserService) GetLDAPAttributes(userID string, attributes []string) (map[string]string, error) {
	ldapUserAttributes, appErr := u.api.GetLDAPUserAttributes(userID, attributes)

	return ldapUserAttributes, normalizeAppErr(appErr)
}

// CreateAccessToken creates a new access token.
//
// Minimum server version: 5.38
func (u *UserService) CreateAccessToken(userID, description string) (*model.UserAccessToken, error) {
	token := &model.UserAccessToken{
		UserId:      userID,
		Description: description,
	}

	createdToken, appErr := u.api.CreateUserAccessToken(token)

	return createdToken, normalizeAppErr(appErr)
}

// RevokeAccessToken revokes an existing access token.
//
// Minimum server version: 5.38
func (u *UserService) RevokeAccessToken(tokenID string) error {
	return normalizeAppErr(u.api.RevokeUserAccessToken(tokenID))
}
