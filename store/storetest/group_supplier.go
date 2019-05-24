// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"strings"
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/stretchr/testify/require"
)

func TestGroupStore(t *testing.T, ss store.Store) {
	t.Run("Create", func(t *testing.T) { testGroupStoreCreate(t, ss) })
	t.Run("Get", func(t *testing.T) { testGroupStoreGet(t, ss) })
	t.Run("GetByRemoteID", func(t *testing.T) { testGroupStoreGetByRemoteID(t, ss) })
	t.Run("GetAllBySource", func(t *testing.T) { testGroupStoreGetAllByType(t, ss) })
	t.Run("Update", func(t *testing.T) { testGroupStoreUpdate(t, ss) })
	t.Run("Delete", func(t *testing.T) { testGroupStoreDelete(t, ss) })

	t.Run("GetMemberUsers", func(t *testing.T) { testGroupGetMemberUsers(t, ss) })
	t.Run("GetMemberUsersPage", func(t *testing.T) { testGroupGetMemberUsersPage(t, ss) })
	t.Run("CreateOrRestoreMember", func(t *testing.T) { testGroupCreateOrRestoreMember(t, ss) })
	t.Run("DeleteMember", func(t *testing.T) { testGroupDeleteMember(t, ss) })

	t.Run("CreateGroupSyncable", func(t *testing.T) { testCreateGroupSyncable(t, ss) })
	t.Run("GetGroupSyncable", func(t *testing.T) { testGetGroupSyncable(t, ss) })
	t.Run("GetAllGroupSyncablesByGroupId", func(t *testing.T) { testGetAllGroupSyncablesByGroup(t, ss) })
	t.Run("UpdateGroupSyncable", func(t *testing.T) { testUpdateGroupSyncable(t, ss) })
	t.Run("DeleteGroupSyncable", func(t *testing.T) { testDeleteGroupSyncable(t, ss) })

	t.Run("TeamMembersToAdd", func(t *testing.T) { testPendingAutoAddTeamMembers(t, ss) })
	t.Run("ChannelMembersToAdd", func(t *testing.T) { testPendingAutoAddChannelMembers(t, ss) })

	t.Run("TeamMembersToRemove", func(t *testing.T) { testTeamMemberRemovals(t, ss) })
	t.Run("ChannelMembersToRemove", func(t *testing.T) { testChannelMemberRemovals(t, ss) })

	t.Run("GetGroupsByChannel", func(t *testing.T) { testGetGroupsByChannel(t, ss) })
	t.Run("GetGroupsByTeam", func(t *testing.T) { testGetGroupsByTeam(t, ss) })

	t.Run("GetGroups", func(t *testing.T) { testGetGroups(t, ss) })
}

func testGroupStoreCreate(t *testing.T, ss store.Store) {
	// Save a new group
	g1 := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		Description: model.NewId(),
		RemoteId:    model.NewId(),
	}

	// Happy path
	res1 := <-ss.Group().Create(g1)
	require.Nil(t, res1.Err)
	d1 := res1.Data.(*model.Group)
	require.Len(t, d1.Id, 26)
	require.Equal(t, g1.Name, d1.Name)
	require.Equal(t, g1.DisplayName, d1.DisplayName)
	require.Equal(t, g1.Description, d1.Description)
	require.Equal(t, g1.RemoteId, d1.RemoteId)
	require.NotZero(t, d1.CreateAt)
	require.NotZero(t, d1.UpdateAt)
	require.Zero(t, d1.DeleteAt)

	// Requires name and display name
	g2 := &model.Group{
		Name:        "",
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewId(),
	}
	res2 := <-ss.Group().Create(g2)
	require.Nil(t, res2.Data)
	require.NotNil(t, res2.Err)
	require.Equal(t, res2.Err.Id, "model.group.name.app_error")

	g2.Name = model.NewId()
	g2.DisplayName = ""
	res3 := <-ss.Group().Create(g2)
	require.Nil(t, res3.Data)
	require.NotNil(t, res3.Err)
	require.Equal(t, res3.Err.Id, "model.group.display_name.app_error")

	// Won't accept a duplicate name
	g4 := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewId(),
	}
	res5 := <-ss.Group().Create(g4)
	require.Nil(t, res5.Err)
	g4b := &model.Group{
		Name:        g4.Name,
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewId(),
	}
	res5b := <-ss.Group().Create(g4b)
	require.Nil(t, res5b.Data)
	require.Equal(t, res5b.Err.Id, "store.sql_group.unique_constraint")

	// Fields cannot be greater than max values
	g5 := &model.Group{
		Name:        strings.Repeat("x", model.GroupNameMaxLength),
		DisplayName: strings.Repeat("x", model.GroupDisplayNameMaxLength),
		Description: strings.Repeat("x", model.GroupDescriptionMaxLength),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewId(),
	}
	require.Nil(t, g5.IsValidForCreate())

	g5.Name = g5.Name + "x"
	require.Equal(t, g5.IsValidForCreate().Id, "model.group.name.app_error")
	g5.Name = model.NewId()
	require.Nil(t, g5.IsValidForCreate())

	g5.DisplayName = g5.DisplayName + "x"
	require.Equal(t, g5.IsValidForCreate().Id, "model.group.display_name.app_error")
	g5.DisplayName = model.NewId()
	require.Nil(t, g5.IsValidForCreate())

	g5.Description = g5.Description + "x"
	require.Equal(t, g5.IsValidForCreate().Id, "model.group.description.app_error")
	g5.Description = model.NewId()
	require.Nil(t, g5.IsValidForCreate())

	// Must use a valid type
	g6 := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Source:      model.GroupSource("fake"),
		RemoteId:    model.NewId(),
	}
	require.Equal(t, g6.IsValidForCreate().Id, "model.group.source.app_error")
}

func testGroupStoreGet(t *testing.T, ss store.Store) {
	// Create a group
	g1 := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewId(),
	}
	res1 := <-ss.Group().Create(g1)
	require.Nil(t, res1.Err)
	d1 := res1.Data.(*model.Group)
	require.Len(t, d1.Id, 26)

	// Get the group
	res2 := <-ss.Group().Get(d1.Id)
	require.Nil(t, res2.Err)
	d2 := res2.Data.(*model.Group)
	require.Equal(t, d1.Id, d2.Id)
	require.Equal(t, d1.Name, d2.Name)
	require.Equal(t, d1.DisplayName, d2.DisplayName)
	require.Equal(t, d1.Description, d2.Description)
	require.Equal(t, d1.RemoteId, d2.RemoteId)
	require.Equal(t, d1.CreateAt, d2.CreateAt)
	require.Equal(t, d1.UpdateAt, d2.UpdateAt)
	require.Equal(t, d1.DeleteAt, d2.DeleteAt)

	// Get an invalid group
	res3 := <-ss.Group().Get(model.NewId())
	require.NotNil(t, res3.Err)
	require.Equal(t, res3.Err.Id, "store.sql_group.no_rows")
}

func testGroupStoreGetByRemoteID(t *testing.T, ss store.Store) {
	// Create a group
	g1 := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewId(),
	}
	res1 := <-ss.Group().Create(g1)
	require.Nil(t, res1.Err)
	d1 := res1.Data.(*model.Group)
	require.Len(t, d1.Id, 26)

	// Get the group
	res2 := <-ss.Group().GetByRemoteID(d1.RemoteId, model.GroupSourceLdap)
	require.Nil(t, res2.Err)
	d2 := res2.Data.(*model.Group)
	require.Equal(t, d1.Id, d2.Id)
	require.Equal(t, d1.Name, d2.Name)
	require.Equal(t, d1.DisplayName, d2.DisplayName)
	require.Equal(t, d1.Description, d2.Description)
	require.Equal(t, d1.RemoteId, d2.RemoteId)
	require.Equal(t, d1.CreateAt, d2.CreateAt)
	require.Equal(t, d1.UpdateAt, d2.UpdateAt)
	require.Equal(t, d1.DeleteAt, d2.DeleteAt)

	// Get an invalid group
	res3 := <-ss.Group().GetByRemoteID(model.NewId(), model.GroupSource("fake"))
	require.NotNil(t, res3.Err)
	require.Equal(t, res3.Err.Id, "store.sql_group.no_rows")
}

func testGroupStoreGetAllByType(t *testing.T, ss store.Store) {
	numGroups := 10

	groups := []*model.Group{}

	// Create groups
	for i := 0; i < numGroups; i++ {
		g := &model.Group{
			Name:        model.NewId(),
			DisplayName: model.NewId(),
			Description: model.NewId(),
			Source:      model.GroupSourceLdap,
			RemoteId:    model.NewId(),
		}
		groups = append(groups, g)
		res := <-ss.Group().Create(g)
		require.Nil(t, res.Err)
	}

	// Returns all the groups
	res1 := <-ss.Group().GetAllBySource(model.GroupSourceLdap)
	d1 := res1.Data.([]*model.Group)
	require.Condition(t, func() bool { return len(d1) >= numGroups })
	for _, expectedGroup := range groups {
		present := false
		for _, dbGroup := range d1 {
			if dbGroup.Id == expectedGroup.Id {
				present = true
				break
			}
		}
		require.True(t, present)
	}
}

