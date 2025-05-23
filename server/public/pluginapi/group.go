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

// UpsertMember adds a user to a group or updates their existing membership.
//
// Minimum server version: 10.7
func (g *GroupService) UpsertMember(groupID string, userID string) (*model.GroupMember, error) {
	member, appErr := g.api.UpsertGroupMember(groupID, userID)
	return member, normalizeAppErr(appErr)
}

// UpsertMembers adds multiple users to a group or updates their existing memberships.
//
// Minimum server version: 10.7
func (g *GroupService) UpsertMembers(groupID string, userIDs []string) ([]*model.GroupMember, error) {
	members, appErr := g.api.UpsertGroupMembers(groupID, userIDs)
	return members, normalizeAppErr(appErr)
}

// GetByRemoteID gets a group by its remote ID.
//
// Minimum server version: 10.7
func (g *GroupService) GetByRemoteID(remoteID string, groupSource model.GroupSource) (*model.Group, error) {
	group, appErr := g.api.GetGroupByRemoteID(remoteID, groupSource)
	return group, normalizeAppErr(appErr)
}

// Create creates a new group.
//
// Minimum server version: 10.7
func (g *GroupService) Create(group *model.Group) (*model.Group, error) {
	group, appErr := g.api.CreateGroup(group)
	return group, normalizeAppErr(appErr)
}

// Update updates a group.
//
// Minimum server version: 10.7
func (g *GroupService) Update(group *model.Group) (*model.Group, error) {
	group, appErr := g.api.UpdateGroup(group)
	return group, normalizeAppErr(appErr)
}

// Delete soft deletes a group.
//
// Minimum server version: 10.7
func (g *GroupService) Delete(groupID string) (*model.Group, error) {
	group, appErr := g.api.DeleteGroup(groupID)
	return group, normalizeAppErr(appErr)
}

// Restore restores a soft deleted group.
//
// Minimum server version: 10.7
func (g *GroupService) Restore(groupID string) (*model.Group, error) {
	group, appErr := g.api.RestoreGroup(groupID)
	return group, normalizeAppErr(appErr)
}

// DeleteMember removes a user from a group.
//
// Minimum server version: 10.7
func (g *GroupService) DeleteMember(groupID string, userID string) (*model.GroupMember, error) {
	member, appErr := g.api.DeleteGroupMember(groupID, userID)
	return member, normalizeAppErr(appErr)
}

// GetSyncable gets a group syncable.
//
// Minimum server version: 10.7
func (g *GroupService) GetSyncable(groupID string, syncableID string, syncableType model.GroupSyncableType) (*model.GroupSyncable, error) {
	syncable, appErr := g.api.GetGroupSyncable(groupID, syncableID, syncableType)
	return syncable, normalizeAppErr(appErr)
}

// GetSyncables gets all group syncables for the given group.
//
// Minimum server version: 10.7
func (g *GroupService) GetSyncables(groupID string, syncableType model.GroupSyncableType) ([]*model.GroupSyncable, error) {
	syncables, appErr := g.api.GetGroupSyncables(groupID, syncableType)
	return syncables, normalizeAppErr(appErr)
}

// UpsertSyncable creates or updates a group syncable.
//
// Minimum server version: 10.7
func (g *GroupService) UpsertSyncable(groupSyncable *model.GroupSyncable) (*model.GroupSyncable, error) {
	syncable, appErr := g.api.UpsertGroupSyncable(groupSyncable)
	return syncable, normalizeAppErr(appErr)
}

// UpdateSyncable updates a group syncable.
//
// Minimum server version: 10.7
func (g *GroupService) UpdateSyncable(groupSyncable *model.GroupSyncable) (*model.GroupSyncable, error) {
	syncable, appErr := g.api.UpdateGroupSyncable(groupSyncable)
	return syncable, normalizeAppErr(appErr)
}

// DeleteSyncable deletes a group syncable.
//
// Minimum server version: 10.7
func (g *GroupService) DeleteSyncable(groupID string, syncableID string, syncableType model.GroupSyncableType) (*model.GroupSyncable, error) {
	syncable, appErr := g.api.DeleteGroupSyncable(groupID, syncableID, syncableType)
	return syncable, normalizeAppErr(appErr)
}

// GetGroups returns a list of all groups with the given options and restrictions.
//
// Minimum server version: 10.7
func (g *GroupService) GetGroups(page, perPage int, opts model.GroupSearchOpts, viewRestrictions *model.ViewUsersRestrictions) ([]*model.Group, error) {
	groups, appErr := g.api.GetGroups(page, perPage, opts, viewRestrictions)
	return groups, normalizeAppErr(appErr)
}

// CreateDefaultSyncableMemberships creates default syncable memberships based off the provided parameters.
//
// Minimum server version: 10.9
func (g *GroupService) CreateDefaultSyncableMemberships(params model.CreateDefaultMembershipParams) error {
	appErr := g.api.CreateDefaultSyncableMemberships(params)
	return normalizeAppErr(appErr)
}

// DeleteGroupConstrainedMemberships deletes team and channel memberships of users who aren't members of the allowed groups of all group-constrained teams and channels.
//
// Minimum server version: 10.9
func (g *GroupService) DeleteGroupConstrainedMemberships() error {
	appErr := g.api.DeleteGroupConstrainedMemberships()
	return normalizeAppErr(appErr)
}
