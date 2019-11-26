package pluginapi

import (
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
)

// GroupService exposes methods to read and write the groups of a Mattermost server.
type GroupService struct {
	api plugin.API
}

// Get gets a group by ID.
//
// Minimum server version: 5.18
func (g *GroupService) Get(groupID string) (*model.Group, error) {
	group, appErr := g.api.GetGroup(groupID)

	return group, normalizeAppErr(appErr)
}

// GetByName gets a group by name.
//
// Minimum server version: 5.18
func (g *GroupSevice) GetByName(name string) (*model.Group, error) {
	group, appErr := g.api.GetGroupByName(groupID)

	return group, normalizeAppErr(appErr)
}

// ListForUser gets the groups a user is in.
//
// Minimum server version: 5.18
func (g *GroupService) ListForUser(userID string) ([]*model.Group, error) {
	groups, appErr := g.api.GetGroupsForUser(userID)

	return groups, normalizeAppErr(appErr)
}
