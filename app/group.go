// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

func (a *App) GetGroup(id string) (*model.Group, *model.AppError) {
	return a.Srv().Store.Group().Get(id)
}

func (a *App) GetGroupByName(name string, opts model.GroupSearchOpts) (*model.Group, *model.AppError) {
	return a.Srv().Store.Group().GetByName(name, opts)
}

func (a *App) GetGroupByRemoteID(remoteID string, groupSource model.GroupSource) (*model.Group, *model.AppError) {
	return a.Srv().Store.Group().GetByRemoteID(remoteID, groupSource)
}

func (a *App) GetGroupsBySource(groupSource model.GroupSource) ([]*model.Group, *model.AppError) {
	return a.Srv().Store.Group().GetAllBySource(groupSource)
}

func (a *App) GetGroupsByUserId(userId string) ([]*model.Group, *model.AppError) {
	return a.Srv().Store.Group().GetByUser(userId)
}

func (a *App) CreateGroup(group *model.Group) (*model.Group, *model.AppError) {
	return a.Srv().Store.Group().Create(group)
}

func (a *App) UpdateGroup(group *model.Group) (*model.Group, *model.AppError) {
	updatedGroup, err := a.Srv().Store.Group().Update(group)

	if err == nil {
		messageWs := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_RECEIVED_GROUP, "", "", "", nil)
		messageWs.Add("group", updatedGroup.ToJson())
		a.Publish(messageWs)
	}

	return updatedGroup, err
}

func (a *App) DeleteGroup(groupID string) (*model.Group, *model.AppError) {
	deletedGroup, err := a.Srv().Store.Group().Delete(groupID)

	if err == nil {
		messageWs := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_RECEIVED_GROUP, "", "", "", nil)
		messageWs.Add("group", deletedGroup.ToJson())
		a.Publish(messageWs)
	}

	return deletedGroup, err
}

func (a *App) GetGroupMemberCount(groupID string) (int64, *model.AppError) {
	return a.Srv().Store.Group().GetMemberCount(groupID)
}

func (a *App) GetGroupMemberUsers(groupID string) ([]*model.User, *model.AppError) {
	return a.Srv().Store.Group().GetMemberUsers(groupID)
}

func (a *App) GetGroupMemberUsersPage(groupID string, page int, perPage int) ([]*model.User, int, *model.AppError) {
	members, err := a.Srv().Store.Group().GetMemberUsersPage(groupID, page, perPage)
	if err != nil {
		return nil, 0, err
	}

	count, err := a.GetGroupMemberCount(groupID)
	if err != nil {
		return nil, 0, err
	}
	return members, int(count), nil
}

func (a *App) UpsertGroupMember(groupID string, userID string) (*model.GroupMember, *model.AppError) {
	return a.Srv().Store.Group().UpsertMember(groupID, userID)
}

func (a *App) DeleteGroupMember(groupID string, userID string) (*model.GroupMember, *model.AppError) {
	return a.Srv().Store.Group().DeleteMember(groupID, userID)
}