func testGroupStoreUpdate(t *testing.T, ss store.Store) {
	// Save a new group
	g1 := &model.Group{
		Name:        "g1-test",
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		Description: model.NewId(),
		RemoteId:    model.NewId(),
	}

	// Create a group
	res := <-ss.Group().Create(g1)
	require.Nil(t, res.Err)
	d1 := res.Data.(*model.Group)

	// Update happy path
	g1Update := &model.Group{}
	*g1Update = *g1
	g1Update.Name = model.NewId()
	g1Update.DisplayName = model.NewId()
	g1Update.Description = model.NewId()
	g1Update.RemoteId = model.NewId()

	res2 := <-ss.Group().Update(g1Update)
	require.Nil(t, res2.Err)
	ud1 := res2.Data.(*model.Group)
	// Not changed...
	require.Equal(t, d1.Id, ud1.Id)
	require.Equal(t, d1.CreateAt, ud1.CreateAt)
	require.Equal(t, d1.Source, ud1.Source)
	// Still zero...
	require.Zero(t, ud1.DeleteAt)
	// Updated...
	require.Equal(t, g1Update.Name, ud1.Name)
	require.Equal(t, g1Update.DisplayName, ud1.DisplayName)
	require.Equal(t, g1Update.Description, ud1.Description)
	require.Equal(t, g1Update.RemoteId, ud1.RemoteId)

	// Requires name and display name
	res3 := <-ss.Group().Update(&model.Group{
		Id:          d1.Id,
		Name:        "",
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewId(),
		Description: model.NewId(),
	})
	require.Nil(t, res3.Data)
	require.NotNil(t, res3.Err)
	require.Equal(t, res3.Err.Id, "model.group.name.app_error")

	res4 := <-ss.Group().Update(&model.Group{
		Id:          d1.Id,
		Name:        model.NewId(),
		DisplayName: "",
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewId(),
	})
	require.Nil(t, res4.Data)
	require.NotNil(t, res4.Err)
	require.Equal(t, res4.Err.Id, "model.group.display_name.app_error")

	// Create another Group
	g2 := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		Description: model.NewId(),
		RemoteId:    model.NewId(),
	}
	res5 := <-ss.Group().Create(g2)
	require.Nil(t, res5.Err)
	d2 := res5.Data.(*model.Group)

	// Can't update the name to be a duplicate of an existing group's name
	res6 := <-ss.Group().Update(&model.Group{
		Id:          d2.Id,
		Name:        g1Update.Name,
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		Description: model.NewId(),
		RemoteId:    model.NewId(),
	})
	require.Equal(t, res6.Err.Id, "store.update_error")

	// Cannot update CreateAt
	someVal := model.GetMillis()
	d1.CreateAt = someVal
	res7 := <-ss.Group().Update(d1)
	d3 := res7.Data.(*model.Group)
	require.NotEqual(t, someVal, d3.CreateAt)

	// Cannot update DeleteAt to non-zero
	d1.DeleteAt = 1
	res9 := <-ss.Group().Update(d1)
	require.Equal(t, "model.group.delete_at.app_error", res9.Err.Id)

	//...except for 0 for DeleteAt
	d1.DeleteAt = 0
	res8 := <-ss.Group().Update(d1)
	require.Nil(t, res8.Err)
	d4 := res8.Data.(*model.Group)
	require.Zero(t, d4.DeleteAt)
}

func testGroupStoreDelete(t *testing.T, ss store.Store) {
	// Save a group
	g1 := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewId(),
	}

	res1 := <-ss.Group().Create(g1)
	require.Nil(t, res1.Err)
	d1 := res1.Data.(*model.Group)
	require.Len(t, d1.Id, 26)

	// Check the group is retrievable
	res2 := <-ss.Group().Get(d1.Id)
	require.Nil(t, res2.Err)

	// Get the before count
	res7 := <-ss.Group().GetAllBySource(model.GroupSourceLdap)
	d7 := res7.Data.([]*model.Group)
	beforeCount := len(d7)

	// Delete the group
	res3 := <-ss.Group().Delete(d1.Id)
	require.Nil(t, res3.Err)

	// Check the group is deleted
	res4 := <-ss.Group().Get(d1.Id)
	d4 := res4.Data.(*model.Group)
	require.NotZero(t, d4.DeleteAt)

	// Check the after count
	res5 := <-ss.Group().GetAllBySource(model.GroupSourceLdap)
	d5 := res5.Data.([]*model.Group)
	afterCount := len(d5)
	require.Condition(t, func() bool { return beforeCount == afterCount+1 })

	// Try and delete a nonexistent group
	res6 := <-ss.Group().Delete(model.NewId())
	require.NotNil(t, res6.Err)
	require.Equal(t, res6.Err.Id, "store.sql_group.no_rows")

	// Cannot delete again
	res8 := <-ss.Group().Delete(d1.Id)
	require.Equal(t, res8.Err.Id, "store.sql_group.no_rows")
}

func testGroupGetMemberUsers(t *testing.T, ss store.Store) {
	// Save a group
	g1 := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewId(),
	}
	res := <-ss.Group().Create(g1)
	require.Nil(t, res.Err)
	group := res.Data.(*model.Group)

	u1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	res = <-ss.User().Save(u1)
	require.Nil(t, res.Err)
	user1 := res.Data.(*model.User)

	res = <-ss.Group().CreateOrRestoreMember(group.Id, user1.Id)
	require.Nil(t, res.Err)

	u2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	res = <-ss.User().Save(u2)
	require.Nil(t, res.Err)
	user2 := res.Data.(*model.User)

	res = <-ss.Group().CreateOrRestoreMember(group.Id, user2.Id)
	require.Nil(t, res.Err)

	// Check returns members
	res = <-ss.Group().GetMemberUsers(group.Id)
	require.Nil(t, res.Err)
	groupMembers := res.Data.([]*model.User)
	require.Equal(t, 2, len(groupMembers))

	// Check madeup id
	res = <-ss.Group().GetMemberUsers(model.NewId())
	require.Equal(t, 0, len(res.Data.([]*model.User)))

	// Delete a member
	<-ss.Group().DeleteMember(group.Id, user1.Id)

	// Should not return deleted members
	res = <-ss.Group().GetMemberUsers(group.Id)
	groupMembers = res.Data.([]*model.User)
	require.Equal(t, 1, len(groupMembers))
}

func testGroupGetMemberUsersPage(t *testing.T, ss store.Store) {
	// Save a group
	g1 := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewId(),
	}
	res := <-ss.Group().Create(g1)
	require.Nil(t, res.Err)
	group := res.Data.(*model.Group)

	u1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	res = <-ss.User().Save(u1)
	require.Nil(t, res.Err)
	user1 := res.Data.(*model.User)

	res = <-ss.Group().CreateOrRestoreMember(group.Id, user1.Id)
	require.Nil(t, res.Err)

	u2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	res = <-ss.User().Save(u2)
	require.Nil(t, res.Err)
	user2 := res.Data.(*model.User)

	res = <-ss.Group().CreateOrRestoreMember(group.Id, user2.Id)
	require.Nil(t, res.Err)

	// Check returns members
	res = <-ss.Group().GetMemberUsersPage(group.Id, 0, 100)
	require.Nil(t, res.Err)
	groupMembers := res.Data.([]*model.User)
	require.Equal(t, 2, len(groupMembers))

	// Check page 1
	res = <-ss.Group().GetMemberUsersPage(group.Id, 0, 1)
	require.Nil(t, res.Err)
	groupMembers = res.Data.([]*model.User)
	require.Equal(t, 1, len(groupMembers))
	require.Equal(t, user2.Id, groupMembers[0].Id)

	// Check page 2
	res = <-ss.Group().GetMemberUsersPage(group.Id, 1, 1)
	require.Nil(t, res.Err)
	groupMembers = res.Data.([]*model.User)
	require.Equal(t, 1, len(groupMembers))
	require.Equal(t, user1.Id, groupMembers[0].Id)

	// Check madeup id
	res = <-ss.Group().GetMemberUsersPage(model.NewId(), 0, 100)
	require.Equal(t, 0, len(res.Data.([]*model.User)))

	// Delete a member
	<-ss.Group().DeleteMember(group.Id, user1.Id)

	// Should not return deleted members
	res = <-ss.Group().GetMemberUsersPage(group.Id, 0, 100)
	groupMembers = res.Data.([]*model.User)
	require.Equal(t, 1, len(groupMembers))
}

func testGroupCreateOrRestoreMember(t *testing.T, ss store.Store) {
	// Create group
	g1 := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewId(),
	}
	res1 := <-ss.Group().Create(g1)
	require.Nil(t, res1.Err)
	group := res1.Data.(*model.Group)

	// Create user
	u1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	res2 := <-ss.User().Save(u1)
	require.Nil(t, res2.Err)
	user := res2.Data.(*model.User)

	// Happy path
	res3 := <-ss.Group().CreateOrRestoreMember(group.Id, user.Id)
	require.Nil(t, res3.Err)
	d2 := res3.Data.(*model.GroupMember)
	require.Equal(t, d2.GroupId, group.Id)
	require.Equal(t, d2.UserId, user.Id)
	require.NotZero(t, d2.CreateAt)
	require.Zero(t, d2.DeleteAt)

	// Duplicate composite key (GroupId, UserId)
	res4 := <-ss.Group().CreateOrRestoreMember(group.Id, user.Id)
	require.Equal(t, res4.Err.Id, "store.sql_group.uniqueness_error")

	// Invalid GroupId
	res6 := <-ss.Group().CreateOrRestoreMember(model.NewId(), user.Id)
	require.Equal(t, res6.Err.Id, "store.insert_error")

	// Restores a deleted member
	res := <-ss.Group().CreateOrRestoreMember(group.Id, user.Id)
	require.NotNil(t, res.Err)

	res = <-ss.Group().DeleteMember(group.Id, user.Id)
	require.Nil(t, res.Err)

	res = <-ss.Group().GetMemberUsers(group.Id)
	beforeRestoreCount := len(res.Data.([]*model.User))

	res = <-ss.Group().CreateOrRestoreMember(group.Id, user.Id)
	require.Nil(t, res.Err)

	res = <-ss.Group().GetMemberUsers(group.Id)
	afterRestoreCount := len(res.Data.([]*model.User))

	require.Equal(t, beforeRestoreCount+1, afterRestoreCount)
}

