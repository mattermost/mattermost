// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store"
)

func (a *App) GetGroup(id string, opts *model.GetGroupOpts, viewRestrictions *model.ViewUsersRestrictions) (*model.Group, *model.AppError) {
	group, err := a.Srv().Store().Group().Get(id)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetGroup", "app.group.no_rows", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetGroup", "app.select_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	if opts != nil && opts.IncludeMemberCount {
		memberCount, err := a.Srv().Store().Group().GetMemberCountWithRestrictions(id, viewRestrictions)
		if err != nil {
			return nil, model.NewAppError("GetGroup", "app.member_count", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		group.MemberCount = model.NewInt(int(memberCount))
	}

	return group, nil
}

func (a *App) GetGroupByName(name string, opts model.GroupSearchOpts) (*model.Group, *model.AppError) {
	group, err := a.Srv().Store().Group().GetByName(name, opts)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetGroupByName", "app.group.no_rows", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetGroupByName", "app.select_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return group, nil
}

func (a *App) GetGroupByRemoteID(remoteID string, groupSource model.GroupSource) (*model.Group, *model.AppError) {
	group, err := a.Srv().Store().Group().GetByRemoteID(remoteID, groupSource)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetGroupByRemoteID", "app.group.no_rows", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetGroupByRemoteID", "app.select_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return group, nil
}

func (a *App) GetGroupsBySource(groupSource model.GroupSource) ([]*model.Group, *model.AppError) {
	groups, err := a.Srv().Store().Group().GetAllBySource(groupSource)
	if err != nil {
		return nil, model.NewAppError("GetGroupsBySource", "app.select_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return groups, nil
}

func (a *App) GetGroupsByUserId(userID string) ([]*model.Group, *model.AppError) {
	groups, err := a.Srv().Store().Group().GetByUser(userID)
	if err != nil {
		return nil, model.NewAppError("GetGroupsByUserId", "app.select_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return groups, nil
}

func (a *App) CreateGroup(group *model.Group) (*model.Group, *model.AppError) {
	if err := a.isUniqueToUsernames(group.GetName()); err != nil {
		err.Where = "CreateGroup"
		return nil, err
	}

	group, err := a.Srv().Store().Group().Create(group)
	if err != nil {
		var invErr *store.ErrInvalidInput
		var appErr *model.AppError
		switch {
		case errors.As(err, &appErr):
			return nil, appErr
		case errors.As(err, &invErr):
			return nil, model.NewAppError("CreateGroup", "app.group.id.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		default:
			return nil, model.NewAppError("CreateGroup", "app.insert_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return group, nil
}

func (a *App) isUniqueToUsernames(val string) *model.AppError {
	if val == "" {
		return nil
	}
	var notFoundErr *store.ErrNotFound
	user, err := a.Srv().Store().User().GetByUsername(val)
	if err != nil && !errors.As(err, &notFoundErr) {
		return model.NewAppError("isUniqueToUsernames", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if user != nil {
		return model.NewAppError("isUniqueToUsernames", "app.group.username_conflict", map[string]interface{}{"Username": val}, "", http.StatusBadRequest)
	}
	return nil
}

func (a *App) CreateGroupWithUserIds(group *model.GroupWithUserIds) (*model.Group, *model.AppError) {
	if appErr := a.isUniqueToUsernames(group.GetName()); appErr != nil {
		appErr.Where = "CreateGroupWithUserIds"
		return nil, appErr
	}

	newGroup, err := a.Srv().Store().Group().CreateWithUserIds(group)
	if err != nil {
		var invErr *store.ErrInvalidInput
		var appErr *model.AppError
		var dupKey *store.ErrUniqueConstraint
		switch {
		case errors.As(err, &appErr):
			return nil, appErr
		case errors.As(err, &invErr):
			return nil, model.NewAppError("CreateGroupWithUserIds", "app.group.id.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		case errors.As(err, &dupKey):
			return nil, model.NewAppError("CreateGroupWithUserIds", "app.custom_group.unique_name", nil, "", http.StatusBadRequest).Wrap(err)
		default:
			return nil, model.NewAppError("CreateGroupWithUserIds", "app.insert_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	messageWs := model.NewWebSocketEvent(model.WebsocketEventReceivedGroup, "", "", "", nil, "")
	count, err := a.Srv().Store().Group().GetMemberCount(newGroup.Id)
	if err != nil {
		return nil, model.NewAppError("CreateGroupWithUserIds", "app.group.id.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}
	group.MemberCount = model.NewInt(int(count))
	groupJSON, jsonErr := json.Marshal(newGroup)
	if jsonErr != nil {
		return nil, model.NewAppError("CreateGroupWithUserIds", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
	}
	messageWs.Add("group", string(groupJSON))
	a.Publish(messageWs)

	return newGroup, nil
}

func (a *App) UpdateGroup(group *model.Group) (*model.Group, *model.AppError) {
	if appErr := a.isUniqueToUsernames(group.GetName()); appErr != nil {
		appErr.Where = "UpdateGroup"
		return nil, appErr
	}

	updatedGroup, err := a.Srv().Store().Group().Update(group)
	if err != nil {
		var nfErr *store.ErrNotFound
		var appErr *model.AppError
		var dupKey *store.ErrUniqueConstraint
		switch {
		case errors.As(err, &appErr):
			return nil, appErr
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("UpdateGroup", "app.group.no_rows", nil, "", http.StatusNotFound).Wrap(err)
		case errors.As(err, &dupKey):
			return nil, model.NewAppError("CreateGroup", "app.custom_group.unique_name", nil, "", http.StatusBadRequest).Wrap(err)
		default:
			return nil, model.NewAppError("UpdateGroup", "app.select_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	count, err := a.Srv().Store().Group().GetMemberCount(updatedGroup.Id)
	if err != nil {
		return nil, model.NewAppError("UpdateGroup", "app.group.id.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	updatedGroup.MemberCount = model.NewInt(int(count))
	messageWs := model.NewWebSocketEvent(model.WebsocketEventReceivedGroup, "", "", "", nil, "")

	groupJSON, err := json.Marshal(updatedGroup)
	if err != nil {
		return nil, model.NewAppError("UpdateGroup", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	messageWs.Add("group", string(groupJSON))
	a.Publish(messageWs)

	return updatedGroup, nil
}

func (a *App) DeleteGroup(groupID string) (*model.Group, *model.AppError) {
	deletedGroup, err := a.Srv().Store().Group().Delete(groupID)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("DeleteGroup", "app.group.no_rows", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("DeleteGroup", "app.update_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return deletedGroup, nil
}

func (a *App) RestoreGroup(groupID string) (*model.Group, *model.AppError) {
	restoredGroup, err := a.Srv().Store().Group().Restore(groupID)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("RestoreGroup", "app.group.no_rows", nil, nfErr.Error(), http.StatusNotFound)
		default:
			return nil, model.NewAppError("RestoreGroup", "app.update_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	return restoredGroup, nil
}

func (a *App) GetGroupMemberCount(groupID string, viewRestrictions *model.ViewUsersRestrictions) (int64, *model.AppError) {
	count, err := a.Srv().Store().Group().GetMemberCountWithRestrictions(groupID, viewRestrictions)
	if err != nil {
		return 0, model.NewAppError("GetGroupMemberCount", "app.select_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return count, nil
}

func (a *App) GetGroupMemberUsers(groupID string) ([]*model.User, *model.AppError) {
	users, err := a.Srv().Store().Group().GetMemberUsers(groupID)
	if err != nil {
		return nil, model.NewAppError("GetGroupMemberUsers", "app.select_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return users, nil
}

func (a *App) GetGroupMemberUsersSortedPage(groupID string, page int, perPage int, viewRestrictions *model.ViewUsersRestrictions, teammateNameDisplay string) ([]*model.User, int, *model.AppError) {
	members, err := a.Srv().Store().Group().GetMemberUsersSortedPage(groupID, page, perPage, viewRestrictions, teammateNameDisplay)
	if err != nil {
		return nil, 0, model.NewAppError("GetGroupMemberUsersPage", "app.select_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	count, appErr := a.GetGroupMemberCount(groupID, viewRestrictions)
	if appErr != nil {
		return nil, 0, appErr
	}
	return a.sanitizeProfiles(members, false), int(count), nil
}

func (a *App) GetGroupMemberUsersPage(groupID string, page int, perPage int, viewRestrictions *model.ViewUsersRestrictions) ([]*model.User, int, *model.AppError) {
	return a.GetGroupMemberUsersSortedPage(groupID, page, perPage, viewRestrictions, model.ShowUsername)
}

func (a *App) GetUsersNotInGroupPage(groupID string, page int, perPage int, viewRestrictions *model.ViewUsersRestrictions) ([]*model.User, *model.AppError) {
	members, err := a.Srv().Store().Group().GetNonMemberUsersPage(groupID, page, perPage, viewRestrictions)
	if err != nil {
		return nil, model.NewAppError("GetUsersNotInGroupPage", "app.select_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return a.sanitizeProfiles(members, false), nil
}

func (a *App) UpsertGroupMember(groupID string, userID string) (*model.GroupMember, *model.AppError) {
	groupMember, err := a.Srv().Store().Group().UpsertMember(groupID, userID)
	if err != nil {
		var invErr *store.ErrInvalidInput
		var appErr *model.AppError
		switch {
		case errors.As(err, &appErr):
			return nil, appErr
		case errors.As(err, &invErr):
			return nil, model.NewAppError("UpsertGroupMember", "app.group.uniqueness_error", nil, "", http.StatusBadRequest).Wrap(err)
		default:
			return nil, model.NewAppError("UpsertGroupMember", "app.update_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	if appErr := a.publishGroupMemberEvent(model.WebsocketEventGroupMemberAdd, groupMember); appErr != nil {
		return nil, appErr
	}

	return groupMember, nil
}

func (a *App) DeleteGroupMember(groupID string, userID string) (*model.GroupMember, *model.AppError) {
	groupMember, err := a.Srv().Store().Group().DeleteMember(groupID, userID)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("DeleteGroupMember", "app.group.no_rows", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("DeleteGroupMember", "app.update_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	if appErr := a.publishGroupMemberEvent(model.WebsocketEventGroupMemberDelete, groupMember); appErr != nil {
		return nil, appErr
	}

	return groupMember, nil
}

func (a *App) UpsertGroupSyncable(groupSyncable *model.GroupSyncable) (*model.GroupSyncable, *model.AppError) {
	gs, err := a.Srv().Store().Group().GetGroupSyncable(groupSyncable.GroupId, groupSyncable.SyncableId, groupSyncable.Type)
	var notFoundErr *store.ErrNotFound
	if err != nil && !errors.As(err, &notFoundErr) {
		return nil, model.NewAppError("UpsertGroupSyncable", "app.select_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// reject the syncable creation if the group isn't already associated to the parent team
	if groupSyncable.Type == model.GroupSyncableTypeChannel {
		channel, nErr := a.Srv().Store().Channel().Get(groupSyncable.SyncableId, true)
		if nErr != nil {
			var nfErr *store.ErrNotFound
			switch {
			case errors.As(nErr, &nfErr):
				return nil, model.NewAppError("UpsertGroupSyncable", "app.channel.get.existing.app_error", nil, "", http.StatusNotFound).Wrap(nErr)
			default:
				return nil, model.NewAppError("UpsertGroupSyncable", "app.channel.get.find.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
			}
		}

		var team *model.Team
		team, nErr = a.Srv().Store().Team().Get(channel.TeamId)
		if nErr != nil {
			var nfErr *store.ErrNotFound
			switch {
			case errors.As(nErr, &nfErr):
				return nil, model.NewAppError("UpsertGroupSyncable", "app.team.get.find.app_error", nil, "", http.StatusNotFound).Wrap(nErr)
			default:
				return nil, model.NewAppError("UpsertGroupSyncable", "app.team.get.finding.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
			}
		}
		if team.IsGroupConstrained() {
			var teamGroups []*model.GroupWithSchemeAdmin
			teamGroups, err = a.Srv().Store().Group().GetGroupsByTeam(channel.TeamId, model.GroupSearchOpts{})
			if err != nil {
				return nil, model.NewAppError("UpsertGroupSyncable", "app.select_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
			var permittedGroup bool
			for _, teamGroup := range teamGroups {
				if teamGroup.Group.Id == groupSyncable.GroupId {
					permittedGroup = true
					break
				}
			}
			if !permittedGroup {
				return nil, model.NewAppError("UpsertGroupSyncable", "group_not_associated_to_synced_team", nil, "", http.StatusBadRequest)
			}
		} else {
			_, appErr := a.UpsertGroupSyncable(model.NewGroupTeam(groupSyncable.GroupId, team.Id, groupSyncable.AutoAdd))
			if appErr != nil {
				return nil, appErr
			}
		}
	}

	if gs == nil {
		gs, err = a.Srv().Store().Group().CreateGroupSyncable(groupSyncable)
		if err != nil {
			var nfErr *store.ErrNotFound
			var appErr *model.AppError
			switch {
			case errors.As(err, &appErr):
				return nil, appErr
			case errors.As(err, &nfErr):
				return nil, model.NewAppError("UpsertGroupSyncable", "store.sql_channel.get.existing.app_error", nil, "", http.StatusNotFound).Wrap(err)
			default:
				return nil, model.NewAppError("UpsertGroupSyncable", "app.insert_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
		}
	} else {
		gs, err = a.Srv().Store().Group().UpdateGroupSyncable(groupSyncable)
		if err != nil {
			var appErr *model.AppError
			switch {
			case errors.As(err, &appErr):
				return nil, appErr
			default:
				return nil, model.NewAppError("UpsertGroupSyncable", "app.update_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
		}
	}

	var messageWs *model.WebSocketEvent
	if gs.Type == model.GroupSyncableTypeTeam {
		messageWs = model.NewWebSocketEvent(model.WebsocketEventReceivedGroupAssociatedToTeam, gs.SyncableId, "", "", nil, "")
	} else {
		messageWs = model.NewWebSocketEvent(model.WebsocketEventReceivedGroupAssociatedToChannel, "", gs.SyncableId, "", nil, "")
	}
	messageWs.Add("group_id", gs.GroupId)
	a.Publish(messageWs)

	return gs, nil
}

func (a *App) GetGroupSyncable(groupID string, syncableID string, syncableType model.GroupSyncableType) (*model.GroupSyncable, *model.AppError) {
	group, err := a.Srv().Store().Group().GetGroupSyncable(groupID, syncableID, syncableType)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetGroupSyncable", "app.group.no_rows", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetGroupSyncable", "app.select_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return group, nil
}

func (a *App) GetGroupSyncables(groupID string, syncableType model.GroupSyncableType) ([]*model.GroupSyncable, *model.AppError) {
	groups, err := a.Srv().Store().Group().GetAllGroupSyncablesByGroupId(groupID, syncableType)
	if err != nil {
		return nil, model.NewAppError("GetGroupSyncables", "app.select_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return groups, nil
}

func (a *App) UpdateGroupSyncable(groupSyncable *model.GroupSyncable) (*model.GroupSyncable, *model.AppError) {
	if groupSyncable.DeleteAt == 0 {
		// updating a *deleted* GroupSyncable, so no need to ensure the GroupTeam is present (as done in the upsert)
		gs, err := a.Srv().Store().Group().UpdateGroupSyncable(groupSyncable)
		if err != nil {
			var appErr *model.AppError
			switch {
			case errors.As(err, &appErr):
				return nil, appErr
			default:
				return nil, model.NewAppError("UpdateGroupSyncable", "app.update_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
		}

		return gs, nil
	}

	// do an upsert to ensure that there's an associated GroupTeam
	gs, err := a.UpsertGroupSyncable(groupSyncable)
	if err != nil {
		return nil, err
	}

	return gs, nil
}

func (a *App) DeleteGroupSyncable(groupID string, syncableID string, syncableType model.GroupSyncableType) (*model.GroupSyncable, *model.AppError) {
	gs, err := a.Srv().Store().Group().DeleteGroupSyncable(groupID, syncableID, syncableType)
	if err != nil {
		var invErr *store.ErrInvalidInput
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("DeleteGroupSyncable", "app.group.no_rows", nil, "", http.StatusNotFound).Wrap(err)
		case errors.As(err, &invErr):
			return nil, model.NewAppError("DeleteGroupSyncable", "app.group.group_syncable_already_deleted", nil, "", http.StatusBadRequest).Wrap(err)
		default:
			return nil, model.NewAppError("DeleteGroupSyncable", "app.update_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	// if a GroupTeam is being deleted delete all associated GroupChannels
	if gs.Type == model.GroupSyncableTypeTeam {
		allGroupChannels, err := a.Srv().Store().Group().GetAllGroupSyncablesByGroupId(gs.GroupId, model.GroupSyncableTypeChannel)
		if err != nil {
			return nil, model.NewAppError("DeleteGroupSyncable", "app.select_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		for _, groupChannel := range allGroupChannels {
			_, err = a.Srv().Store().Group().DeleteGroupSyncable(groupChannel.GroupId, groupChannel.SyncableId, groupChannel.Type)
			if err != nil {
				var invErr *store.ErrInvalidInput
				var nfErr *store.ErrNotFound
				switch {
				case errors.As(err, &nfErr):
					return nil, model.NewAppError("DeleteGroupSyncable", "app.group.no_rows", nil, "", http.StatusNotFound).Wrap(err)
				case errors.As(err, &invErr):
					return nil, model.NewAppError("DeleteGroupSyncable", "app.group.group_syncable_already_deleted", nil, "", http.StatusBadRequest).Wrap(err)
				default:
					return nil, model.NewAppError("DeleteGroupSyncable", "app.update_error", nil, "", http.StatusInternalServerError).Wrap(err)
				}
			}
		}
	}

	var messageWs *model.WebSocketEvent
	if gs.Type == model.GroupSyncableTypeTeam {
		messageWs = model.NewWebSocketEvent(model.WebsocketEventReceivedGroupNotAssociatedToTeam, gs.SyncableId, "", "", nil, "")
	} else {
		messageWs = model.NewWebSocketEvent(model.WebsocketEventReceivedGroupNotAssociatedToChannel, "", gs.SyncableId, "", nil, "")
	}

	messageWs.Add("group_id", gs.GroupId)
	a.Publish(messageWs)

	return gs, nil
}

// TeamMembersToAdd returns a slice of UserTeamIDPair that need newly created memberships
// based on the groups configurations. The returned list can be optionally scoped to a single given team.
//
// Typically since will be the last successful group sync time.
// If includeRemovedMembers is true, then team members who left or were removed from the team will
// be included; otherwise, they will be excluded.
func (a *App) TeamMembersToAdd(since int64, teamID *string, includeRemovedMembers bool) ([]*model.UserTeamIDPair, *model.AppError) {
	userTeams, err := a.Srv().Store().Group().TeamMembersToAdd(since, teamID, includeRemovedMembers)
	if err != nil {
		return nil, model.NewAppError("TeamMembersToAdd", "app.select_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return userTeams, nil
}

// ChannelMembersToAdd returns a slice of UserChannelIDPair that need newly created memberships
// based on the groups configurations. The returned list can be optionally scoped to a single given channel.
//
// Typically since will be the last successful group sync time.
// If includeRemovedMembers is true, then channel members who left or were removed from the channel will
// be included; otherwise, they will be excluded.
func (a *App) ChannelMembersToAdd(since int64, channelID *string, includeRemovedMembers bool) ([]*model.UserChannelIDPair, *model.AppError) {
	userChannels, err := a.Srv().Store().Group().ChannelMembersToAdd(since, channelID, includeRemovedMembers)
	if err != nil {
		return nil, model.NewAppError("ChannelMembersToAdd", "app.select_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return userChannels, nil
}

func (a *App) TeamMembersToRemove(teamID *string) ([]*model.TeamMember, *model.AppError) {
	teamMembers, err := a.Srv().Store().Group().TeamMembersToRemove(teamID)
	if err != nil {
		return nil, model.NewAppError("TeamMembersToRemove", "app.select_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return teamMembers, nil
}

func (a *App) ChannelMembersToRemove(teamID *string) ([]*model.ChannelMember, *model.AppError) {
	channelMembers, err := a.Srv().Store().Group().ChannelMembersToRemove(teamID)
	if err != nil {
		return nil, model.NewAppError("ChannelMembersToRemove", "app.select_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return channelMembers, nil
}

func (a *App) GetGroupsByChannel(channelID string, opts model.GroupSearchOpts) ([]*model.GroupWithSchemeAdmin, int, *model.AppError) {
	groups, err := a.Srv().Store().Group().GetGroupsByChannel(channelID, opts)
	if err != nil {
		return nil, 0, model.NewAppError("GetGroupsByChannel", "app.select_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	count, err := a.Srv().Store().Group().CountGroupsByChannel(channelID, opts)
	if err != nil {
		return nil, 0, model.NewAppError("GetGroupsByChannel", "app.select_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return groups, int(count), nil
}

// GetGroupsByTeam returns the paged list and the total count of group associated to the given team.
func (a *App) GetGroupsByTeam(teamID string, opts model.GroupSearchOpts) ([]*model.GroupWithSchemeAdmin, int, *model.AppError) {
	groups, err := a.Srv().Store().Group().GetGroupsByTeam(teamID, opts)
	if err != nil {
		return nil, 0, model.NewAppError("GetGroupsByTeam", "app.select_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	count, err := a.Srv().Store().Group().CountGroupsByTeam(teamID, opts)
	if err != nil {
		return nil, 0, model.NewAppError("GetGroupsByTeam", "app.select_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return groups, int(count), nil
}

func (a *App) GetGroupsAssociatedToChannelsByTeam(teamID string, opts model.GroupSearchOpts) (map[string][]*model.GroupWithSchemeAdmin, *model.AppError) {
	groupsAssociatedByChannelId, err := a.Srv().Store().Group().GetGroupsAssociatedToChannelsByTeam(teamID, opts)
	if err != nil {
		return nil, model.NewAppError("GetGroupsAssociatedToChannelsByTeam", "app.select_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return groupsAssociatedByChannelId, nil
}

func (a *App) GetGroups(page, perPage int, opts model.GroupSearchOpts, viewRestrictions *model.ViewUsersRestrictions) ([]*model.Group, *model.AppError) {
	groups, err := a.Srv().Store().Group().GetGroups(page, perPage, opts, viewRestrictions)
	if err != nil {
		return nil, model.NewAppError("GetGroups", "app.select_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return groups, nil
}

// TeamMembersMinusGroupMembers returns the set of users on the given team minus the set of users in the given
// groups.
//
// The result can be used, for example, to determine the set of users who would be removed from a team if the team
// were group-constrained with the given groups.
func (a *App) TeamMembersMinusGroupMembers(teamID string, groupIDs []string, page, perPage int) ([]*model.UserWithGroups, int64, *model.AppError) {
	users, err := a.Srv().Store().Group().TeamMembersMinusGroupMembers(teamID, groupIDs, page, perPage)
	if err != nil {
		return nil, 0, model.NewAppError("TeamMembersMinusGroupMembers", "app.select_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	for _, u := range users {
		a.SanitizeProfile(&u.User, false)
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
	groups, appErr := a.GetGroupsByIDs(allUsersGroupIDSlice)
	if appErr != nil {
		return nil, 0, appErr
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

	totalCount, err := a.Srv().Store().Group().CountTeamMembersMinusGroupMembers(teamID, groupIDs)
	if err != nil {
		return nil, 0, model.NewAppError("TeamMembersMinusGroupMembers", "app.select_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return users, totalCount, nil
}

func (a *App) GetGroupsByIDs(groupIDs []string) ([]*model.Group, *model.AppError) {
	groups, err := a.Srv().Store().Group().GetByIDs(groupIDs)
	if err != nil {
		return nil, model.NewAppError("GetGroupsByIDs", "app.select_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return groups, nil
}

// ChannelMembersMinusGroupMembers returns the set of users in the given channel minus the set of users in the given
// groups.
//
// The result can be used, for example, to determine the set of users who would be removed from a channel if the
// channel were group-constrained with the given groups.
func (a *App) ChannelMembersMinusGroupMembers(channelID string, groupIDs []string, page, perPage int) ([]*model.UserWithGroups, int64, *model.AppError) {
	users, err := a.Srv().Store().Group().ChannelMembersMinusGroupMembers(channelID, groupIDs, page, perPage)
	if err != nil {
		return nil, 0, model.NewAppError("ChannelMembersMinusGroupMembers", "app.select_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	for _, u := range users {
		a.SanitizeProfile(&u.User, false)
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
	groups, appErr := a.GetGroupsByIDs(allUsersGroupIDSlice)
	if appErr != nil {
		return nil, 0, appErr
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

	totalCount, err := a.Srv().Store().Group().CountChannelMembersMinusGroupMembers(channelID, groupIDs)
	if err != nil {
		return nil, 0, model.NewAppError("ChannelMembersMinusGroupMembers", "app.select_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return users, totalCount, nil
}

// UserIsInAdminRoleGroup returns true at least one of the user's groups are configured to set the members as
// admins in the given syncable.
func (a *App) UserIsInAdminRoleGroup(userID, syncableID string, syncableType model.GroupSyncableType) (bool, *model.AppError) {
	groupIDs, err := a.Srv().Store().Group().AdminRoleGroupsForSyncableMember(userID, syncableID, syncableType)
	if err != nil {
		return false, model.NewAppError("UserIsInAdminRoleGroup", "app.select_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if len(groupIDs) == 0 {
		return false, nil
	}

	return true, nil
}

func (a *App) UpsertGroupMembers(groupID string, userIDs []string) ([]*model.GroupMember, *model.AppError) {
	members, err := a.Srv().Store().Group().UpsertMembers(groupID, userIDs)
	if err != nil {
		var invErr *store.ErrInvalidInput
		var appErr *model.AppError
		switch {
		case errors.As(err, &appErr):
			return nil, appErr
		case errors.As(err, &invErr):
			return nil, model.NewAppError("UpsertGroupMembers", "app.group.uniqueness_error", nil, "", http.StatusBadRequest).Wrap(err)
		default:
			return nil, model.NewAppError("UpsertGroupMembers", "app.update_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	for _, groupMember := range members {
		if appErr := a.publishGroupMemberEvent(model.WebsocketEventGroupMemberAdd, groupMember); appErr != nil {
			return nil, appErr
		}
	}

	return members, nil
}

func (a *App) DeleteGroupMembers(groupID string, userIDs []string) ([]*model.GroupMember, *model.AppError) {
	members, err := a.Srv().Store().Group().DeleteMembers(groupID, userIDs)
	if err != nil {
		var invErr *store.ErrInvalidInput
		var appErr *model.AppError
		switch {
		case errors.As(err, &appErr):
			return nil, appErr
		case errors.As(err, &invErr):
			return nil, model.NewAppError("DeleteGroupMember", "app.group.uniqueness_error", nil, "", http.StatusBadRequest).Wrap(err)
		default:
			return nil, model.NewAppError("DeleteGroupMember", "app.update_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	for _, groupMember := range members {
		if appErr := a.publishGroupMemberEvent(model.WebsocketEventGroupMemberDelete, groupMember); appErr != nil {
			return nil, appErr
		}
	}

	return members, nil
}

func (a *App) publishGroupMemberEvent(eventName string, groupMember *model.GroupMember) *model.AppError {
	messageWs := model.NewWebSocketEvent(eventName, "", "", groupMember.UserId, nil, "")
	groupMemberJSON, jsonErr := json.Marshal(groupMember)
	if jsonErr != nil {
		return model.NewAppError("publishGroupMemberEvent", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
	}
	messageWs.Add("group_member", string(groupMemberJSON))
	a.Publish(messageWs)
	return nil
}
