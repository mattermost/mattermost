// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/model"
)

func (a *App) GetGroup(id string) (*model.Group, *model.AppError) {
	return a.Srv.Store.Group().Get(id)
}

func (a *App) GetGroupByName(name string) (*model.Group, *model.AppError) {
	return a.Srv.Store.Group().GetByName(name)
}

func (a *App) GetGroupByRemoteID(remoteID string, groupSource model.GroupSource) (*model.Group, *model.AppError) {
	return a.Srv.Store.Group().GetByRemoteID(remoteID, groupSource)
}

func (a *App) GetGroupsBySource(groupSource model.GroupSource) ([]*model.Group, *model.AppError) {
	return a.Srv.Store.Group().GetAllBySource(groupSource)
}

func (a *App) GetGroupsByUserId(userId string) ([]*model.Group, *model.AppError) {
	return a.Srv.Store.Group().GetByUser(userId)
}

func (a *App) CreateGroup(group *model.Group) (*model.Group, *model.AppError) {
	return a.Srv.Store.Group().Create(group)
}

func (a *App) UpdateGroup(group *model.Group) (*model.Group, *model.AppError) {
	return a.Srv.Store.Group().Update(group)
}

func (a *App) DeleteGroup(groupID string) (*model.Group, *model.AppError) {
	return a.Srv.Store.Group().Delete(groupID)
}

func (a *App) GetGroupMemberUsers(groupID string) ([]*model.User, *model.AppError) {
	return a.Srv.Store.Group().GetMemberUsers(groupID)
}

func (a *App) GetGroupMemberUsersPage(groupID string, page int, perPage int) ([]*model.User, int, *model.AppError) {
	members, err := a.Srv.Store.Group().GetMemberUsersPage(groupID, page, perPage)
	if err != nil {
		return nil, 0, err
	}

	count, err := a.Srv.Store.Group().GetMemberCount(groupID)
	if err != nil {
		return nil, 0, err
	}
	return members, int(count), nil
}

func (a *App) UpsertGroupMember(groupID string, userID string) (*model.GroupMember, *model.AppError) {
	return a.Srv.Store.Group().UpsertMember(groupID, userID)
}

func (a *App) DeleteGroupMember(groupID string, userID string) (*model.GroupMember, *model.AppError) {
	return a.Srv.Store.Group().DeleteMember(groupID, userID)
}

func (a *App) CreateGroupSyncable(groupSyncable *model.GroupSyncable) (*model.GroupSyncable, *model.AppError) {
	return a.Srv.Store.Group().CreateGroupSyncable(groupSyncable)
}

func (a *App) GetGroupSyncable(groupID string, syncableID string, syncableType model.GroupSyncableType) (*model.GroupSyncable, *model.AppError) {
	return a.Srv.Store.Group().GetGroupSyncable(groupID, syncableID, syncableType)
}

func (a *App) GetGroupSyncables(groupID string, syncableType model.GroupSyncableType) ([]*model.GroupSyncable, *model.AppError) {
	return a.Srv.Store.Group().GetAllGroupSyncablesByGroupId(groupID, syncableType)
}

func (a *App) UpdateGroupSyncable(groupSyncable *model.GroupSyncable) (*model.GroupSyncable, *model.AppError) {
	return a.Srv.Store.Group().UpdateGroupSyncable(groupSyncable)
}

func (a *App) DeleteGroupSyncable(groupID string, syncableID string, syncableType model.GroupSyncableType) (*model.GroupSyncable, *model.AppError) {
	return a.Srv.Store.Group().DeleteGroupSyncable(groupID, syncableID, syncableType)
}

func (a *App) TeamMembersToAdd(since int64) ([]*model.UserTeamIDPair, *model.AppError) {
	return a.Srv.Store.Group().TeamMembersToAdd(since)
}

func (a *App) ChannelMembersToAdd(since int64) ([]*model.UserChannelIDPair, *model.AppError) {
	return a.Srv.Store.Group().ChannelMembersToAdd(since)
}

func (a *App) TeamMembersToRemove() ([]*model.TeamMember, *model.AppError) {
	return a.Srv.Store.Group().TeamMembersToRemove()
}

func (a *App) ChannelMembersToRemove() ([]*model.ChannelMember, *model.AppError) {
	return a.Srv.Store.Group().ChannelMembersToRemove()
}

func (a *App) GetGroupsByChannel(channelId string, opts model.GroupSearchOpts) ([]*model.Group, int, *model.AppError) {
	groups, err := a.Srv.Store.Group().GetGroupsByChannel(channelId, opts)
	if err != nil {
		return nil, 0, err
	}

	count, err := a.Srv.Store.Group().CountGroupsByChannel(channelId, opts)
	if err != nil {
		return nil, 0, err
	}

	return groups, int(count), nil
}