func testGroupDeleteMember(t *testing.T, ss store.Store) {
	// Create group
	g1 := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewId(),
	}
	res1 := <-ss.Group().Create(g1)
	require.Nil(t, res1.Err)
	group := res1.Data.(*model.Group)

	// Create user
	u1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	res2 := <-ss.User().Save(u1)
	require.Nil(t, res2.Err)
	user := res2.Data.(*model.User)

	// Create member
	res3 := <-ss.Group().CreateOrRestoreMember(group.Id, user.Id)
	require.Nil(t, res3.Err)
	d1 := res3.Data.(*model.GroupMember)

	// Happy path
	res4 := <-ss.Group().DeleteMember(group.Id, user.Id)
	require.Nil(t, res4.Err)
	d2 := res4.Data.(*model.GroupMember)
	require.Equal(t, d2.GroupId, group.Id)
	require.Equal(t, d2.UserId, user.Id)
	require.Equal(t, d2.CreateAt, d1.CreateAt)
	require.NotZero(t, d2.DeleteAt)

	// Delete an already deleted member
	res5 := <-ss.Group().DeleteMember(group.Id, user.Id)
	require.Equal(t, res5.Err.Id, "store.sql_group.no_rows")

	// Delete with non-existent User
	res8 := <-ss.Group().DeleteMember(group.Id, model.NewId())
	require.Equal(t, res8.Err.Id, "store.sql_group.no_rows")

	// Delete non-existent Group
	res9 := <-ss.Group().DeleteMember(model.NewId(), group.Id)
	require.Equal(t, res9.Err.Id, "store.sql_group.no_rows")
}

func testCreateGroupSyncable(t *testing.T, ss store.Store) {
	// Invalid GroupID
	res2 := <-ss.Group().CreateGroupSyncable(model.NewGroupTeam("x", model.NewId(), false))
	require.Equal(t, res2.Err.Id, "model.group_syncable.group_id.app_error")

	// Create Group
	g1 := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewId(),
	}
	res4 := <-ss.Group().Create(g1)
	require.Nil(t, res4.Err)
	group := res4.Data.(*model.Group)

	// Create Team
	t1 := &model.Team{
		DisplayName:     "Name",
		Description:     "Some description",
		CompanyName:     "Some company name",
		AllowOpenInvite: false,
		InviteId:        "inviteid0",
		Name:            "z-z-" + model.NewId() + "a",
		Email:           "success+" + model.NewId() + "@simulator.amazonses.com",
		Type:            model.TEAM_OPEN,
	}
	team, err := ss.Team().Save(t1)
	require.Nil(t, err)

	// New GroupSyncable, happy path
	gt1 := model.NewGroupTeam(group.Id, team.Id, false)
	res6 := <-ss.Group().CreateGroupSyncable(gt1)
	require.Nil(t, res6.Err)
	d1 := res6.Data.(*model.GroupSyncable)
	require.Equal(t, gt1.SyncableId, d1.SyncableId)
	require.Equal(t, gt1.GroupId, d1.GroupId)
	require.Equal(t, gt1.AutoAdd, d1.AutoAdd)
	require.NotZero(t, d1.CreateAt)
	require.Zero(t, d1.DeleteAt)
}

func testGetGroupSyncable(t *testing.T, ss store.Store) {
	// Create a group
	g1 := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewId(),
	}
	res1 := <-ss.Group().Create(g1)
	require.Nil(t, res1.Err)
	group := res1.Data.(*model.Group)

	// Create Team
	t1 := &model.Team{
		DisplayName:     "Name",
		Description:     "Some description",
		CompanyName:     "Some company name",
		AllowOpenInvite: false,
		InviteId:        "inviteid0",
		Name:            "z-z-" + model.NewId() + "a",
		Email:           "success+" + model.NewId() + "@simulator.amazonses.com",
		Type:            model.TEAM_OPEN,
	}
	team, err := ss.Team().Save(t1)
	require.Nil(t, err)

	// Create GroupSyncable
	gt1 := model.NewGroupTeam(group.Id, team.Id, false)
	res3 := <-ss.Group().CreateGroupSyncable(gt1)
	require.Nil(t, res3.Err)
	groupTeam := res3.Data.(*model.GroupSyncable)

	// Get GroupSyncable
	res4 := <-ss.Group().GetGroupSyncable(groupTeam.GroupId, groupTeam.SyncableId, model.GroupSyncableTypeTeam)
	require.Nil(t, res4.Err)
	dgt := res4.Data.(*model.GroupSyncable)
	require.Equal(t, gt1.GroupId, dgt.GroupId)
	require.Equal(t, gt1.SyncableId, dgt.SyncableId)
	require.Equal(t, gt1.AutoAdd, dgt.AutoAdd)
	require.NotZero(t, gt1.CreateAt)
	require.NotZero(t, gt1.UpdateAt)
	require.Zero(t, gt1.DeleteAt)
}

func testGetAllGroupSyncablesByGroup(t *testing.T, ss store.Store) {
	numGroupSyncables := 10

	// Create group
	g := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewId(),
	}
	res1 := <-ss.Group().Create(g)
	require.Nil(t, res1.Err)
	group := res1.Data.(*model.Group)

	groupTeams := []*model.GroupSyncable{}

	// Create groupTeams
	for i := 0; i < numGroupSyncables; i++ {
		// Create Team
		t1 := &model.Team{
			DisplayName:     "Name",
			Description:     "Some description",
			CompanyName:     "Some company name",
			AllowOpenInvite: false,
			InviteId:        "inviteid0",
			Name:            "z-z-" + model.NewId() + "a",
			Email:           "success+" + model.NewId() + "@simulator.amazonses.com",
			Type:            model.TEAM_OPEN,
		}
		team, err := ss.Team().Save(t1)
		require.Nil(t, err)

		// create groupteam
		res3 := <-ss.Group().CreateGroupSyncable(model.NewGroupTeam(group.Id, team.Id, false))
		require.Nil(t, res3.Err)
		groupTeam := res3.Data.(*model.GroupSyncable)
		groupTeams = append(groupTeams, groupTeam)
	}

	// Returns all the group teams
	res4 := <-ss.Group().GetAllGroupSyncablesByGroupId(group.Id, model.GroupSyncableTypeTeam)
	d1 := res4.Data.([]*model.GroupSyncable)
	require.Condition(t, func() bool { return len(d1) >= numGroupSyncables })
	for _, expectedGroupTeam := range groupTeams {
		present := false
		for _, dbGroupTeam := range d1 {
			if dbGroupTeam.GroupId == expectedGroupTeam.GroupId && dbGroupTeam.SyncableId == expectedGroupTeam.SyncableId {
				present = true
				break
			}
		}
		require.True(t, present)
	}
}

func testUpdateGroupSyncable(t *testing.T, ss store.Store) {
	// Create Group
	g1 := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewId(),
	}
	res4 := <-ss.Group().Create(g1)
	require.Nil(t, res4.Err)
	group := res4.Data.(*model.Group)

	// Create Team
	t1 := &model.Team{
		DisplayName:     "Name",
		Description:     "Some description",
		CompanyName:     "Some company name",
		AllowOpenInvite: false,
		InviteId:        "inviteid0",
		Name:            "z-z-" + model.NewId() + "a",
		Email:           "success+" + model.NewId() + "@simulator.amazonses.com",
		Type:            model.TEAM_OPEN,
	}
	team, err := ss.Team().Save(t1)
	require.Nil(t, err)

	// New GroupSyncable, happy path
	gt1 := model.NewGroupTeam(group.Id, team.Id, false)
	res6 := <-ss.Group().CreateGroupSyncable(gt1)
	require.Nil(t, res6.Err)
	d1 := res6.Data.(*model.GroupSyncable)

	// Update existing group team
	gt1.AutoAdd = true
	res7 := <-ss.Group().UpdateGroupSyncable(gt1)
	require.Nil(t, res7.Err)
	d2 := res7.Data.(*model.GroupSyncable)
	require.True(t, d2.AutoAdd)

	// Non-existent Group
	gt2 := model.NewGroupTeam(model.NewId(), team.Id, false)
	res9 := <-ss.Group().UpdateGroupSyncable(gt2)
	require.Equal(t, res9.Err.Id, "store.sql_group.no_rows")

	// Non-existent Team
	gt3 := model.NewGroupTeam(group.Id, model.NewId(), false)
	res10 := <-ss.Group().UpdateGroupSyncable(gt3)
	require.Equal(t, res10.Err.Id, "store.sql_group.no_rows")

	// Cannot update CreateAt or DeleteAt
	origCreateAt := d1.CreateAt
	d1.CreateAt = model.GetMillis()
	d1.AutoAdd = true
	res11 := <-ss.Group().UpdateGroupSyncable(d1)
	require.Nil(t, res11.Err)
	d3 := res11.Data.(*model.GroupSyncable)
	require.Equal(t, origCreateAt, d3.CreateAt)

	// Cannot update DeleteAt to arbitrary value
	d1.DeleteAt = 1
	res12 := <-ss.Group().UpdateGroupSyncable(d1)
	require.Equal(t, "model.group.delete_at.app_error", res12.Err.Id)

	// Can update DeleteAt to 0
	d1.DeleteAt = 0
	res13 := <-ss.Group().UpdateGroupSyncable(d1)
	require.Nil(t, res13.Err)
	d4 := res13.Data.(*model.GroupSyncable)
	require.Zero(t, d4.DeleteAt)
}

