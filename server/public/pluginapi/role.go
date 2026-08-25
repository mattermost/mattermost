package pluginapi

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

// RoleService exposes methods to read roles.
type RoleService struct {
	api plugin.API
}

// GetByName gets a role by its unique name.
//
// Minimum server version: 11.11
func (r *RoleService) GetByName(name string) (*model.Role, error) {
	role, appErr := r.api.GetRoleByName(name)

	return role, normalizeAppErr(appErr)
}