func (a *App) UpsertGroupSyncable(groupSyncable *model.GroupSyncable) (*model.GroupSyncable, *model.AppError) {
	gs, err := a.Srv().Store.Group().GetGroupSyncable(groupSyncable.GroupId, groupSyncable.SyncableId, groupSyncable.Type)
	if err != nil && err.Id != "store.sql_group.no_rows" {
		return nil, err
	}

	// reject the syncable creation if the group isn't already associated to the parent team
	if groupSyncable.Type == model.GroupSyncableTypeChannel {
		channel, nErr := a.Srv().Store.Channel().Get(groupSyncable.SyncableId, true)
		if nErr != nil {
			var nfErr *store.ErrNotFound
			switch {
			case errors.As(nErr, &nfErr):
				return nil, model.NewAppError("UpsertGroupSyncable", "app.channel.get.existing.app_error", nil, nfErr.Error(), http.StatusNotFound)
			default:
				return nil, model.NewAppError("UpsertGroupSyncable", "app.channel.get.find.app_error", nil, nErr.Error(), http.StatusInternalServerError)
			}
		}

		var team *model.Team
		team, nErr = a.Srv().Store.Team().Get(channel.TeamId)
		if nErr != nil {
			var nfErr *store.ErrNotFound
			switch {
			case errors.As(nErr, &nfErr):
				return nil, model.NewAppError("UpsertGroupSyncable", "app.team.get.find.app_error", nil, nfErr.Error(), http.StatusNotFound)
			default:
				return nil, model.NewAppError("UpsertGroupSyncable", "app.team.get.finding.app_error", nil, nErr.Error(), http.StatusInternalServerError)
			}
		}
		if team.IsGroupConstrained() {
			var teamGroups []*model.GroupWithSchemeAdmin
			teamGroups, err = a.Srv().Store.Group().GetGroupsByTeam(channel.TeamId, model.GroupSearchOpts{})
			if err != nil {
				return nil, err
			}
			var permittedGroup bool
			for _, teamGroup := range teamGroups {
				if teamGroup.Group.Id == groupSyncable.GroupId {
					permittedGroup = true
					break
				}
			}
			if !permittedGroup {
				return nil, model.NewAppError("App.UpsertGroupSyncable", "group_not_associated_to_synced_team", nil, "", http.StatusBadRequest)
			}
		} else {
			_, err = a.UpsertGroupSyncable(model.NewGroupTeam(groupSyncable.GroupId, team.Id, groupSyncable.AutoAdd))
			if err != nil {
				return nil, err
			}
		}
	}

	if gs == nil {
		gs, err = a.Srv().Store.Group().CreateGroupSyncable(groupSyncable)
		if err != nil {
			return nil, err
		}
	} else {
		gs, err = a.Srv().Store.Group().UpdateGroupSyncable(groupSyncable)
		if err != nil {
			return nil, err
		}
	}

	var messageWs *model.WebSocketEvent
	if gs.Type == model.GroupSyncableTypeTeam {
		messageWs = model.NewWebSocketEvent(model.WEBSOCKET_EVENT_RECEIVED_GROUP_ASSOCIATED_TO_TEAM, gs.SyncableId, "", "", nil)
	} else {
		messageWs = model.NewWebSocketEvent(model.WEBSOCKET_EVENT_RECEIVED_GROUP_ASSOCIATED_TO_CHANNEL, "", gs.SyncableId, "", nil)
	}
	messageWs.Add("group_id", gs.GroupId)
	a.Publish(messageWs)

	return gs, nil
}

func (a *App) GetGroupSyncable(groupID string, syncableID string, syncableType model.GroupSyncableType) (*model.GroupSyncable, *model.AppError) {
	return a.Srv().Store.Group().GetGroupSyncable(groupID, syncableID, syncableType)
}

func (a *App) GetGroupSyncables(groupID string, syncableType model.GroupSyncableType) ([]*model.GroupSyncable, *model.AppError) {
	return a.Srv().Store.Group().GetAllGroupSyncablesByGroupId(groupID, syncableType)
}

func (a *App) UpdateGroupSyncable(groupSyncable *model.GroupSyncable) (*model.GroupSyncable, *model.AppError) {
	var gs *model.GroupSyncable
	var err *model.AppError

	if groupSyncable.DeleteAt == 0 {
		// updating a *deleted* GroupSyncable, so no need to ensure the GroupTeam is present (as done in the upsert)
		gs, err = a.Srv().Store.Group().UpdateGroupSyncable(groupSyncable)
	} else {
		// do an upsert to ensure that there's an associated GroupTeam
		gs, err = a.UpsertGroupSyncable(groupSyncable)
	}
	if err != nil {
		return nil, err
	}

	return gs, nil
}

func (a *App) DeleteGroupSyncable(groupID string, syncableID string, syncableType model.GroupSyncableType) (*model.GroupSyncable, *model.AppError) {
	gs, err := a.Srv().Store.Group().DeleteGroupSyncable(groupID, syncableID, syncableType)
	if err != nil {
		return nil, err
	}

	// if a GroupTeam is being deleted delete all associated GroupChannels
	if gs.Type == model.GroupSyncableTypeTeam {
		allGroupChannels, err := a.Srv().Store.Group().GetAllGroupSyncablesByGroupId(gs.GroupId, model.GroupSyncableTypeChannel)
		if err != nil {
			return nil, err
		}

		for _, groupChannel := range allGroupChannels {
			_, err = a.Srv().Store.Group().DeleteGroupSyncable(groupChannel.GroupId, groupChannel.SyncableId, groupChannel.Type)
			if err != nil {
				return nil, err
			}
		}
	}

	var messageWs *model.WebSocketEvent
	if gs.Type == model.GroupSyncableTypeTeam {
		messageWs = model.NewWebSocketEvent(model.WEBSOCKET_EVENT_RECEIVED_GROUP_NOT_ASSOCIATED_TO_TEAM, gs.SyncableId, "", "", nil)
	} else {
		messageWs = model.NewWebSocketEvent(model.WEBSOCKET_EVENT_RECEIVED_GROUP_NOT_ASSOCIATED_TO_CHANNEL, "", gs.SyncableId, "", nil)
	}

	messageWs.Add("group_id", gs.GroupId)
	a.Publish(messageWs)

	return gs, nil
}