func testDeleteGroupSyncable(t *testing.T, ss store.Store) {
	// Create Group
	g1 := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewId(),
	}
	res1 := <-ss.Group().Create(g1)
	require.Nil(t, res1.Err)
	group := res1.Data.(*model.Group)

	// Create Team
	t1 := &model.Team{
		DisplayName:     "Name",
		Description:     "Some description",
		CompanyName:     "Some company name",
		AllowOpenInvite: false,
		InviteId:        "inviteid0",
		Name:            "z-z-" + model.NewId() + "a",
		Email:           "success+" + model.NewId() + "@simulator.amazonses.com",
		Type:            model.TEAM_OPEN,
	}
	team, err := ss.Team().Save(t1)
	require.Nil(t, err)

	// Create GroupSyncable
	gt1 := model.NewGroupTeam(group.Id, team.Id, false)
	res7 := <-ss.Group().CreateGroupSyncable(gt1)
	require.Nil(t, res7.Err)
	groupTeam := res7.Data.(*model.GroupSyncable)

	// Non-existent Group
	res5 := <-ss.Group().DeleteGroupSyncable(model.NewId(), groupTeam.SyncableId, model.GroupSyncableTypeTeam)
	require.Equal(t, res5.Err.Id, "store.sql_group.no_rows")

	// Non-existent Team
	res6 := <-ss.Group().DeleteGroupSyncable(groupTeam.GroupId, string(model.NewId()), model.GroupSyncableTypeTeam)
	require.Equal(t, res6.Err.Id, "store.sql_group.no_rows")

	// Happy path...
	res8 := <-ss.Group().DeleteGroupSyncable(groupTeam.GroupId, groupTeam.SyncableId, model.GroupSyncableTypeTeam)
	require.Nil(t, res8.Err)
	d1 := res8.Data.(*model.GroupSyncable)
	require.NotZero(t, d1.DeleteAt)
	require.Equal(t, d1.GroupId, groupTeam.GroupId)
	require.Equal(t, d1.SyncableId, groupTeam.SyncableId)
	require.Equal(t, d1.AutoAdd, groupTeam.AutoAdd)
	require.Equal(t, d1.CreateAt, groupTeam.CreateAt)
	require.Condition(t, func() bool { return d1.UpdateAt > groupTeam.UpdateAt })

	// Record already deleted
	res9 := <-ss.Group().DeleteGroupSyncable(d1.GroupId, d1.SyncableId, d1.Type)
	require.NotNil(t, res9.Err)
	require.Equal(t, res9.Err.Id, "store.sql_group.group_syncable_already_deleted")
}

func testPendingAutoAddTeamMembers(t *testing.T, ss store.Store) {
	// Create Group
	res := <-ss.Group().Create(&model.Group{
		Name:        model.NewId(),
		DisplayName: "TeamMembersToAdd Test Group",
		RemoteId:    model.NewId(),
		Source:      model.GroupSourceLdap,
	})
	require.Nil(t, res.Err)
	group := res.Data.(*model.Group)

	// Create User
	user := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	res = <-ss.User().Save(user)
	require.Nil(t, res.Err)
	user = res.Data.(*model.User)

	// Create GroupMember
	res = <-ss.Group().CreateOrRestoreMember(group.Id, user.Id)
	require.Nil(t, res.Err)

	// Create Team
	team := &model.Team{
		DisplayName:     "Name",
		Description:     "Some description",
		CompanyName:     "Some company name",
		AllowOpenInvite: false,
		InviteId:        "inviteid0",
		Name:            "z-z-" + model.NewId() + "a",
		Email:           "success+" + model.NewId() + "@simulator.amazonses.com",
		Type:            model.TEAM_OPEN,
	}
	team, err := ss.Team().Save(team)
	require.Nil(t, err)

	// Create GroupTeam
	res = <-ss.Group().CreateGroupSyncable(model.NewGroupTeam(group.Id, team.Id, true))
	require.Nil(t, res.Err)
	syncable := res.Data.(*model.GroupSyncable)

	// Time before syncable was created
	res = <-ss.Group().TeamMembersToAdd(syncable.CreateAt - 1)
	require.Nil(t, res.Err)
	teamMembers := res.Data.([]*model.UserTeamIDPair)
	require.Len(t, teamMembers, 1)
	require.Equal(t, user.Id, teamMembers[0].UserID)
	require.Equal(t, team.Id, teamMembers[0].TeamID)

	// Time after syncable was created
	res = <-ss.Group().TeamMembersToAdd(syncable.CreateAt + 1)
	require.Nil(t, res.Err)
	require.Len(t, res.Data, 0)

	// Delete and restore GroupMember should return result
	res = <-ss.Group().DeleteMember(group.Id, user.Id)
	require.Nil(t, res.Err)
	res = <-ss.Group().CreateOrRestoreMember(group.Id, user.Id)
	require.Nil(t, res.Err)
	res = <-ss.Group().TeamMembersToAdd(syncable.CreateAt + 1)
	require.Nil(t, res.Err)
	require.Len(t, res.Data, 1)

	pristineSyncable := *syncable

	res = <-ss.Group().UpdateGroupSyncable(syncable)
	require.Nil(t, res.Err)

	// Time before syncable was updated
	res = <-ss.Group().TeamMembersToAdd(syncable.UpdateAt - 1)
	require.Nil(t, res.Err)
	teamMembers = res.Data.([]*model.UserTeamIDPair)
	require.Len(t, teamMembers, 1)
	require.Equal(t, user.Id, teamMembers[0].UserID)
	require.Equal(t, team.Id, teamMembers[0].TeamID)

	// Time after syncable was updated
	res = <-ss.Group().TeamMembersToAdd(syncable.UpdateAt + 1)
	require.Nil(t, res.Err)
	require.Len(t, res.Data, 0)

	// Only includes if auto-add
	syncable.AutoAdd = false
	res = <-ss.Group().UpdateGroupSyncable(syncable)
	require.Nil(t, res.Err)
	res = <-ss.Group().TeamMembersToAdd(0)
	require.Nil(t, res.Err)
	require.Len(t, res.Data, 0)

	// reset state of syncable and verify
	res = <-ss.Group().UpdateGroupSyncable(&pristineSyncable)
	require.Nil(t, res.Err)
	res = <-ss.Group().TeamMembersToAdd(0)
	require.Nil(t, res.Err)
	require.Len(t, res.Data, 1)

	// No result if Group deleted
	res = <-ss.Group().Delete(group.Id)
	require.Nil(t, res.Err)
	res = <-ss.Group().TeamMembersToAdd(0)
	require.Nil(t, res.Err)
	require.Len(t, res.Data, 0)

	// reset state of group and verify
	group.DeleteAt = 0
	res = <-ss.Group().Update(group)
	res = <-ss.Group().TeamMembersToAdd(0)
	require.Nil(t, res.Err)
	require.Len(t, res.Data, 1)

	// No result if Team deleted
	team.DeleteAt = model.GetMillis()
	team, err = ss.Team().Update(team)
	require.Nil(t, err)
	res = <-ss.Group().TeamMembersToAdd(0)
	require.Nil(t, res.Err)
	require.Len(t, res.Data, 0)

	// reset state of team and verify
	team.DeleteAt = 0
	team, err = ss.Team().Update(team)
	require.Nil(t, err)
	res = <-ss.Group().TeamMembersToAdd(0)
	require.Nil(t, res.Err)
	require.Len(t, res.Data, 1)

	// No result if GroupTeam deleted
	res = <-ss.Group().DeleteGroupSyncable(group.Id, team.Id, model.GroupSyncableTypeTeam)
	require.Nil(t, res.Err)
	res = <-ss.Group().TeamMembersToAdd(0)
	require.Nil(t, res.Err)
	require.Len(t, res.Data, 0)

	// reset GroupTeam and verify
	res = <-ss.Group().UpdateGroupSyncable(&pristineSyncable)
	require.Nil(t, res.Err)
	res = <-ss.Group().TeamMembersToAdd(0)
	require.Nil(t, res.Err)
	require.Len(t, res.Data, 1)

	// No result if GroupMember deleted
	res = <-ss.Group().DeleteMember(group.Id, user.Id)
	require.Nil(t, res.Err)
	res = <-ss.Group().TeamMembersToAdd(0)
	require.Nil(t, res.Err)
	require.Len(t, res.Data, 0)

	// restore group member and verify
	res = <-ss.Group().CreateOrRestoreMember(group.Id, user.Id)
	res = <-ss.Group().TeamMembersToAdd(0)
	require.Nil(t, res.Err)
	require.Len(t, res.Data, 1)

	// adding team membership stops returning result
	res = <-ss.Team().SaveMember(&model.TeamMember{
		TeamId: team.Id,
		UserId: user.Id,
	}, 999)
	require.Nil(t, res.Err)
	res = <-ss.Group().TeamMembersToAdd(0)
	require.Nil(t, res.Err)
	require.Len(t, res.Data, 0)
}

