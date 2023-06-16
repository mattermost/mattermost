package pluginapi

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

// GroupService exposes methods to manipulate groups.
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
func (g *GroupService) GetByName(name string) (*model.Group, error) {
	group, appErr := g.api.GetGroupByName(name)

	return group, normalizeAppErr(appErr)
}

// GetMemberUsers gets a page of users from the given group.
//
// Minimum server version: 5.35
func (g *GroupService) GetMemberUsers(groupID string, page, perPage int) ([]*model.User, error) {
	users, appErr := g.api.GetGroupMemberUsers(groupID, page, perPage)

	return users, normalizeAppErr(appErr)
}

// GetBySource gets a list of all groups for the given source.
//
// @tag Group
// Minimum server version: 5.35
func (g *GroupService) GetBySource(groupSource model.GroupSource) ([]*model.Group, error) {
	groups, appErr := g.api.GetGroupsBySource(groupSource)

	return groups, normalizeAppErr(appErr)
}

// ListForUser gets the groups a user is in.
//
// Minimum server version: 5.18
func (g *GroupService) ListForUser(userID string) ([]*model.Group, error) {
	groups, appErr := g.api.GetGroupsForUser(userID)

	return groups, normalizeAppErr(appErr)
}