func (a *App) GetGroupsByTeam(teamId string, opts model.GroupSearchOpts) ([]*model.Group, int, *model.AppError) {
	groups, err := a.Srv.Store.Group().GetGroupsByTeam(teamId, opts)
	if err != nil {
		return nil, 0, err
	}

	count, err := a.Srv.Store.Group().CountGroupsByTeam(teamId, opts)
	if err != nil {
		return nil, 0, err
	}

	return groups, int(count), nil
}

func (a *App) GetGroups(page, perPage int, opts model.GroupSearchOpts) ([]*model.Group, *model.AppError) {
	return a.Srv.Store.Group().GetGroups(page, perPage, opts)
}

// TeamMembersMinusGroupMembers returns the set of users on the given team minus the set of users in the given
// groups.
//
// The result can be used, for example, to determine the set of users who would be removed from a team if the team
// were group-constrained with the given groups.
func (a *App) TeamMembersMinusGroupMembers(teamID string, groupIDs []string, page, perPage int) ([]*model.UserWithGroups, int64, *model.AppError) {
	users, err := a.Srv.Store.Group().TeamMembersMinusGroupMembers(teamID, groupIDs, page, perPage)
	if err != nil {
		return nil, 0, err
	}

	// parse all group ids of all users
	allUsersGroupIDMap := map[string]bool{}
	for _, user := range users {
		for _, groupID := range user.GetGroupIDs() {
			allUsersGroupIDMap[groupID] = true
		}
	}

	// create a slice of distinct group ids
	var allUsersGroupIDSlice []string
	for key := range allUsersGroupIDMap {
		allUsersGroupIDSlice = append(allUsersGroupIDSlice, key)
	}

	// retrieve groups from DB
	groups, err := a.GetGroupsByIDs(allUsersGroupIDSlice)
	if err != nil {
		return nil, 0, err
	}

	// map groups by id
	groupMap := map[string]*model.Group{}
	for _, group := range groups {
		groupMap[group.Id] = group
	}

	// populate each instance's groups field
	for _, user := range users {
		user.Groups = []*model.Group{}
		for _, groupID := range user.GetGroupIDs() {
			group, ok := groupMap[groupID]
			if ok {
				user.Groups = append(user.Groups, group)
			}
		}
	}

	totalCount, err := a.Srv.Store.Group().CountTeamMembersMinusGroupMembers(teamID, groupIDs)
	if err != nil {
		return nil, 0, err
	}
	return users, totalCount, nil
}

func (a *App) GetGroupsByIDs(groupIDs []string) ([]*model.Group, *model.AppError) {
	return a.Srv.Store.Group().GetByIDs(groupIDs)
}

// ChannelMembersMinusGroupMembers returns the set of users in the given channel minus the set of users in the given
// groups.
//
// The result can be used, for example, to determine the set of users who would be removed from a channel if the
// channel were group-constrained with the given groups.
func (a *App) ChannelMembersMinusGroupMembers(channelID string, groupIDs []string, page, perPage int) ([]*model.UserWithGroups, int64, *model.AppError) {
	users, err := a.Srv.Store.Group().ChannelMembersMinusGroupMembers(channelID, groupIDs, page, perPage)
	if err != nil {
		return nil, 0, err
	}

	// parse all group ids of all users
	allUsersGroupIDMap := map[string]bool{}
	for _, user := range users {
		for _, groupID := range user.GetGroupIDs() {
			allUsersGroupIDMap[groupID] = true
		}
	}

	// create a slice of distinct group ids
	var allUsersGroupIDSlice []string
	for key := range allUsersGroupIDMap {
		allUsersGroupIDSlice = append(allUsersGroupIDSlice, key)
	}

	// retrieve groups from DB
	groups, err := a.GetGroupsByIDs(allUsersGroupIDSlice)
	if err != nil {
		return nil, 0, err
	}

	// map groups by id
	groupMap := map[string]*model.Group{}
	for _, group := range groups {
		groupMap[group.Id] = group
	}

	// populate each instance's groups field
	for _, user := range users {
		user.Groups = []*model.Group{}
		for _, groupID := range user.GetGroupIDs() {
			group, ok := groupMap[groupID]
			if ok {
				user.Groups = append(user.Groups, group)
			}
		}
	}

	totalCount, err := a.Srv.Store.Group().CountChannelMembersMinusGroupMembers(channelID, groupIDs)
	if err != nil {
		return nil, 0, err
	}
	return users, totalCount, nil
}