func testPendingAutoAddChannelMembers(t *testing.T, ss store.Store) {
	// Create Group
	res := <-ss.Group().Create(&model.Group{
		Name:        model.NewId(),
		DisplayName: "ChannelMembersToAdd Test Group",
		RemoteId:    model.NewId(),
		Source:      model.GroupSourceLdap,
	})
	require.Nil(t, res.Err)
	group := res.Data.(*model.Group)

	// Create User
	user := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	res = <-ss.User().Save(user)
	require.Nil(t, res.Err)
	user = res.Data.(*model.User)

	// Create GroupMember
	res = <-ss.Group().CreateOrRestoreMember(group.Id, user.Id)
	require.Nil(t, res.Err)

	// Create Channel
	channel := &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "A Name",
		Name:        model.NewId(),
		Type:        model.CHANNEL_OPEN, // Query does not look at type so this shouldn't matter.
	}
	res = <-ss.Channel().Save(channel, 9999)
	require.Nil(t, res.Err)
	channel = res.Data.(*model.Channel)

	// Create GroupChannel
	res = <-ss.Group().CreateGroupSyncable(model.NewGroupChannel(group.Id, channel.Id, true))
	require.Nil(t, res.Err)
	syncable := res.Data.(*model.GroupSyncable)

	// Time before syncable was created
	res = <-ss.Group().ChannelMembersToAdd(syncable.CreateAt - 1)
	require.Nil(t, res.Err)
	channelMembers := res.Data.([]*model.UserChannelIDPair)
	require.Len(t, channelMembers, 1)
	require.Equal(t, user.Id, channelMembers[0].UserID)
	require.Equal(t, channel.Id, channelMembers[0].ChannelID)

	// Time after syncable was created
	res = <-ss.Group().ChannelMembersToAdd(syncable.CreateAt + 1)
	require.Nil(t, res.Err)
	require.Len(t, res.Data, 0)

	// Delete and restore GroupMember should return result
	res = <-ss.Group().DeleteMember(group.Id, user.Id)
	require.Nil(t, res.Err)
	res = <-ss.Group().CreateOrRestoreMember(group.Id, user.Id)
	require.Nil(t, res.Err)
	res = <-ss.Group().ChannelMembersToAdd(syncable.CreateAt + 1)
	require.Nil(t, res.Err)
	require.Len(t, res.Data, 1)

	pristineSyncable := *syncable

	res = <-ss.Group().UpdateGroupSyncable(syncable)
	require.Nil(t, res.Err)

	// Time before syncable was updated
	res = <-ss.Group().ChannelMembersToAdd(syncable.UpdateAt - 1)
	require.Nil(t, res.Err)
	channelMembers = res.Data.([]*model.UserChannelIDPair)
	require.Len(t, channelMembers, 1)
	require.Equal(t, user.Id, channelMembers[0].UserID)
	require.Equal(t, channel.Id, channelMembers[0].ChannelID)

	// Time after syncable was updated
	res = <-ss.Group().ChannelMembersToAdd(syncable.UpdateAt + 1)
	require.Nil(t, res.Err)
	require.Len(t, res.Data, 0)

	// Only includes if auto-add
	syncable.AutoAdd = false
	res = <-ss.Group().UpdateGroupSyncable(syncable)
	require.Nil(t, res.Err)
	res = <-ss.Group().ChannelMembersToAdd(0)
	require.Nil(t, res.Err)
	require.Len(t, res.Data, 0)

	// reset state of syncable and verify
	res = <-ss.Group().UpdateGroupSyncable(&pristineSyncable)
	require.Nil(t, res.Err)
	res = <-ss.Group().ChannelMembersToAdd(0)
	require.Nil(t, res.Err)
	require.Len(t, res.Data, 1)

	// No result if Group deleted
	res = <-ss.Group().Delete(group.Id)
	require.Nil(t, res.Err)
	res = <-ss.Group().ChannelMembersToAdd(0)
	require.Nil(t, res.Err)
	require.Len(t, res.Data, 0)

	// reset state of group and verify
	group.DeleteAt = 0
	res = <-ss.Group().Update(group)
	res = <-ss.Group().ChannelMembersToAdd(0)
	require.Nil(t, res.Err)
	require.Len(t, res.Data, 1)

	// No result if Channel deleted
	err := ss.Channel().Delete(channel.Id, model.GetMillis())
	require.Nil(t, err)
	res = <-ss.Group().ChannelMembersToAdd(0)
	require.Nil(t, res.Err)
	require.Len(t, res.Data, 0)

	// reset state of channel and verify
	channel.DeleteAt = 0
	_, err = ss.Channel().Update(channel)
	require.Nil(t, err)
	res = <-ss.Group().ChannelMembersToAdd(0)
	require.Nil(t, res.Err)
	require.Len(t, res.Data, 1)

	// No result if GroupChannel deleted
	res = <-ss.Group().DeleteGroupSyncable(group.Id, channel.Id, model.GroupSyncableTypeChannel)
	require.Nil(t, res.Err)
	res = <-ss.Group().ChannelMembersToAdd(0)
	require.Nil(t, res.Err)
	require.Len(t, res.Data, 0)

	// reset GroupChannel and verify
	res = <-ss.Group().UpdateGroupSyncable(&pristineSyncable)
	require.Nil(t, res.Err)
	res = <-ss.Group().ChannelMembersToAdd(0)
	require.Nil(t, res.Err)
	require.Len(t, res.Data, 1)

	// No result if GroupMember deleted
	res = <-ss.Group().DeleteMember(group.Id, user.Id)
	require.Nil(t, res.Err)
	res = <-ss.Group().ChannelMembersToAdd(0)
	require.Nil(t, res.Err)
	require.Len(t, res.Data, 0)

	// restore group member and verify
	res = <-ss.Group().CreateOrRestoreMember(group.Id, user.Id)
	require.Nil(t, res.Err)
	res = <-ss.Group().ChannelMembersToAdd(0)
	require.Nil(t, res.Err)
	require.Len(t, res.Data, 1)

	// Adding Channel (ChannelMemberHistory) should stop returning result
	res = <-ss.ChannelMemberHistory().LogJoinEvent(user.Id, channel.Id, model.GetMillis())
	require.Nil(t, res.Err)
	res = <-ss.Group().ChannelMembersToAdd(0)
	require.Nil(t, res.Err)
	require.Len(t, res.Data, 0)

	// Leaving Channel (ChannelMemberHistory) should still not return result
	res = <-ss.ChannelMemberHistory().LogLeaveEvent(user.Id, channel.Id, model.GetMillis())
	require.Nil(t, res.Err)
	res = <-ss.Group().ChannelMembersToAdd(0)
	require.Nil(t, res.Err)
	require.Len(t, res.Data, 0)

	// Purging ChannelMemberHistory re-returns the result
	res = <-ss.ChannelMemberHistory().PermanentDeleteBatch(model.GetMillis()+1, 100)
	require.Nil(t, res.Err)
	res = <-ss.Group().ChannelMembersToAdd(0)
	require.Nil(t, res.Err)
	require.Len(t, res.Data, 1)
}

func testTeamMemberRemovals(t *testing.T, ss store.Store) {
	data := pendingMemberRemovalsDataSetup(t, ss)

	// one result when both users are in the group (for user C)
	res := <-ss.Group().TeamMembersToRemove()

	require.Nil(t, res.Err)
	require.Len(t, res.Data, 1)
	teamMembers := res.Data.([]*model.TeamMember)
	require.Equal(t, data.UserC.Id, teamMembers[0].UserId)

	res = <-ss.Group().DeleteMember(data.Group.Id, data.UserB.Id)
	require.Nil(t, res.Err)

	// user b and c should now be returned
	res = <-ss.Group().TeamMembersToRemove()
	require.Nil(t, res.Err)
	require.Len(t, res.Data, 2)
	teamMembers = res.Data.([]*model.TeamMember)

	var userIDs []string
	for _, item := range teamMembers {
		userIDs = append(userIDs, item.UserId)
	}
	require.Contains(t, userIDs, data.UserB.Id)
	require.Contains(t, userIDs, data.UserC.Id)
	require.Equal(t, data.ConstrainedTeam.Id, teamMembers[0].TeamId)
	require.Equal(t, data.ConstrainedTeam.Id, teamMembers[1].TeamId)

	res = <-ss.Group().DeleteMember(data.Group.Id, data.UserA.Id)
	require.Nil(t, res.Err)

	res = <-ss.Group().TeamMembersToRemove()
	require.Nil(t, res.Err)
	require.Len(t, res.Data, 3)

	// Make one of them a bot
	res = <-ss.Group().TeamMembersToRemove()
	teamMembers = res.Data.([]*model.TeamMember)
	teamMember := teamMembers[0]
	bot := &model.Bot{
		UserId:      teamMember.UserId,
		Username:    "un_" + model.NewId(),
		DisplayName: "dn_" + model.NewId(),
		OwnerId:     teamMember.UserId,
	}
	res = <-ss.Bot().Save(bot)
	require.Nil(t, res.Err)
	bot = res.Data.(*model.Bot)

	// verify that bot is not returned in results
	res = <-ss.Group().TeamMembersToRemove()
	require.Nil(t, res.Err)
	require.Len(t, res.Data, 2)

	// delete the bot
	res = <-ss.Bot().PermanentDelete(bot.UserId)
	require.Nil(t, res.Err)

	// Should be back to 3 users
	res = <-ss.Group().TeamMembersToRemove()
	require.Nil(t, res.Err)
	require.Len(t, res.Data, 3)

	// add users back to groups
	res = <-ss.Team().RemoveMember(data.ConstrainedTeam.Id, data.UserA.Id)
	require.Nil(t, res.Err)
	res = <-ss.Team().RemoveMember(data.ConstrainedTeam.Id, data.UserB.Id)
	require.Nil(t, res.Err)
	res = <-ss.Team().RemoveMember(data.ConstrainedTeam.Id, data.UserC.Id)
	require.Nil(t, res.Err)
	res = <-ss.Channel().RemoveMember(data.ConstrainedChannel.Id, data.UserA.Id)
	require.Nil(t, res.Err)
	res = <-ss.Channel().RemoveMember(data.ConstrainedChannel.Id, data.UserB.Id)
	require.Nil(t, res.Err)
	res = <-ss.Channel().RemoveMember(data.ConstrainedChannel.Id, data.UserC.Id)
	require.Nil(t, res.Err)
}

