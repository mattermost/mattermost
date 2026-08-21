package pluginapi

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

// RoleService exposes methods to manipulate roles.
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

// Patch partially updates a role. Only the fields set on the patch are changed.
//
// Adding a space permission is refused unless the role's scheme already governs
// a space, so attach the scheme to the space's channel before patching its
// roles, not after. Removing one is always allowed. A scheme is attached by
// setting SchemeId on the channel and updating it.
//
// The patch applies to the current stored role, resolved by id.
//
// Patching the permissions of a guest role requires a license granting guest
// account permissions; without one the call is refused.
//
// Minimum server version: 11.11
func (r *RoleService) Patch(roleID string, patch *model.RolePatch) (*model.Role, error) {
	patched, appErr := r.api.PatchRole(roleID, patch)

	return patched, normalizeAppErr(appErr)
}
