// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/model"
)

func (a *App) GetGroup(id string) (*model.Group, *model.AppError) {
	result := <-a.Srv.Store.Group().Get(id)
	if result.Err != nil {
		return nil, result.Err
	}
	return result.Data.(*model.Group), nil
}

func (a *App) GetGroupByRemoteID(remoteID string, groupSource model.GroupSource) (*model.Group, *model.AppError) {
	result := <-a.Srv.Store.Group().GetByRemoteID(remoteID, groupSource)
	if result.Err != nil {
		return nil, result.Err
	}
	return result.Data.(*model.Group), nil
}

func (a *App) GetGroupsBySource(groupSource model.GroupSource) ([]*model.Group, *model.AppError) {
	result := <-a.Srv.Store.Group().GetAllBySource(groupSource)
	if result.Err != nil {
		return nil, result.Err
	}
	return result.Data.([]*model.Group), nil
}

func (a *App) CreateGroup(group *model.Group) (*model.Group, *model.AppError) {
	result := <-a.Srv.Store.Group().Create(group)
	if result.Err != nil {
		return nil, result.Err
	}
	return result.Data.(*model.Group), nil
}

func (a *App) UpdateGroup(group *model.Group) (*model.Group, *model.AppError) {
	result := <-a.Srv.Store.Group().Update(group)
	if result.Err != nil {
		return nil, result.Err
	}
	return result.Data.(*model.Group), nil
}

func (a *App) DeleteGroup(groupID string) (*model.Group, *model.AppError) {
	result := <-a.Srv.Store.Group().Delete(groupID)
	if result.Err != nil {
		return nil, result.Err
	}
	return result.Data.(*model.Group), nil
}

func (a *App) GetGroupMemberUsers(groupID string) ([]*model.User, *model.AppError) {
	result := <-a.Srv.Store.Group().GetMemberUsers(groupID)
	if result.Err != nil {
		return nil, result.Err
	}
	return result.Data.([]*model.User), nil
}

func (a *App) GetGroupMemberUsersPage(groupID string, page int, perPage int) ([]*model.User, int, *model.AppError) {
	result := <-a.Srv.Store.Group().GetMemberUsersPage(groupID, page, perPage)
	if result.Err != nil {
		return nil, 0, result.Err
	}
	members := result.Data.([]*model.User)
	result = <-a.Srv.Store.Group().GetMemberCount(groupID)
	if result.Err != nil {
		return nil, 0, result.Err
	}
	count := int(result.Data.(int64))
	return members, count, nil
}

func (a *App) CreateOrRestoreGroupMember(groupID string, userID string) (*model.GroupMember, *model.AppError) {
	result := <-a.Srv.Store.Group().CreateOrRestoreMember(groupID, userID)
	if result.Err != nil {
		return nil, result.Err
	}
	return result.Data.(*model.GroupMember), nil
}

func (a *App) DeleteGroupMember(groupID string, userID string) (*model.GroupMember, *model.AppError) {
	result := <-a.Srv.Store.Group().DeleteMember(groupID, userID)
	if result.Err != nil {
		return nil, result.Err
	}
	return result.Data.(*model.GroupMember), nil
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