func testChannelMemberRemovals(t *testing.T, ss store.Store) {
	data := pendingMemberRemovalsDataSetup(t, ss)

	// one result when both users are in the group (for user C)
	res := <-ss.Group().ChannelMembersToRemove()

	require.Nil(t, res.Err)
	require.Len(t, res.Data, 1)
	channelMembers := res.Data.([]*model.ChannelMember)
	require.Equal(t, data.UserC.Id, channelMembers[0].UserId)

	res = <-ss.Group().DeleteMember(data.Group.Id, data.UserB.Id)
	require.Nil(t, res.Err)

	// user b and c should now be returned
	res = <-ss.Group().ChannelMembersToRemove()
	require.Nil(t, res.Err)
	require.Len(t, res.Data, 2)
	channelMembers = res.Data.([]*model.ChannelMember)

	var userIDs []string
	for _, item := range channelMembers {
		userIDs = append(userIDs, item.UserId)
	}
	require.Contains(t, userIDs, data.UserB.Id)
	require.Contains(t, userIDs, data.UserC.Id)
	require.Equal(t, data.ConstrainedChannel.Id, channelMembers[0].ChannelId)
	require.Equal(t, data.ConstrainedChannel.Id, channelMembers[1].ChannelId)

	res = <-ss.Group().DeleteMember(data.Group.Id, data.UserA.Id)
	require.Nil(t, res.Err)

	res = <-ss.Group().ChannelMembersToRemove()
	require.Nil(t, res.Err)
	require.Len(t, res.Data, 3)

	// Make one of them a bot
	res = <-ss.Group().ChannelMembersToRemove()
	channelMembers = res.Data.([]*model.ChannelMember)
	channelMember := channelMembers[0]
	bot := &model.Bot{
		UserId:      channelMember.UserId,
		Username:    "un_" + model.NewId(),
		DisplayName: "dn_" + model.NewId(),
		OwnerId:     channelMember.UserId,
	}
	res = <-ss.Bot().Save(bot)
	require.Nil(t, res.Err)
	bot = res.Data.(*model.Bot)

	// verify that bot is not returned in results
	res = <-ss.Group().ChannelMembersToRemove()
	require.Nil(t, res.Err)
	require.Len(t, res.Data, 2)

	// delete the bot
	res = <-ss.Bot().PermanentDelete(bot.UserId)
	require.Nil(t, res.Err)

	// Should be back to 3 users
	res = <-ss.Group().ChannelMembersToRemove()
	require.Nil(t, res.Err)
	require.Len(t, res.Data, 3)

	// add users back to groups
	res = <-ss.Team().RemoveMember(data.ConstrainedTeam.Id, data.UserA.Id)
	require.Nil(t, res.Err)
	res = <-ss.Team().RemoveMember(data.ConstrainedTeam.Id, data.UserB.Id)
	require.Nil(t, res.Err)
	res = <-ss.Team().RemoveMember(data.ConstrainedTeam.Id, data.UserC.Id)
	require.Nil(t, res.Err)
	res = <-ss.Channel().RemoveMember(data.ConstrainedChannel.Id, data.UserA.Id)
	require.Nil(t, res.Err)
	res = <-ss.Channel().RemoveMember(data.ConstrainedChannel.Id, data.UserB.Id)
	require.Nil(t, res.Err)
	res = <-ss.Channel().RemoveMember(data.ConstrainedChannel.Id, data.UserC.Id)
	require.Nil(t, res.Err)
}

type removalsData struct {
	UserA                *model.User
	UserB                *model.User
	UserC                *model.User
	ConstrainedChannel   *model.Channel
	UnconstrainedChannel *model.Channel
	ConstrainedTeam      *model.Team
	UnconstrainedTeam    *model.Team
	Group                *model.Group
}

func pendingMemberRemovalsDataSetup(t *testing.T, ss store.Store) *removalsData {
	// create group
	res := <-ss.Group().Create(&model.Group{
		Name:        model.NewId(),
		DisplayName: "Pending[Channel|Team]MemberRemovals Test Group",
		RemoteId:    model.NewId(),
		Source:      model.GroupSourceLdap,
	})
	require.Nil(t, res.Err)
	group := res.Data.(*model.Group)

	// create users
	// userA will get removed from the group
	userA := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	res = <-ss.User().Save(userA)
	require.Nil(t, res.Err)
	userA = res.Data.(*model.User)

	// userB will not get removed from the group
	userB := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	res = <-ss.User().Save(userB)
	require.Nil(t, res.Err)
	userB = res.Data.(*model.User)

	// userC was never in the group
	userC := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	res = <-ss.User().Save(userC)
	require.Nil(t, res.Err)
	userC = res.Data.(*model.User)

	// add users to group (but not userC)
	res = <-ss.Group().CreateOrRestoreMember(group.Id, userA.Id)
	require.Nil(t, res.Err)

	res = <-ss.Group().CreateOrRestoreMember(group.Id, userB.Id)
	require.Nil(t, res.Err)

	// create channels
	channelConstrained := &model.Channel{
		TeamId:           model.NewId(),
		DisplayName:      "A Name",
		Name:             model.NewId(),
		Type:             model.CHANNEL_PRIVATE,
		GroupConstrained: model.NewBool(true),
	}
	res = <-ss.Channel().Save(channelConstrained, 9999)
	require.Nil(t, res.Err)
	channelConstrained = res.Data.(*model.Channel)

	channelUnconstrained := &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "A Name",
		Name:        model.NewId(),
		Type:        model.CHANNEL_PRIVATE,
	}
	res = <-ss.Channel().Save(channelUnconstrained, 9999)
	require.Nil(t, res.Err)
	channelUnconstrained = res.Data.(*model.Channel)

	// create teams
	teamConstrained := &model.Team{
		DisplayName:      "Name",
		Description:      "Some description",
		CompanyName:      "Some company name",
		AllowOpenInvite:  false,
		InviteId:         "inviteid0",
		Name:             "z-z-" + model.NewId() + "a",
		Email:            "success+" + model.NewId() + "@simulator.amazonses.com",
		Type:             model.TEAM_INVITE,
		GroupConstrained: model.NewBool(true),
	}
	teamConstrained, err := ss.Team().Save(teamConstrained)
	require.Nil(t, err)

	teamUnconstrained := &model.Team{
		DisplayName:     "Name",
		Description:     "Some description",
		CompanyName:     "Some company name",
		AllowOpenInvite: false,
		InviteId:        "inviteid1",
		Name:            "z-z-" + model.NewId() + "a",
		Email:           "success+" + model.NewId() + "@simulator.amazonses.com",
		Type:            model.TEAM_INVITE,
	}
	teamUnconstrained, err = ss.Team().Save(teamUnconstrained)
	require.Nil(t, err)

	// create groupteams
	res = <-ss.Group().CreateGroupSyncable(model.NewGroupTeam(group.Id, teamConstrained.Id, true))
	require.Nil(t, res.Err)

	res = <-ss.Group().CreateGroupSyncable(model.NewGroupTeam(group.Id, teamUnconstrained.Id, true))
	require.Nil(t, res.Err)

	// create groupchannels
	res = <-ss.Group().CreateGroupSyncable(model.NewGroupChannel(group.Id, channelConstrained.Id, true))
	require.Nil(t, res.Err)

	res = <-ss.Group().CreateGroupSyncable(model.NewGroupChannel(group.Id, channelUnconstrained.Id, true))
	require.Nil(t, res.Err)

	// add users to teams
	userIDTeamIDs := [][]string{
		{userA.Id, teamConstrained.Id},
		{userB.Id, teamConstrained.Id},
		{userC.Id, teamConstrained.Id},
		{userA.Id, teamUnconstrained.Id},
		{userB.Id, teamUnconstrained.Id},
		{userC.Id, teamUnconstrained.Id},
	}

	for _, item := range userIDTeamIDs {
		res = <-ss.Team().SaveMember(&model.TeamMember{
			UserId: item[0],
			TeamId: item[1],
		}, 99)
		require.Nil(t, res.Err)
	}

	// add users to channels
	userIDChannelIDs := [][]string{
		{userA.Id, channelConstrained.Id},
		{userB.Id, channelConstrained.Id},
		{userC.Id, channelConstrained.Id},
		{userA.Id, channelUnconstrained.Id},
		{userB.Id, channelUnconstrained.Id},
		{userC.Id, channelUnconstrained.Id},
	}

	for _, item := range userIDChannelIDs {
		res = <-ss.Channel().SaveMember(&model.ChannelMember{
			UserId:      item[0],
			ChannelId:   item[1],
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		})
		require.Nil(t, res.Err)
	}

	return &removalsData{
		UserA:                userA,
		UserB:                userB,
		UserC:                userC,
		ConstrainedChannel:   channelConstrained,
		UnconstrainedChannel: channelUnconstrained,
		ConstrainedTeam:      teamConstrained,
		UnconstrainedTeam:    teamUnconstrained,
		Group:                group,
	}
}

