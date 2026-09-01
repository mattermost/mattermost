package pluginapi

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

// PermissionService exposes methods to register plugin-owned permissions and roles.
type PermissionService struct {
	api plugin.API
}

// Register registers a permission owned by this plugin.
//
// Minimum server version: 11.10
func (s *PermissionService) Register(permission *model.PluginPermission) error {
	return normalizeAppErr(s.api.RegisterPermission(permission))
}

// RegisterRole registers a custom role owned by this plugin.
//
// Minimum server version: 11.10
func (s *PermissionService) RegisterRole(role *model.PluginRole) (*model.Role, error) {
	r, appErr := s.api.RegisterRole(role)
	return r, normalizeAppErr(appErr)
}

// PatchRole updates a role previously registered by this plugin.
//
// Minimum server version: 11.10
func (s *PermissionService) PatchRole(name string, patch *model.RolePatch) (*model.Role, error) {
	r, appErr := s.api.PatchPluginRole(name, patch)
	return r, normalizeAppErr(appErr)
}

// AssignRole assigns a role owned by this plugin to a user.
//
// Minimum server version: 11.10
func (s *PermissionService) AssignRole(userID, roleName string) (*model.User, error) {
	u, appErr := s.api.AssignPluginRole(userID, roleName)
	return u, normalizeAppErr(appErr)
}

// RemoveRole removes a role owned by this plugin from a user.
//
// Minimum server version: 11.10
func (s *PermissionService) RemoveRole(userID, roleName string) (*model.User, error) {
	u, appErr := s.api.RemovePluginRole(userID, roleName)
	return u, normalizeAppErr(appErr)
}