func (a *App) TeamMembersToAdd(since int64, teamID *string) ([]*model.UserTeamIDPair, *model.AppError) {
	return a.Srv().Store.Group().TeamMembersToAdd(since, teamID)
}

func (a *App) ChannelMembersToAdd(since int64, channelID *string) ([]*model.UserChannelIDPair, *model.AppError) {
	return a.Srv().Store.Group().ChannelMembersToAdd(since, channelID)
}

func (a *App) TeamMembersToRemove(teamID *string) ([]*model.TeamMember, *model.AppError) {
	return a.Srv().Store.Group().TeamMembersToRemove(teamID)
}

func (a *App) ChannelMembersToRemove(teamID *string) ([]*model.ChannelMember, *model.AppError) {
	return a.Srv().Store.Group().ChannelMembersToRemove(teamID)
}

func (a *App) GetGroupsByChannel(channelId string, opts model.GroupSearchOpts) ([]*model.GroupWithSchemeAdmin, int, *model.AppError) {
	groups, err := a.Srv().Store.Group().GetGroupsByChannel(channelId, opts)
	if err != nil {
		return nil, 0, err
	}

	count, err := a.Srv().Store.Group().CountGroupsByChannel(channelId, opts)
	if err != nil {
		return nil, 0, err
	}

	return groups, int(count), nil
}

// GetGroupsByTeam returns the paged list and the total count of group associated to the given team.
func (a *App) GetGroupsByTeam(teamId string, opts model.GroupSearchOpts) ([]*model.GroupWithSchemeAdmin, int, *model.AppError) {
	groups, err := a.Srv().Store.Group().GetGroupsByTeam(teamId, opts)
	if err != nil {
		return nil, 0, err
	}

	count, err := a.Srv().Store.Group().CountGroupsByTeam(teamId, opts)
	if err != nil {
		return nil, 0, err
	}

	return groups, int(count), nil
}

func (a *App) GetGroupsAssociatedToChannelsByTeam(teamId string, opts model.GroupSearchOpts) (map[string][]*model.GroupWithSchemeAdmin, *model.AppError) {
	groupsAssociatedByChannelId, err := a.Srv().Store.Group().GetGroupsAssociatedToChannelsByTeam(teamId, opts)
	if err != nil {
		return nil, err
	}

	return groupsAssociatedByChannelId, nil
}

func (a *App) GetGroups(page, perPage int, opts model.GroupSearchOpts) ([]*model.Group, *model.AppError) {
	return a.Srv().Store.Group().GetGroups(page, perPage, opts)
}

// TeamMembersMinusGroupMembers returns the set of users on the given team minus the set of users in the given
// groups.
//
// The result can be used, for example, to determine the set of users who would be removed from a team if the team
// were group-constrained with the given groups.
func (a *App) TeamMembersMinusGroupMembers(teamID string, groupIDs []string, page, perPage int) ([]*model.UserWithGroups, int64, *model.AppError) {
	users, err := a.Srv().Store.Group().TeamMembersMinusGroupMembers(teamID, groupIDs, page, perPage)
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

	totalCount, err := a.Srv().Store.Group().CountTeamMembersMinusGroupMembers(teamID, groupIDs)
	if err != nil {
		return nil, 0, err
	}
	return users, totalCount, nil
}

func (a *App) GetGroupsByIDs(groupIDs []string) ([]*model.Group, *model.AppError) {
	return a.Srv().Store.Group().GetByIDs(groupIDs)
}

// ChannelMembersMinusGroupMembers returns the set of users in the given channel minus the set of users in the given
// groups.
//
// The result can be used, for example, to determine the set of users who would be removed from a channel if the
// channel were group-constrained with the given groups.
func (a *App) ChannelMembersMinusGroupMembers(channelID string, groupIDs []string, page, perPage int) ([]*model.UserWithGroups, int64, *model.AppError) {
	users, err := a.Srv().Store.Group().ChannelMembersMinusGroupMembers(channelID, groupIDs, page, perPage)
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

	totalCount, err := a.Srv().Store.Group().CountChannelMembersMinusGroupMembers(channelID, groupIDs)
	if err != nil {
		return nil, 0, err
	}
	return users, totalCount, nil
}

// UserIsInAdminRoleGroup returns true at least one of the user's groups are configured to set the members as
// admins in the given syncable.
func (a *App) UserIsInAdminRoleGroup(userID, syncableID string, syncableType model.GroupSyncableType) (bool, *model.AppError) {
	groupIDs, err := a.Srv().Store.Group().AdminRoleGroupsForSyncableMember(userID, syncableID, syncableType)
	if err != nil {
		return false, err
	}

	if len(groupIDs) == 0 {
		return false, nil
	}

	return true, nil
}