func testGetGroupsByChannel(t *testing.T, ss store.Store) {
	// Create Channel1
	channel1 := &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "Channel1",
		Name:        model.NewId(),
		Type:        model.CHANNEL_OPEN,
	}
	res := <-ss.Channel().Save(channel1, 9999)
	require.Nil(t, res.Err)
	channel1 = res.Data.(*model.Channel)

	// Create Groups 1 and 2
	res = <-ss.Group().Create(&model.Group{
		Name:        model.NewId(),
		DisplayName: "group-1",
		RemoteId:    model.NewId(),
		Source:      model.GroupSourceLdap,
	})
	require.Nil(t, res.Err)
	group1 := res.Data.(*model.Group)

	res = <-ss.Group().Create(&model.Group{
		Name:        model.NewId(),
		DisplayName: "group-2",
		RemoteId:    model.NewId(),
		Source:      model.GroupSourceLdap,
	})
	require.Nil(t, res.Err)
	group2 := res.Data.(*model.Group)

	// And associate them with Channel1
	for _, g := range []*model.Group{group1, group2} {
		res = <-ss.Group().CreateGroupSyncable(&model.GroupSyncable{
			AutoAdd:    true,
			SyncableId: channel1.Id,
			Type:       model.GroupSyncableTypeChannel,
			GroupId:    g.Id,
		})
		require.Nil(t, res.Err)
	}

	// Create Channel2
	channel2 := &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "Channel2",
		Name:        model.NewId(),
		Type:        model.CHANNEL_OPEN,
	}
	res = <-ss.Channel().Save(channel2, 9999)
	require.Nil(t, res.Err)
	channel2 = res.Data.(*model.Channel)

	// Create Group3
	res = <-ss.Group().Create(&model.Group{
		Name:        model.NewId(),
		DisplayName: "group-3",
		RemoteId:    model.NewId(),
		Source:      model.GroupSourceLdap,
	})
	require.Nil(t, res.Err)
	group3 := res.Data.(*model.Group)

	// And associate it to Channel2
	res = <-ss.Group().CreateGroupSyncable(&model.GroupSyncable{
		AutoAdd:    true,
		SyncableId: channel2.Id,
		Type:       model.GroupSyncableTypeChannel,
		GroupId:    group3.Id,
	})
	require.Nil(t, res.Err)

	// add members
	u1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	res = <-ss.User().Save(u1)
	require.Nil(t, res.Err)
	user1 := res.Data.(*model.User)
	<-ss.Group().CreateOrRestoreMember(group1.Id, user1.Id)

	group1WithMemberCount := model.Group(*group1)
	group1WithMemberCount.MemberCount = model.NewInt(1)

	group2WithMemberCount := model.Group(*group2)
	group2WithMemberCount.MemberCount = model.NewInt(0)

	testCases := []struct {
		Name       string
		ChannelId  string
		Page       int
		PerPage    int
		Result     []*model.Group
		Opts       model.GroupSearchOpts
		TotalCount *int64
	}{
		{
			Name:       "Get the two Groups for Channel1",
			ChannelId:  channel1.Id,
			Opts:       model.GroupSearchOpts{},
			Page:       0,
			PerPage:    60,
			Result:     []*model.Group{group1, group2},
			TotalCount: model.NewInt64(2),
		},
		{
			Name:      "Get first Group for Channel1 with page 0 with 1 element",
			ChannelId: channel1.Id,
			Opts:      model.GroupSearchOpts{},
			Page:      0,
			PerPage:   1,
			Result:    []*model.Group{group1},
		},
		{
			Name:      "Get second Group for Channel1 with page 1 with 1 element",
			ChannelId: channel1.Id,
			Opts:      model.GroupSearchOpts{},
			Page:      1,
			PerPage:   1,
			Result:    []*model.Group{group2},
		},
		{
			Name:      "Get third Group for Channel2",
			ChannelId: channel2.Id,
			Opts:      model.GroupSearchOpts{},
			Page:      0,
			PerPage:   60,
			Result:    []*model.Group{group3},
		},
		{
			Name:       "Get empty Groups for a fake id",
			ChannelId:  model.NewId(),
			Opts:       model.GroupSearchOpts{},
			Page:       0,
			PerPage:    60,
			Result:     []*model.Group{},
			TotalCount: model.NewInt64(0),
		},
		{
			Name:       "Get group matching name",
			ChannelId:  channel1.Id,
			Opts:       model.GroupSearchOpts{Q: string([]rune(group1.Name)[2:10])}, // very low change of a name collision
			Page:       0,
			PerPage:    100,
			Result:     []*model.Group{group1},
			TotalCount: model.NewInt64(1),
		},
		{
			Name:       "Get group matching display name",
			ChannelId:  channel1.Id,
			Opts:       model.GroupSearchOpts{Q: "rouP-1"},
			Page:       0,
			PerPage:    100,
			Result:     []*model.Group{group1},
			TotalCount: model.NewInt64(1),
		},
		{
			Name:       "Get group matching multiple display names",
			ChannelId:  channel1.Id,
			Opts:       model.GroupSearchOpts{Q: "roUp-"},
			Page:       0,
			PerPage:    100,
			Result:     []*model.Group{group1, group2},
			TotalCount: model.NewInt64(2),
		},
		{
			Name:      "Include member counts",
			ChannelId: channel1.Id,
			Opts:      model.GroupSearchOpts{IncludeMemberCount: true},
			Page:      0,
			PerPage:   2,
			Result:    []*model.Group{&group1WithMemberCount, &group2WithMemberCount},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			if tc.Opts.PageOpts == nil {
				tc.Opts.PageOpts = &model.PageOpts{}
			}
			tc.Opts.PageOpts.Page = tc.Page
			tc.Opts.PageOpts.PerPage = tc.PerPage
			res := <-ss.Group().GetGroupsByChannel(tc.ChannelId, tc.Opts)
			require.Nil(t, res.Err)
			require.ElementsMatch(t, tc.Result, res.Data.([]*model.Group))
			if tc.TotalCount != nil {
				res = <-ss.Group().CountGroupsByChannel(tc.ChannelId, tc.Opts)
				count := res.Data.(int64)
				require.Equal(t, *tc.TotalCount, count)
			}
		})
	}
}

func testGetGroupsByTeam(t *testing.T, ss store.Store) {
	// Create Team1
	team1 := &model.Team{
		DisplayName:     "Team1",
		Description:     model.NewId(),
		CompanyName:     model.NewId(),
		AllowOpenInvite: false,
		InviteId:        model.NewId(),
		Name:            model.NewId(),
		Email:           "success+" + model.NewId() + "@simulator.amazonses.com",
		Type:            model.TEAM_OPEN,
	}
	team1, err := ss.Team().Save(team1)
	require.Nil(t, err)

	// Create Groups 1 and 2
	res := <-ss.Group().Create(&model.Group{
		Name:        model.NewId(),
		DisplayName: "group-1",
		RemoteId:    model.NewId(),
		Source:      model.GroupSourceLdap,
	})
	require.Nil(t, res.Err)
	group1 := res.Data.(*model.Group)

	res = <-ss.Group().Create(&model.Group{
		Name:        model.NewId(),
		DisplayName: "group-2",
		RemoteId:    model.NewId(),
		Source:      model.GroupSourceLdap,
	})
	require.Nil(t, res.Err)
	group2 := res.Data.(*model.Group)

	// And associate them with Team1
	for _, g := range []*model.Group{group1, group2} {
		res = <-ss.Group().CreateGroupSyncable(&model.GroupSyncable{
			AutoAdd:    true,
			SyncableId: team1.Id,
			Type:       model.GroupSyncableTypeTeam,
			GroupId:    g.Id,
		})
		require.Nil(t, res.Err)
	}

	// Create Team2
	team2 := &model.Team{
		DisplayName:     "Team2",
		Description:     model.NewId(),
		CompanyName:     model.NewId(),
		AllowOpenInvite: false,
		InviteId:        model.NewId(),
		Name:            model.NewId(),
		Email:           "success+" + model.NewId() + "@simulator.amazonses.com",
		Type:            model.TEAM_INVITE,
	}
	team2, err = ss.Team().Save(team2)
	require.Nil(t, err)

	// Create Group3
	res = <-ss.Group().Create(&model.Group{
		Name:        model.NewId(),
		DisplayName: "group-3",
		RemoteId:    model.NewId(),
		Source:      model.GroupSourceLdap,
	})
	require.Nil(t, res.Err)
	group3 := res.Data.(*model.Group)

	// And associate it to Team2
	res = <-ss.Group().CreateGroupSyncable(&model.GroupSyncable{
		AutoAdd:    true,
		SyncableId: team2.Id,
		Type:       model.GroupSyncableTypeTeam,
		GroupId:    group3.Id,
	})
	require.Nil(t, res.Err)

	// add members
	u1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	res = <-ss.User().Save(u1)
	require.Nil(t, res.Err)
	user1 := res.Data.(*model.User)
	<-ss.Group().CreateOrRestoreMember(group1.Id, user1.Id)

	group1WithMemberCount := model.Group(*group1)
	group1WithMemberCount.MemberCount = model.NewInt(1)

	group2WithMemberCount := model.Group(*group2)
	group2WithMemberCount.MemberCount = model.NewInt(0)

	testCases := []struct {
		Name       string
		TeamId     string
		Page       int
		PerPage    int
		Opts       model.GroupSearchOpts
		Result     []*model.Group
		TotalCount *int64
	}{
		{
			Name:       "Get the two Groups for Team1",
			TeamId:     team1.Id,
			Opts:       model.GroupSearchOpts{},
			Page:       0,
			PerPage:    60,
			Result:     []*model.Group{group1, group2},
			TotalCount: model.NewInt64(2),
		},
		{
			Name:    "Get first Group for Team1 with page 0 with 1 element",
			TeamId:  team1.Id,
			Opts:    model.GroupSearchOpts{},
			Page:    0,
			PerPage: 1,
			Result:  []*model.Group{group1},
		},
		{
			Name:    "Get second Group for Team1 with page 1 with 1 element",
			TeamId:  team1.Id,
			Opts:    model.GroupSearchOpts{},
			Page:    1,
			PerPage: 1,
			Result:  []*model.Group{group2},
		},
		{
			Name:       "Get third Group for Team2",
			TeamId:     team2.Id,
			Opts:       model.GroupSearchOpts{},
			Page:       0,
			PerPage:    60,
			Result:     []*model.Group{group3},
			TotalCount: model.NewInt64(1),
		},
		{
			Name:       "Get empty Groups for a fake id",
			TeamId:     model.NewId(),
			Opts:       model.GroupSearchOpts{},
			Page:       0,
			PerPage:    60,
			Result:     []*model.Group{},
			TotalCount: model.NewInt64(0),
		},
		{
			Name:       "Get group matching name",
			TeamId:     team1.Id,
			Opts:       model.GroupSearchOpts{Q: string([]rune(group1.Name)[2:10])}, // very low change of a name collision
			Page:       0,
			PerPage:    100,
			Result:     []*model.Group{group1},
			TotalCount: model.NewInt64(1),
		},
		{
			Name:       "Get group matching display name",
			TeamId:     team1.Id,
			Opts:       model.GroupSearchOpts{Q: "rouP-1"},
			Page:       0,
			PerPage:    100,
			Result:     []*model.Group{group1},
			TotalCount: model.NewInt64(1),
		},
		{
			Name:       "Get group matching multiple display names",
			TeamId:     team1.Id,
			Opts:       model.GroupSearchOpts{Q: "roUp-"},
			Page:       0,
			PerPage:    100,
			Result:     []*model.Group{group1, group2},
			TotalCount: model.NewInt64(2),
		},
		{
			Name:    "Include member counts",
			TeamId:  team1.Id,
			Opts:    model.GroupSearchOpts{IncludeMemberCount: true},
			Page:    0,
			PerPage: 2,
			Result:  []*model.Group{&group1WithMemberCount, &group2WithMemberCount},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			if tc.Opts.PageOpts == nil {
				tc.Opts.PageOpts = &model.PageOpts{}
			}
			tc.Opts.PageOpts.Page = tc.Page
			tc.Opts.PageOpts.PerPage = tc.PerPage
			res := <-ss.Group().GetGroupsByTeam(tc.TeamId, tc.Opts)
			require.Nil(t, res.Err)
			groups := res.Data.([]*model.Group)
			require.ElementsMatch(t, tc.Result, groups)
			if tc.TotalCount != nil {
				res = <-ss.Group().CountGroupsByTeam(tc.TeamId, tc.Opts)
				count := res.Data.(int64)
				require.Equal(t, *tc.TotalCount, count)
			}
		})
	}
}

func testGetGroups(t *testing.T, ss store.Store) {
	// Create Team1
	team1 := &model.Team{
		DisplayName:     "Team1",
		Description:     model.NewId(),
		CompanyName:     model.NewId(),
		AllowOpenInvite: false,
		InviteId:        model.NewId(),
		Name:            model.NewId(),
		Email:           "success+" + model.NewId() + "@simulator.amazonses.com",
		Type:            model.TEAM_OPEN,
	}
	team1, err := ss.Team().Save(team1)
	require.Nil(t, err)

	// Create Channel1
	channel1 := &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "Channel1",
		Name:        model.NewId(),
		Type:        model.CHANNEL_PRIVATE,
	}
	res := <-ss.Channel().Save(channel1, 9999)
	require.Nil(t, res.Err)
	channel1 = res.Data.(*model.Channel)

	// Create Groups 1 and 2
	res = <-ss.Group().Create(&model.Group{
		Name:        model.NewId(),
		DisplayName: "group-1",
		RemoteId:    model.NewId(),
		Source:      model.GroupSourceLdap,
	})
	require.Nil(t, res.Err)
	group1 := res.Data.(*model.Group)

	res = <-ss.Group().Create(&model.Group{
		Name:        model.NewId(),
		DisplayName: "group-2",
		RemoteId:    model.NewId(),
		Source:      model.GroupSourceLdap,
	})
	require.Nil(t, res.Err)
	group2 := res.Data.(*model.Group)

	// And associate them with Team1
	for _, g := range []*model.Group{group1, group2} {
		res = <-ss.Group().CreateGroupSyncable(&model.GroupSyncable{
			AutoAdd:    true,
			SyncableId: team1.Id,
			Type:       model.GroupSyncableTypeTeam,
			GroupId:    g.Id,
		})
		require.Nil(t, res.Err)
	}

	// Create Team2
	team2 := &model.Team{
		DisplayName:     "Team2",
		Description:     model.NewId(),
		CompanyName:     model.NewId(),
		AllowOpenInvite: false,
		InviteId:        model.NewId(),
		Name:            model.NewId(),
		Email:           "success+" + model.NewId() + "@simulator.amazonses.com",
		Type:            model.TEAM_INVITE,
	}
	team2, err = ss.Team().Save(team2)
	require.Nil(t, err)

	// Create Channel2
	channel2 := &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "Channel2",
		Name:        model.NewId(),
		Type:        model.CHANNEL_PRIVATE,
	}
	res = <-ss.Channel().Save(channel2, 9999)
	require.Nil(t, res.Err)
	channel2 = res.Data.(*model.Channel)

	// Create Group3
	res = <-ss.Group().Create(&model.Group{
		Name:        model.NewId(),
		DisplayName: "group-3",
		RemoteId:    model.NewId(),
		Source:      model.GroupSourceLdap,
	})
	require.Nil(t, res.Err)
	group3 := res.Data.(*model.Group)

	// And associate it to Team2
	res = <-ss.Group().CreateGroupSyncable(&model.GroupSyncable{
		AutoAdd:    true,
		SyncableId: team2.Id,
		Type:       model.GroupSyncableTypeTeam,
		GroupId:    group3.Id,
	})
	require.Nil(t, res.Err)

	// And associate Group1 to Channel2
	res = <-ss.Group().CreateGroupSyncable(&model.GroupSyncable{
		AutoAdd:    true,
		SyncableId: channel2.Id,
		Type:       model.GroupSyncableTypeChannel,
		GroupId:    group1.Id,
	})
	require.Nil(t, res.Err)

	// And associate Group2 and Group3 to Channel1
	for _, g := range []*model.Group{group2, group3} {
		res = <-ss.Group().CreateGroupSyncable(&model.GroupSyncable{
			AutoAdd:    true,
			SyncableId: channel1.Id,
			Type:       model.GroupSyncableTypeChannel,
			GroupId:    g.Id,
		})
		require.Nil(t, res.Err)
	}

	// add members
	u1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	res = <-ss.User().Save(u1)
	require.Nil(t, res.Err)
	user1 := res.Data.(*model.User)
	<-ss.Group().CreateOrRestoreMember(group1.Id, user1.Id)

	group1WithMemberCount := model.Group(*group1)
	group1WithMemberCount.MemberCount = model.NewInt(1)

	group2WithMemberCount := model.Group(*group2)
	group2WithMemberCount.MemberCount = model.NewInt(0)

	group2NameSubstring := string([]rune(group2.Name)[2:5])

	testCases := []struct {
		Name    string
		Page    int
		PerPage int
		Opts    model.GroupSearchOpts
		Resultf func([]*model.Group) bool
	}{
		{
			Name:    "Get all the Groups",
			Opts:    model.GroupSearchOpts{},
			Page:    0,
			PerPage: 3,
			Resultf: func(groups []*model.Group) bool { return len(groups) == 3 },
		},
		{
			Name:    "Get first Group with page 0 with 1 element",
			Opts:    model.GroupSearchOpts{},
			Page:    0,
			PerPage: 1,
			Resultf: func(groups []*model.Group) bool { return len(groups) == 1 },
		},
		{
			Name:    "Get single result from page 1",
			Opts:    model.GroupSearchOpts{},
			Page:    1,
			PerPage: 1,
			Resultf: func(groups []*model.Group) bool { return len(groups) == 1 },
		},
		{
			Name:    "Get multiple results from page 1",
			Opts:    model.GroupSearchOpts{},
			Page:    1,
			PerPage: 2,
			Resultf: func(groups []*model.Group) bool { return len(groups) == 2 },
		},
		{
			Name:    "Get group matching name",
			Opts:    model.GroupSearchOpts{Q: group2NameSubstring},
			Page:    0,
			PerPage: 100,
			Resultf: func(groups []*model.Group) bool {
				for _, g := range groups {
					if !strings.Contains(g.Name, group2NameSubstring) {
						return false
					}
				}
				return true
			},
		},
		{
			Name:    "Get group matching display name",
			Opts:    model.GroupSearchOpts{Q: "rouP-3"},
			Page:    0,
			PerPage: 100,
			Resultf: func(groups []*model.Group) bool {
				for _, g := range groups {
					if !strings.Contains(strings.ToLower(g.DisplayName), "roup-3") {
						return false
					}
				}
				return true
			},
		},
		{
			Name:    "Get group matching multiple display names",
			Opts:    model.GroupSearchOpts{Q: "groUp"},
			Page:    0,
			PerPage: 100,
			Resultf: func(groups []*model.Group) bool {
				for _, g := range groups {
					if !strings.Contains(strings.ToLower(g.DisplayName), "group") {
						return false
					}
				}
				return true
			},
		},
		{
			Name:    "Include member counts",
			Opts:    model.GroupSearchOpts{IncludeMemberCount: true},
			Page:    0,
			PerPage: 2,
			Resultf: func(groups []*model.Group) bool {
				for _, g := range groups {
					if g.MemberCount == nil {
						return false
					}
				}
				return true
			},
		},
		{
			Name:    "Not associated to team",
			Opts:    model.GroupSearchOpts{NotAssociatedToTeam: team2.Id},
			Page:    0,
			PerPage: 100,
			Resultf: func(groups []*model.Group) bool {
				if len(groups) == 0 {
					return false
				}
				for _, g := range groups {
					if g.Id == group3.Id {
						return false
					}
				}
				return true
			},
		},
		{
			Name:    "Not associated to other team",
			Opts:    model.GroupSearchOpts{NotAssociatedToTeam: team1.Id},
			Page:    0,
			PerPage: 100,
			Resultf: func(groups []*model.Group) bool {
				if len(groups) == 0 {
					return false
				}
				for _, g := range groups {
					if g.Id == group1.Id || g.Id == group2.Id {
						return false
					}
				}
				return true
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			res := <-ss.Group().GetGroups(tc.Page, tc.PerPage, tc.Opts)
			require.Nil(t, res.Err)
			groups := res.Data.([]*model.Group)
			require.True(t, tc.Resultf(groups))
		})
	}
}
