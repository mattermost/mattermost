// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"fmt"
	"math"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

func TestGroupStore(t *testing.T, ss store.Store) {
	t.Run("Create", func(t *testing.T) { testGroupStoreCreate(t, ss) })
	t.Run("Get", func(t *testing.T) { testGroupStoreGet(t, ss) })
	t.Run("GetByName", func(t *testing.T) { testGroupStoreGetByName(t, ss) })
	t.Run("GetByIDs", func(t *testing.T) { testGroupStoreGetByIDs(t, ss) })
	t.Run("GetByRemoteID", func(t *testing.T) { testGroupStoreGetByRemoteID(t, ss) })
	t.Run("GetAllBySource", func(t *testing.T) { testGroupStoreGetAllByType(t, ss) })
	t.Run("GetByUser", func(t *testing.T) { testGroupStoreGetByUser(t, ss) })
	t.Run("Update", func(t *testing.T) { testGroupStoreUpdate(t, ss) })
	t.Run("Delete", func(t *testing.T) { testGroupStoreDelete(t, ss) })

	t.Run("GetMemberUsers", func(t *testing.T) { testGroupGetMemberUsers(t, ss) })
	t.Run("GetMemberUsersPage", func(t *testing.T) { testGroupGetMemberUsersPage(t, ss) })
	t.Run("UpsertMember", func(t *testing.T) { testUpsertMember(t, ss) })
	t.Run("DeleteMember", func(t *testing.T) { testGroupDeleteMember(t, ss) })
	t.Run("PermanentDeleteMembersByUser", func(t *testing.T) { testGroupPermanentDeleteMembersByUser(t, ss) })

	t.Run("CreateGroupSyncable", func(t *testing.T) { testCreateGroupSyncable(t, ss) })
	t.Run("GetGroupSyncable", func(t *testing.T) { testGetGroupSyncable(t, ss) })
	t.Run("GetAllGroupSyncablesByGroupId", func(t *testing.T) { testGetAllGroupSyncablesByGroup(t, ss) })
	t.Run("UpdateGroupSyncable", func(t *testing.T) { testUpdateGroupSyncable(t, ss) })
	t.Run("DeleteGroupSyncable", func(t *testing.T) { testDeleteGroupSyncable(t, ss) })

	t.Run("TeamMembersToAdd", func(t *testing.T) { testTeamMembersToAdd(t, ss) })
	t.Run("TeamMembersToAdd_SingleTeam", func(t *testing.T) { testTeamMembersToAddSingleTeam(t, ss) })

	t.Run("ChannelMembersToAdd", func(t *testing.T) { testChannelMembersToAdd(t, ss) })
	t.Run("ChannelMembersToAdd_SingleChannel", func(t *testing.T) { testChannelMembersToAddSingleChannel(t, ss) })

	t.Run("TeamMembersToRemove", func(t *testing.T) { testTeamMembersToRemove(t, ss) })
	t.Run("TeamMembersToRemove_SingleTeam", func(t *testing.T) { testTeamMembersToRemoveSingleTeam(t, ss) })

	t.Run("ChannelMembersToRemove", func(t *testing.T) { testChannelMembersToRemove(t, ss) })
	t.Run("ChannelMembersToRemove_SingleChannel", func(t *testing.T) { testChannelMembersToRemoveSingleChannel(t, ss) })

	t.Run("GetGroupsByChannel", func(t *testing.T) { testGetGroupsByChannel(t, ss) })
	t.Run("GetGroupsByTeam", func(t *testing.T) { testGetGroupsByTeam(t, ss) })

	t.Run("GetGroups", func(t *testing.T) { testGetGroups(t, ss) })

	t.Run("TeamMembersMinusGroupMembers", func(t *testing.T) { testTeamMembersMinusGroupMembers(t, ss) })
	t.Run("ChannelMembersMinusGroupMembers", func(t *testing.T) { testChannelMembersMinusGroupMembers(t, ss) })

	t.Run("GetMemberCount", func(t *testing.T) { groupTestGetMemberCount(t, ss) })

	t.Run("AdminRoleGroupsForSyncableMember_Channel", func(t *testing.T) { groupTestAdminRoleGroupsForSyncableMemberChannel(t, ss) })
	t.Run("AdminRoleGroupsForSyncableMember_Team", func(t *testing.T) { groupTestAdminRoleGroupsForSyncableMemberTeam(t, ss) })
	t.Run("PermittedSyncableAdmins_Team", func(t *testing.T) { groupTestPermittedSyncableAdminsTeam(t, ss) })
	t.Run("PermittedSyncableAdmins_Channel", func(t *testing.T) { groupTestPermittedSyncableAdminsChannel(t, ss) })
	t.Run("UpdateMembersRole_Team", func(t *testing.T) { groupTestpUpdateMembersRoleTeam(t, ss) })
	t.Run("UpdateMembersRole_Channel", func(t *testing.T) { groupTestpUpdateMembersRoleChannel(t, ss) })
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
	d1, err := ss.Group().Create(g1)
	require.Nil(t, err)
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
	data, err := ss.Group().Create(g2)
	require.Nil(t, data)
	require.NotNil(t, err)
	require.Equal(t, err.Id, "model.group.name.app_error")

	g2.Name = model.NewId()
	g2.DisplayName = ""
	data, err = ss.Group().Create(g2)
	require.Nil(t, data)
	require.NotNil(t, err)
	require.Equal(t, err.Id, "model.group.display_name.app_error")

	// Won't accept a duplicate name
	g4 := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewId(),
	}
	_, err = ss.Group().Create(g4)
	require.Nil(t, err)
	g4b := &model.Group{
		Name:        g4.Name,
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewId(),
	}
	data, err = ss.Group().Create(g4b)
	require.Nil(t, data)
	require.Equal(t, err.Id, "store.sql_group.unique_constraint")

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
	d1, err := ss.Group().Create(g1)
	require.Nil(t, err)
	require.Len(t, d1.Id, 26)

	// Get the group
	d2, err := ss.Group().Get(d1.Id)
	require.Nil(t, err)
	require.Equal(t, d1.Id, d2.Id)
	require.Equal(t, d1.Name, d2.Name)
	require.Equal(t, d1.DisplayName, d2.DisplayName)
	require.Equal(t, d1.Description, d2.Description)
	require.Equal(t, d1.RemoteId, d2.RemoteId)
	require.Equal(t, d1.CreateAt, d2.CreateAt)
	require.Equal(t, d1.UpdateAt, d2.UpdateAt)
	require.Equal(t, d1.DeleteAt, d2.DeleteAt)

	// Get an invalid group
	_, err = ss.Group().Get(model.NewId())
	require.NotNil(t, err)
	require.Equal(t, err.Id, "store.sql_group.no_rows")
}

func testGroupStoreGetByName(t *testing.T, ss store.Store) {
	// Create a group
	g1 := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewId(),
	}
	d1, err := ss.Group().Create(g1)
	require.Nil(t, err)
	require.Len(t, d1.Id, 26)

	// Get the group
	d2, err := ss.Group().GetByName(d1.Name)
	require.Nil(t, err)
	require.Equal(t, d1.Id, d2.Id)
	require.Equal(t, d1.Name, d2.Name)
	require.Equal(t, d1.DisplayName, d2.DisplayName)
	require.Equal(t, d1.Description, d2.Description)
	require.Equal(t, d1.RemoteId, d2.RemoteId)
	require.Equal(t, d1.CreateAt, d2.CreateAt)
	require.Equal(t, d1.UpdateAt, d2.UpdateAt)
	require.Equal(t, d1.DeleteAt, d2.DeleteAt)

	// Get an invalid group
	_, err = ss.Group().GetByName(model.NewId())
	require.NotNil(t, err)
	require.Equal(t, err.Id, "store.sql_group.no_rows")
}

func testGroupStoreGetByIDs(t *testing.T, ss store.Store) {
	var group1 *model.Group
	var group2 *model.Group

	for i := 0; i < 2; i++ {
		group := &model.Group{
			Name:        model.NewId(),
			DisplayName: model.NewId(),
			Description: model.NewId(),
			Source:      model.GroupSourceLdap,
			RemoteId:    model.NewId(),
		}
		group, err := ss.Group().Create(group)
		require.Nil(t, err)
		switch i {
		case 0:
			group1 = group
		case 1:
			group2 = group
		}
	}

	groups, err := ss.Group().GetByIDs([]string{group1.Id, group2.Id})
	require.Nil(t, err)
	require.Len(t, groups, 2)

	for i := 0; i < 2; i++ {
		require.True(t, (groups[i].Id == group1.Id || groups[i].Id == group2.Id))
	}

	require.True(t, groups[0].Id != groups[1].Id)
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
	d1, err := ss.Group().Create(g1)
	require.Nil(t, err)
	require.Len(t, d1.Id, 26)

	// Get the group
	d2, err := ss.Group().GetByRemoteID(d1.RemoteId, model.GroupSourceLdap)
	require.Nil(t, err)
	require.Equal(t, d1.Id, d2.Id)
	require.Equal(t, d1.Name, d2.Name)
	require.Equal(t, d1.DisplayName, d2.DisplayName)
	require.Equal(t, d1.Description, d2.Description)
	require.Equal(t, d1.RemoteId, d2.RemoteId)
	require.Equal(t, d1.CreateAt, d2.CreateAt)
	require.Equal(t, d1.UpdateAt, d2.UpdateAt)
	require.Equal(t, d1.DeleteAt, d2.DeleteAt)

	// Get an invalid group
	_, err = ss.Group().GetByRemoteID(model.NewId(), model.GroupSource("fake"))
	require.NotNil(t, err)
	require.Equal(t, err.Id, "store.sql_group.no_rows")
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
		_, err := ss.Group().Create(g)
		require.Nil(t, err)
	}

	// Returns all the groups
	d1, err := ss.Group().GetAllBySource(model.GroupSourceLdap)
	require.Nil(t, err)
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

func testGroupStoreGetByUser(t *testing.T, ss store.Store) {
	// Save a group
	g1 := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewId(),
	}
	g1, err := ss.Group().Create(g1)
	require.Nil(t, err)

	g2 := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewId(),
	}
	g2, err = ss.Group().Create(g2)
	require.Nil(t, err)

	u1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	u1, err = ss.User().Save(u1)
	require.Nil(t, err)

	_, err = ss.Group().UpsertMember(g1.Id, u1.Id)
	require.Nil(t, err)
	_, err = ss.Group().UpsertMember(g2.Id, u1.Id)
	require.Nil(t, err)

	u2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	u2, err = ss.User().Save(u2)
	require.Nil(t, err)

	_, err = ss.Group().UpsertMember(g2.Id, u2.Id)
	require.Nil(t, err)

	groups, err := ss.Group().GetByUser(u1.Id)
	require.Nil(t, err)
	assert.Equal(t, 2, len(groups))
	found1 := false
	found2 := false
	for _, g := range groups {
		if g.Id == g1.Id {
			found1 = true
		}
		if g.Id == g2.Id {
			found2 = true
		}
	}
	assert.True(t, found1)
	assert.True(t, found2)

	groups, err = ss.Group().GetByUser(u2.Id)
	require.Nil(t, err)
	require.Equal(t, 1, len(groups))
	assert.Equal(t, g2.Id, groups[0].Id)

	groups, err = ss.Group().GetByUser(model.NewId())
	require.Nil(t, err)
	assert.Equal(t, 0, len(groups))
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
	d1, err := ss.Group().Create(g1)
	require.Nil(t, err)

	// Update happy path
	g1Update := &model.Group{}
	*g1Update = *g1
	g1Update.Name = model.NewId()
	g1Update.DisplayName = model.NewId()
	g1Update.Description = model.NewId()
	g1Update.RemoteId = model.NewId()

	ud1, err := ss.Group().Update(g1Update)
	require.Nil(t, err)
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
	data, err := ss.Group().Update(&model.Group{
		Id:          d1.Id,
		Name:        "",
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewId(),
		Description: model.NewId(),
	})
	require.Nil(t, data)
	require.NotNil(t, err)
	require.Equal(t, err.Id, "model.group.name.app_error")

	data, err = ss.Group().Update(&model.Group{
		Id:          d1.Id,
		Name:        model.NewId(),
		DisplayName: "",
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewId(),
	})
	require.Nil(t, data)
	require.NotNil(t, err)
	require.Equal(t, err.Id, "model.group.display_name.app_error")

	// Create another Group
	g2 := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		Description: model.NewId(),
		RemoteId:    model.NewId(),
	}
	d2, err := ss.Group().Create(g2)
	require.Nil(t, err)

	// Can't update the name to be a duplicate of an existing group's name
	_, err = ss.Group().Update(&model.Group{
		Id:          d2.Id,
		Name:        g1Update.Name,
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		Description: model.NewId(),
		RemoteId:    model.NewId(),
	})
	require.Equal(t, err.Id, "store.update_error")

	// Cannot update CreateAt
	someVal := model.GetMillis()
	d1.CreateAt = someVal
	d3, err := ss.Group().Update(d1)
	require.Nil(t, err)
	require.NotEqual(t, someVal, d3.CreateAt)

	// Cannot update DeleteAt to non-zero
	d1.DeleteAt = 1
	_, err = ss.Group().Update(d1)
	require.Equal(t, "model.group.delete_at.app_error", err.Id)

	//...except for 0 for DeleteAt
	d1.DeleteAt = 0
	d4, err := ss.Group().Update(d1)
	require.Nil(t, err)
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

	d1, err := ss.Group().Create(g1)
	require.Nil(t, err)
	require.Len(t, d1.Id, 26)

	// Check the group is retrievable
	_, err = ss.Group().Get(d1.Id)
	require.Nil(t, err)

	// Get the before count
	d7, err := ss.Group().GetAllBySource(model.GroupSourceLdap)
	require.Nil(t, err)
	beforeCount := len(d7)

	// Delete the group
	_, err = ss.Group().Delete(d1.Id)
	require.Nil(t, err)

	// Check the group is deleted
	d4, err := ss.Group().Get(d1.Id)
	require.Nil(t, err)
	require.NotZero(t, d4.DeleteAt)

	// Check the after count
	d5, err := ss.Group().GetAllBySource(model.GroupSourceLdap)
	require.Nil(t, err)
	afterCount := len(d5)
	require.Condition(t, func() bool { return beforeCount == afterCount+1 })

	// Try and delete a nonexistent group
	_, err = ss.Group().Delete(model.NewId())
	require.NotNil(t, err)
	require.Equal(t, err.Id, "store.sql_group.no_rows")

	// Cannot delete again
	_, err = ss.Group().Delete(d1.Id)
	require.Equal(t, err.Id, "store.sql_group.no_rows")
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
	group, err := ss.Group().Create(g1)
	require.Nil(t, err)

	u1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user1, err := ss.User().Save(u1)
	require.Nil(t, err)

	_, err = ss.Group().UpsertMember(group.Id, user1.Id)
	require.Nil(t, err)

	u2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user2, err := ss.User().Save(u2)
	require.Nil(t, err)

	_, err = ss.Group().UpsertMember(group.Id, user2.Id)
	require.Nil(t, err)

	// Check returns members
	groupMembers, err := ss.Group().GetMemberUsers(group.Id)
	require.Nil(t, err)
	require.Equal(t, 2, len(groupMembers))

	// Check madeup id
	groupMembers, err = ss.Group().GetMemberUsers(model.NewId())
	require.Nil(t, err)
	require.Equal(t, 0, len(groupMembers))

	// Delete a member
	_, err = ss.Group().DeleteMember(group.Id, user1.Id)
	require.Nil(t, err)

	// Should not return deleted members
	groupMembers, err = ss.Group().GetMemberUsers(group.Id)
	require.Nil(t, err)
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
	group, err := ss.Group().Create(g1)
	require.Nil(t, err)

	u1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user1, err := ss.User().Save(u1)
	require.Nil(t, err)

	_, err = ss.Group().UpsertMember(group.Id, user1.Id)
	require.Nil(t, err)

	u2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user2, err := ss.User().Save(u2)
	require.Nil(t, err)

	_, err = ss.Group().UpsertMember(group.Id, user2.Id)
	require.Nil(t, err)

	u3 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user3, err := ss.User().Save(u3)
	require.Nil(t, err)

	_, err = ss.Group().UpsertMember(group.Id, user3.Id)
	require.Nil(t, err)

	// Check returns members
	groupMembers, err := ss.Group().GetMemberUsersPage(group.Id, 0, 100)
	require.Nil(t, err)
	require.Equal(t, 3, len(groupMembers))

	// Check page 1
	groupMembers, err = ss.Group().GetMemberUsersPage(group.Id, 0, 2)
	require.Nil(t, err)
	require.Equal(t, 2, len(groupMembers))
	require.Equal(t, user3.Id, groupMembers[0].Id)
	require.Equal(t, user2.Id, groupMembers[1].Id)

	// Check page 2
	groupMembers, err = ss.Group().GetMemberUsersPage(group.Id, 1, 2)
	require.Nil(t, err)
	require.Equal(t, 1, len(groupMembers))
	require.Equal(t, user1.Id, groupMembers[0].Id)

	// Check madeup id
	groupMembers, err = ss.Group().GetMemberUsersPage(model.NewId(), 0, 100)
	require.Nil(t, err)
	require.Equal(t, 0, len(groupMembers))

	// Delete a member
	_, err = ss.Group().DeleteMember(group.Id, user1.Id)
	require.Nil(t, err)

	// Should not return deleted members
	groupMembers, err = ss.Group().GetMemberUsersPage(group.Id, 0, 100)
	require.Nil(t, err)
	require.Equal(t, 2, len(groupMembers))
}

func testUpsertMember(t *testing.T, ss store.Store) {
	// Create group
	g1 := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewId(),
	}
	group, err := ss.Group().Create(g1)
	require.Nil(t, err)

	// Create user
	u1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user, err := ss.User().Save(u1)
	require.Nil(t, err)

	// Happy path
	d2, err := ss.Group().UpsertMember(group.Id, user.Id)
	require.Nil(t, err)
	require.Equal(t, d2.GroupId, group.Id)
	require.Equal(t, d2.UserId, user.Id)
	require.NotZero(t, d2.CreateAt)
	require.Zero(t, d2.DeleteAt)

	// Duplicate composite key (GroupId, UserId)
	// Ensure new CreateAt > previous CreateAt for the same (groupId, userId)
	time.Sleep(1 * time.Millisecond)
	_, err = ss.Group().UpsertMember(group.Id, user.Id)
	require.Nil(t, err)

	// Invalid GroupId
	_, err = ss.Group().UpsertMember(model.NewId(), user.Id)
	require.Equal(t, err.Id, "store.insert_error")

	// Restores a deleted member
	// Ensure new CreateAt > previous CreateAt for the same (groupId, userId)
	time.Sleep(1 * time.Millisecond)
	_, err = ss.Group().UpsertMember(group.Id, user.Id)
	require.Nil(t, err)

	_, err = ss.Group().DeleteMember(group.Id, user.Id)
	require.Nil(t, err)

	groupMembers, err := ss.Group().GetMemberUsers(group.Id)
	beforeRestoreCount := len(groupMembers)

	_, err = ss.Group().UpsertMember(group.Id, user.Id)
	require.Nil(t, err)

	groupMembers, err = ss.Group().GetMemberUsers(group.Id)
	afterRestoreCount := len(groupMembers)

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
	group, err := ss.Group().Create(g1)
	require.Nil(t, err)

	// Create user
	u1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user, err := ss.User().Save(u1)
	require.Nil(t, err)

	// Create member
	d1, err := ss.Group().UpsertMember(group.Id, user.Id)
	require.Nil(t, err)

	// Happy path
	d2, err := ss.Group().DeleteMember(group.Id, user.Id)
	require.Nil(t, err)
	require.Equal(t, d2.GroupId, group.Id)
	require.Equal(t, d2.UserId, user.Id)
	require.Equal(t, d2.CreateAt, d1.CreateAt)
	require.NotZero(t, d2.DeleteAt)

	// Delete an already deleted member
	_, err = ss.Group().DeleteMember(group.Id, user.Id)
	require.Equal(t, err.Id, "store.sql_group.no_rows")

	// Delete with non-existent User
	_, err = ss.Group().DeleteMember(group.Id, model.NewId())
	require.Equal(t, err.Id, "store.sql_group.no_rows")

	// Delete non-existent Group
	_, err = ss.Group().DeleteMember(model.NewId(), group.Id)
	require.Equal(t, err.Id, "store.sql_group.no_rows")
}

func testGroupPermanentDeleteMembersByUser(t *testing.T, ss store.Store) {
	var g *model.Group
	var groups []*model.Group
	numberOfGroups := 5

	for i := 0; i < numberOfGroups; i++ {
		g = &model.Group{
			Name:        model.NewId(),
			DisplayName: model.NewId(),
			Source:      model.GroupSourceLdap,
			RemoteId:    model.NewId(),
		}
		group, err := ss.Group().Create(g)
		groups = append(groups, group)
		require.Nil(t, err)
	}

	// Create user
	u1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user, err := ss.User().Save(u1)
	require.Nil(t, err)

	// Create members
	for _, group := range groups {
		_, err = ss.Group().UpsertMember(group.Id, user.Id)
		require.Nil(t, err)
	}

	// Happy path
	err = ss.Group().PermanentDeleteMembersByUser(user.Id)
	require.Nil(t, err)
}

func testCreateGroupSyncable(t *testing.T, ss store.Store) {
	// Invalid GroupID
	_, err := ss.Group().CreateGroupSyncable(model.NewGroupTeam("x", model.NewId(), false))
	require.Equal(t, err.Id, "model.group_syncable.group_id.app_error")

	// Create Group
	g1 := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewId(),
	}
	group, err := ss.Group().Create(g1)
	require.Nil(t, err)

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
	d1, err := ss.Group().CreateGroupSyncable(gt1)
	require.Nil(t, err)
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
	group, err := ss.Group().Create(g1)
	require.Nil(t, err)

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
	groupTeam, err := ss.Group().CreateGroupSyncable(gt1)
	require.Nil(t, err)

	// Get GroupSyncable
	dgt, err := ss.Group().GetGroupSyncable(groupTeam.GroupId, groupTeam.SyncableId, model.GroupSyncableTypeTeam)
	require.Nil(t, err)
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
	group, err := ss.Group().Create(g)
	require.Nil(t, err)

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
		var team *model.Team
		team, err = ss.Team().Save(t1)
		require.Nil(t, err)

		// create groupteam
		var groupTeam *model.GroupSyncable
		gt := model.NewGroupTeam(group.Id, team.Id, false)
		gt.SchemeAdmin = true
		groupTeam, err = ss.Group().CreateGroupSyncable(gt)
		require.Nil(t, err)
		groupTeams = append(groupTeams, groupTeam)
	}

	// Returns all the group teams
	d1, err := ss.Group().GetAllGroupSyncablesByGroupId(group.Id, model.GroupSyncableTypeTeam)
	require.Nil(t, err)
	require.Condition(t, func() bool { return len(d1) >= numGroupSyncables })
	for _, expectedGroupTeam := range groupTeams {
		present := false
		for _, dbGroupTeam := range d1 {
			if dbGroupTeam.GroupId == expectedGroupTeam.GroupId && dbGroupTeam.SyncableId == expectedGroupTeam.SyncableId {
				require.True(t, dbGroupTeam.SchemeAdmin)
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
	group, err := ss.Group().Create(g1)
	require.Nil(t, err)

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
	d1, err := ss.Group().CreateGroupSyncable(gt1)
	require.Nil(t, err)

	// Update existing group team
	gt1.AutoAdd = true
	d2, err := ss.Group().UpdateGroupSyncable(gt1)
	require.Nil(t, err)
	require.True(t, d2.AutoAdd)

	// Non-existent Group
	gt2 := model.NewGroupTeam(model.NewId(), team.Id, false)
	_, err = ss.Group().UpdateGroupSyncable(gt2)
	require.Equal(t, err.Id, "store.sql_group.no_rows")

	// Non-existent Team
	gt3 := model.NewGroupTeam(group.Id, model.NewId(), false)
	_, err = ss.Group().UpdateGroupSyncable(gt3)
	require.Equal(t, err.Id, "store.sql_group.no_rows")

	// Cannot update CreateAt or DeleteAt
	origCreateAt := d1.CreateAt
	d1.CreateAt = model.GetMillis()
	d1.AutoAdd = true
	d3, err := ss.Group().UpdateGroupSyncable(d1)
	require.Nil(t, err)
	require.Equal(t, origCreateAt, d3.CreateAt)

	// Cannot update DeleteAt to arbitrary value
	d1.DeleteAt = 1
	_, err = ss.Group().UpdateGroupSyncable(d1)
	require.Equal(t, "model.group.delete_at.app_error", err.Id)

	// Can update DeleteAt to 0
	d1.DeleteAt = 0
	d4, err := ss.Group().UpdateGroupSyncable(d1)
	require.Nil(t, err)
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
	group, err := ss.Group().Create(g1)
	require.Nil(t, err)

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
	groupTeam, err := ss.Group().CreateGroupSyncable(gt1)
	require.Nil(t, err)

	// Non-existent Group
	_, err = ss.Group().DeleteGroupSyncable(model.NewId(), groupTeam.SyncableId, model.GroupSyncableTypeTeam)
	require.Equal(t, err.Id, "store.sql_group.no_rows")

	// Non-existent Team
	_, err = ss.Group().DeleteGroupSyncable(groupTeam.GroupId, model.NewId(), model.GroupSyncableTypeTeam)
	require.Equal(t, err.Id, "store.sql_group.no_rows")

	// Happy path...
	d1, err := ss.Group().DeleteGroupSyncable(groupTeam.GroupId, groupTeam.SyncableId, model.GroupSyncableTypeTeam)
	require.Nil(t, err)
	require.NotZero(t, d1.DeleteAt)
	require.Equal(t, d1.GroupId, groupTeam.GroupId)
	require.Equal(t, d1.SyncableId, groupTeam.SyncableId)
	require.Equal(t, d1.AutoAdd, groupTeam.AutoAdd)
	require.Equal(t, d1.CreateAt, groupTeam.CreateAt)
	require.Condition(t, func() bool { return d1.UpdateAt > groupTeam.UpdateAt })

	// Record already deleted
	_, err = ss.Group().DeleteGroupSyncable(d1.GroupId, d1.SyncableId, d1.Type)
	require.NotNil(t, err)
	require.Equal(t, err.Id, "store.sql_group.group_syncable_already_deleted")
}

func testTeamMembersToAdd(t *testing.T, ss store.Store) {
	// Create Group
	group, err := ss.Group().Create(&model.Group{
		Name:        model.NewId(),
		DisplayName: "TeamMembersToAdd Test Group",
		RemoteId:    model.NewId(),
		Source:      model.GroupSourceLdap,
	})
	require.Nil(t, err)

	// Create User
	user := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user, err = ss.User().Save(user)
	require.Nil(t, err)

	// Create GroupMember
	_, err = ss.Group().UpsertMember(group.Id, user.Id)
	require.Nil(t, err)

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
	team, err = ss.Team().Save(team)
	require.Nil(t, err)

	// Create GroupTeam
	syncable, err := ss.Group().CreateGroupSyncable(model.NewGroupTeam(group.Id, team.Id, true))
	require.Nil(t, err)

	// Time before syncable was created
	teamMembers, err := ss.Group().TeamMembersToAdd(syncable.CreateAt-1, nil)
	require.Nil(t, err)
	require.Len(t, teamMembers, 1)
	require.Equal(t, user.Id, teamMembers[0].UserID)
	require.Equal(t, team.Id, teamMembers[0].TeamID)

	// Time after syncable was created
	teamMembers, err = ss.Group().TeamMembersToAdd(syncable.CreateAt+1, nil)
	require.Nil(t, err)
	require.Empty(t, teamMembers)

	// Delete and restore GroupMember should return result
	_, err = ss.Group().DeleteMember(group.Id, user.Id)
	require.Nil(t, err)
	_, err = ss.Group().UpsertMember(group.Id, user.Id)
	require.Nil(t, err)
	teamMembers, err = ss.Group().TeamMembersToAdd(syncable.CreateAt+1, nil)
	require.Nil(t, err)
	require.Len(t, teamMembers, 1)

	pristineSyncable := *syncable

	_, err = ss.Group().UpdateGroupSyncable(syncable)
	require.Nil(t, err)

	// Time before syncable was updated
	teamMembers, err = ss.Group().TeamMembersToAdd(syncable.UpdateAt-1, nil)
	require.Nil(t, err)
	require.Len(t, teamMembers, 1)
	require.Equal(t, user.Id, teamMembers[0].UserID)
	require.Equal(t, team.Id, teamMembers[0].TeamID)

	// Time after syncable was updated
	teamMembers, err = ss.Group().TeamMembersToAdd(syncable.UpdateAt+1, nil)
	require.Nil(t, err)
	require.Empty(t, teamMembers)

	// Only includes if auto-add
	syncable.AutoAdd = false
	_, err = ss.Group().UpdateGroupSyncable(syncable)
	require.Nil(t, err)
	teamMembers, err = ss.Group().TeamMembersToAdd(0, nil)
	require.Nil(t, err)
	require.Empty(t, teamMembers)

	// reset state of syncable and verify
	_, err = ss.Group().UpdateGroupSyncable(&pristineSyncable)
	require.Nil(t, err)
	teamMembers, err = ss.Group().TeamMembersToAdd(0, nil)
	require.Nil(t, err)
	require.Len(t, teamMembers, 1)

	// No result if Group deleted
	_, err = ss.Group().Delete(group.Id)
	require.Nil(t, err)
	teamMembers, err = ss.Group().TeamMembersToAdd(0, nil)
	require.Nil(t, err)
	require.Empty(t, teamMembers)

	// reset state of group and verify
	group.DeleteAt = 0
	_, err = ss.Group().Update(group)
	require.Nil(t, err)
	teamMembers, err = ss.Group().TeamMembersToAdd(0, nil)
	require.Nil(t, err)
	require.Len(t, teamMembers, 1)

	// No result if Team deleted
	team.DeleteAt = model.GetMillis()
	team, err = ss.Team().Update(team)
	require.Nil(t, err)
	teamMembers, err = ss.Group().TeamMembersToAdd(0, nil)
	require.Nil(t, err)
	require.Empty(t, teamMembers)

	// reset state of team and verify
	team.DeleteAt = 0
	team, err = ss.Team().Update(team)
	require.Nil(t, err)
	teamMembers, err = ss.Group().TeamMembersToAdd(0, nil)
	require.Nil(t, err)
	require.Len(t, teamMembers, 1)

	// No result if GroupTeam deleted
	_, err = ss.Group().DeleteGroupSyncable(group.Id, team.Id, model.GroupSyncableTypeTeam)
	require.Nil(t, err)
	teamMembers, err = ss.Group().TeamMembersToAdd(0, nil)
	require.Nil(t, err)
	require.Empty(t, teamMembers)

	// reset GroupTeam and verify
	_, err = ss.Group().UpdateGroupSyncable(&pristineSyncable)
	require.Nil(t, err)
	teamMembers, err = ss.Group().TeamMembersToAdd(0, nil)
	require.Nil(t, err)
	require.Len(t, teamMembers, 1)

	// No result if GroupMember deleted
	_, err = ss.Group().DeleteMember(group.Id, user.Id)
	require.Nil(t, err)
	teamMembers, err = ss.Group().TeamMembersToAdd(0, nil)
	require.Nil(t, err)
	require.Empty(t, teamMembers)

	// restore group member and verify
	_, err = ss.Group().UpsertMember(group.Id, user.Id)
	require.Nil(t, err)
	teamMembers, err = ss.Group().TeamMembersToAdd(0, nil)
	require.Nil(t, err)
	require.Len(t, teamMembers, 1)

	// adding team membership stops returning result
	_, err = ss.Team().SaveMember(&model.TeamMember{
		TeamId: team.Id,
		UserId: user.Id,
	}, 999)
	require.Nil(t, err)
	teamMembers, err = ss.Group().TeamMembersToAdd(0, nil)
	require.Nil(t, err)
	require.Empty(t, teamMembers)
}

func testTeamMembersToAddSingleTeam(t *testing.T, ss store.Store) {
	group1, err := ss.Group().Create(&model.Group{
		Name:        model.NewId(),
		DisplayName: "TeamMembersToAdd Test Group",
		RemoteId:    model.NewId(),
		Source:      model.GroupSourceLdap,
	})
	require.Nil(t, err)

	group2, err := ss.Group().Create(&model.Group{
		Name:        model.NewId(),
		DisplayName: "TeamMembersToAdd Test Group",
		RemoteId:    model.NewId(),
		Source:      model.GroupSourceLdap,
	})
	require.Nil(t, err)

	user1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user1, err = ss.User().Save(user1)
	require.Nil(t, err)

	user2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user2, err = ss.User().Save(user2)
	require.Nil(t, err)

	user3 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user3, err = ss.User().Save(user3)
	require.Nil(t, err)

	for _, user := range []*model.User{user1, user2} {
		_, err = ss.Group().UpsertMember(group1.Id, user.Id)
		require.Nil(t, err)
	}
	_, err = ss.Group().UpsertMember(group2.Id, user3.Id)
	require.Nil(t, err)

	team1 := &model.Team{
		DisplayName:     "Name",
		Description:     "Some description",
		CompanyName:     "Some company name",
		AllowOpenInvite: false,
		InviteId:        "inviteid0",
		Name:            "z-z-" + model.NewId() + "a",
		Email:           "success+" + model.NewId() + "@simulator.amazonses.com",
		Type:            model.TEAM_OPEN,
	}
	team1, err = ss.Team().Save(team1)
	require.Nil(t, err)

	team2 := &model.Team{
		DisplayName:     "Name",
		Description:     "Some description",
		CompanyName:     "Some company name",
		AllowOpenInvite: false,
		InviteId:        "inviteid0",
		Name:            "z-z-" + model.NewId() + "a",
		Email:           "success+" + model.NewId() + "@simulator.amazonses.com",
		Type:            model.TEAM_OPEN,
	}
	team2, err = ss.Team().Save(team2)
	require.Nil(t, err)

	_, err = ss.Group().CreateGroupSyncable(model.NewGroupTeam(group1.Id, team1.Id, true))
	require.Nil(t, err)

	_, err = ss.Group().CreateGroupSyncable(model.NewGroupTeam(group2.Id, team2.Id, true))
	require.Nil(t, err)

	teamMembers, err := ss.Group().TeamMembersToAdd(0, nil)
	require.Nil(t, err)
	require.Len(t, teamMembers, 3)

	teamMembers, err = ss.Group().TeamMembersToAdd(0, &team1.Id)
	require.Nil(t, err)
	require.Len(t, teamMembers, 2)

	teamMembers, err = ss.Group().TeamMembersToAdd(0, &team2.Id)
	require.Nil(t, err)
	require.Len(t, teamMembers, 1)
}

func testChannelMembersToAdd(t *testing.T, ss store.Store) {
	// Create Group
	group, err := ss.Group().Create(&model.Group{
		Name:        model.NewId(),
		DisplayName: "ChannelMembersToAdd Test Group",
		RemoteId:    model.NewId(),
		Source:      model.GroupSourceLdap,
	})
	require.Nil(t, err)

	// Create User
	user := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user, err = ss.User().Save(user)
	require.Nil(t, err)

	// Create GroupMember
	_, err = ss.Group().UpsertMember(group.Id, user.Id)
	require.Nil(t, err)

	// Create Channel
	channel := &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "A Name",
		Name:        model.NewId(),
		Type:        model.CHANNEL_OPEN, // Query does not look at type so this shouldn't matter.
	}
	channel, err = ss.Channel().Save(channel, 9999)
	require.Nil(t, err)

	// Create GroupChannel
	syncable, err := ss.Group().CreateGroupSyncable(model.NewGroupChannel(group.Id, channel.Id, true))
	require.Nil(t, err)

	// Time before syncable was created
	channelMembers, err := ss.Group().ChannelMembersToAdd(syncable.CreateAt-1, nil)
	require.Nil(t, err)
	require.Len(t, channelMembers, 1)
	require.Equal(t, user.Id, channelMembers[0].UserID)
	require.Equal(t, channel.Id, channelMembers[0].ChannelID)

	// Time after syncable was created
	channelMembers, err = ss.Group().ChannelMembersToAdd(syncable.CreateAt+1, nil)
	require.Nil(t, err)
	require.Empty(t, channelMembers)

	// Delete and restore GroupMember should return result
	_, err = ss.Group().DeleteMember(group.Id, user.Id)
	require.Nil(t, err)
	_, err = ss.Group().UpsertMember(group.Id, user.Id)
	require.Nil(t, err)
	channelMembers, err = ss.Group().ChannelMembersToAdd(syncable.CreateAt+1, nil)
	require.Nil(t, err)
	require.Len(t, channelMembers, 1)

	pristineSyncable := *syncable

	_, err = ss.Group().UpdateGroupSyncable(syncable)
	require.Nil(t, err)

	// Time before syncable was updated
	channelMembers, err = ss.Group().ChannelMembersToAdd(syncable.UpdateAt-1, nil)
	require.Nil(t, err)
	require.Len(t, channelMembers, 1)
	require.Equal(t, user.Id, channelMembers[0].UserID)
	require.Equal(t, channel.Id, channelMembers[0].ChannelID)

	// Time after syncable was updated
	channelMembers, err = ss.Group().ChannelMembersToAdd(syncable.UpdateAt+1, nil)
	require.Nil(t, err)
	require.Empty(t, channelMembers)

	// Only includes if auto-add
	syncable.AutoAdd = false
	_, err = ss.Group().UpdateGroupSyncable(syncable)
	require.Nil(t, err)
	channelMembers, err = ss.Group().ChannelMembersToAdd(0, nil)
	require.Nil(t, err)
	require.Empty(t, channelMembers)

	// reset state of syncable and verify
	_, err = ss.Group().UpdateGroupSyncable(&pristineSyncable)
	require.Nil(t, err)
	channelMembers, err = ss.Group().ChannelMembersToAdd(0, nil)
	require.Nil(t, err)
	require.Len(t, channelMembers, 1)

	// No result if Group deleted
	_, err = ss.Group().Delete(group.Id)
	require.Nil(t, err)
	channelMembers, err = ss.Group().ChannelMembersToAdd(0, nil)
	require.Nil(t, err)
	require.Empty(t, channelMembers)

	// reset state of group and verify
	group.DeleteAt = 0
	_, err = ss.Group().Update(group)
	require.Nil(t, err)
	channelMembers, err = ss.Group().ChannelMembersToAdd(0, nil)
	require.Nil(t, err)
	require.Len(t, channelMembers, 1)

	// No result if Channel deleted
	err = ss.Channel().Delete(channel.Id, model.GetMillis())
	require.Nil(t, err)
	channelMembers, err = ss.Group().ChannelMembersToAdd(0, nil)
	require.Nil(t, err)
	require.Empty(t, channelMembers)

	// reset state of channel and verify
	channel.DeleteAt = 0
	_, err = ss.Channel().Update(channel)
	require.Nil(t, err)
	channelMembers, err = ss.Group().ChannelMembersToAdd(0, nil)
	require.Nil(t, err)
	require.Len(t, channelMembers, 1)

	// No result if GroupChannel deleted
	_, err = ss.Group().DeleteGroupSyncable(group.Id, channel.Id, model.GroupSyncableTypeChannel)
	require.Nil(t, err)
	channelMembers, err = ss.Group().ChannelMembersToAdd(0, nil)
	require.Nil(t, err)
	require.Empty(t, channelMembers)

	// reset GroupChannel and verify
	_, err = ss.Group().UpdateGroupSyncable(&pristineSyncable)
	require.Nil(t, err)
	channelMembers, err = ss.Group().ChannelMembersToAdd(0, nil)
	require.Nil(t, err)
	require.Len(t, channelMembers, 1)

	// No result if GroupMember deleted
	_, err = ss.Group().DeleteMember(group.Id, user.Id)
	require.Nil(t, err)
	channelMembers, err = ss.Group().ChannelMembersToAdd(0, nil)
	require.Nil(t, err)
	require.Empty(t, channelMembers)

	// restore group member and verify
	_, err = ss.Group().UpsertMember(group.Id, user.Id)
	require.Nil(t, err)
	channelMembers, err = ss.Group().ChannelMembersToAdd(0, nil)
	require.Nil(t, err)
	require.Len(t, channelMembers, 1)

	// Adding Channel (ChannelMemberHistory) should stop returning result
	err = ss.ChannelMemberHistory().LogJoinEvent(user.Id, channel.Id, model.GetMillis())
	require.Nil(t, err)
	channelMembers, err = ss.Group().ChannelMembersToAdd(0, nil)
	require.Nil(t, err)
	require.Empty(t, channelMembers)

	// Leaving Channel (ChannelMemberHistory) should still not return result
	err = ss.ChannelMemberHistory().LogLeaveEvent(user.Id, channel.Id, model.GetMillis())
	require.Nil(t, err)
	channelMembers, err = ss.Group().ChannelMembersToAdd(0, nil)
	require.Nil(t, err)
	require.Empty(t, channelMembers)

	// Purging ChannelMemberHistory re-returns the result
	_, err = ss.ChannelMemberHistory().PermanentDeleteBatch(model.GetMillis()+1, 100)
	require.Nil(t, err)
	channelMembers, err = ss.Group().ChannelMembersToAdd(0, nil)
	require.Nil(t, err)
	require.Len(t, channelMembers, 1)
}

func testChannelMembersToAddSingleChannel(t *testing.T, ss store.Store) {
	group1, err := ss.Group().Create(&model.Group{
		Name:        model.NewId(),
		DisplayName: "TeamMembersToAdd Test Group",
		RemoteId:    model.NewId(),
		Source:      model.GroupSourceLdap,
	})
	require.Nil(t, err)

	group2, err := ss.Group().Create(&model.Group{
		Name:        model.NewId(),
		DisplayName: "TeamMembersToAdd Test Group",
		RemoteId:    model.NewId(),
		Source:      model.GroupSourceLdap,
	})
	require.Nil(t, err)

	user1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user1, err = ss.User().Save(user1)
	require.Nil(t, err)

	user2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user2, err = ss.User().Save(user2)
	require.Nil(t, err)

	user3 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user3, err = ss.User().Save(user3)
	require.Nil(t, err)

	for _, user := range []*model.User{user1, user2} {
		_, err = ss.Group().UpsertMember(group1.Id, user.Id)
		require.Nil(t, err)
	}
	_, err = ss.Group().UpsertMember(group2.Id, user3.Id)
	require.Nil(t, err)

	channel1 := &model.Channel{
		DisplayName: "Name",
		Name:        "z-z-" + model.NewId() + "a",
		Type:        model.CHANNEL_OPEN,
	}
	channel1, err = ss.Channel().Save(channel1, 999)
	require.Nil(t, err)

	channel2 := &model.Channel{
		DisplayName: "Name",
		Name:        "z-z-" + model.NewId() + "a",
		Type:        model.CHANNEL_OPEN,
	}
	channel2, err = ss.Channel().Save(channel2, 999)
	require.Nil(t, err)

	_, err = ss.Group().CreateGroupSyncable(model.NewGroupChannel(group1.Id, channel1.Id, true))
	require.Nil(t, err)

	_, err = ss.Group().CreateGroupSyncable(model.NewGroupChannel(group2.Id, channel2.Id, true))
	require.Nil(t, err)

	channelMembers, err := ss.Group().ChannelMembersToAdd(0, nil)
	require.Nil(t, err)
	require.GreaterOrEqual(t, len(channelMembers), 3)

	channelMembers, err = ss.Group().ChannelMembersToAdd(0, &channel1.Id)
	require.Nil(t, err)
	require.Len(t, channelMembers, 2)

	channelMembers, err = ss.Group().ChannelMembersToAdd(0, &channel2.Id)
	require.Nil(t, err)
	require.Len(t, channelMembers, 1)
}

func testTeamMembersToRemove(t *testing.T, ss store.Store) {
	data := pendingMemberRemovalsDataSetup(t, ss)

	// one result when both users are in the group (for user C)
	teamMembers, err := ss.Group().TeamMembersToRemove(nil)
	require.Nil(t, err)
	require.Len(t, teamMembers, 1)
	require.Equal(t, data.UserC.Id, teamMembers[0].UserId)

	_, err = ss.Group().DeleteMember(data.Group.Id, data.UserB.Id)
	require.Nil(t, err)

	// user b and c should now be returned
	teamMembers, err = ss.Group().TeamMembersToRemove(nil)
	require.Nil(t, err)
	require.Len(t, teamMembers, 2)

	var userIDs []string
	for _, item := range teamMembers {
		userIDs = append(userIDs, item.UserId)
	}
	require.Contains(t, userIDs, data.UserB.Id)
	require.Contains(t, userIDs, data.UserC.Id)
	require.Equal(t, data.ConstrainedTeam.Id, teamMembers[0].TeamId)
	require.Equal(t, data.ConstrainedTeam.Id, teamMembers[1].TeamId)

	_, err = ss.Group().DeleteMember(data.Group.Id, data.UserA.Id)
	require.Nil(t, err)

	teamMembers, err = ss.Group().TeamMembersToRemove(nil)
	require.Nil(t, err)
	require.Len(t, teamMembers, 3)

	// Make one of them a bot
	teamMembers, err = ss.Group().TeamMembersToRemove(nil)
	require.Nil(t, err)
	teamMember := teamMembers[0]
	bot := &model.Bot{
		UserId:      teamMember.UserId,
		Username:    "un_" + model.NewId(),
		DisplayName: "dn_" + model.NewId(),
		OwnerId:     teamMember.UserId,
	}
	bot, err = ss.Bot().Save(bot)
	require.Nil(t, err)

	// verify that bot is not returned in results
	teamMembers, err = ss.Group().TeamMembersToRemove(nil)
	require.Nil(t, err)
	require.Len(t, teamMembers, 2)

	// delete the bot
	err = ss.Bot().PermanentDelete(bot.UserId)
	require.Nil(t, err)

	// Should be back to 3 users
	teamMembers, err = ss.Group().TeamMembersToRemove(nil)
	require.Nil(t, err)
	require.Len(t, teamMembers, 3)

	// add users back to groups
	res := ss.Team().RemoveMember(data.ConstrainedTeam.Id, data.UserA.Id)
	require.Nil(t, res)
	res = ss.Team().RemoveMember(data.ConstrainedTeam.Id, data.UserB.Id)
	require.Nil(t, res)
	res = ss.Team().RemoveMember(data.ConstrainedTeam.Id, data.UserC.Id)
	require.Nil(t, res)
	err = ss.Channel().RemoveMember(data.ConstrainedChannel.Id, data.UserA.Id)
	require.Nil(t, err)
	err = ss.Channel().RemoveMember(data.ConstrainedChannel.Id, data.UserB.Id)
	require.Nil(t, err)
	err = ss.Channel().RemoveMember(data.ConstrainedChannel.Id, data.UserC.Id)
	require.Nil(t, err)
}

func testTeamMembersToRemoveSingleTeam(t *testing.T, ss store.Store) {
	user1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user1, err := ss.User().Save(user1)
	require.Nil(t, err)

	user2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user2, err = ss.User().Save(user2)
	require.Nil(t, err)

	user3 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user3, err = ss.User().Save(user3)
	require.Nil(t, err)

	team1 := &model.Team{
		DisplayName:      "Name",
		Description:      "Some description",
		CompanyName:      "Some company name",
		AllowOpenInvite:  false,
		InviteId:         "inviteid0",
		Name:             "z-z-" + model.NewId() + "a",
		Email:            "success+" + model.NewId() + "@simulator.amazonses.com",
		Type:             model.TEAM_OPEN,
		GroupConstrained: model.NewBool(true),
	}
	team1, err = ss.Team().Save(team1)
	require.Nil(t, err)

	team2 := &model.Team{
		DisplayName:      "Name",
		Description:      "Some description",
		CompanyName:      "Some company name",
		AllowOpenInvite:  false,
		InviteId:         "inviteid0",
		Name:             "z-z-" + model.NewId() + "a",
		Email:            "success+" + model.NewId() + "@simulator.amazonses.com",
		Type:             model.TEAM_OPEN,
		GroupConstrained: model.NewBool(true),
	}
	team2, err = ss.Team().Save(team2)
	require.Nil(t, err)

	for _, user := range []*model.User{user1, user2} {
		_, err = ss.Team().SaveMember(&model.TeamMember{
			TeamId: team1.Id,
			UserId: user.Id,
		}, 999)
		require.Nil(t, err)
	}

	_, err = ss.Team().SaveMember(&model.TeamMember{
		TeamId: team2.Id,
		UserId: user3.Id,
	}, 999)
	require.Nil(t, err)

	teamMembers, err := ss.Group().TeamMembersToRemove(nil)
	require.Nil(t, err)
	require.Len(t, teamMembers, 3)

	teamMembers, err = ss.Group().TeamMembersToRemove(&team1.Id)
	require.Nil(t, err)
	require.Len(t, teamMembers, 2)

	teamMembers, err = ss.Group().TeamMembersToRemove(&team2.Id)
	require.Nil(t, err)
	require.Len(t, teamMembers, 1)
}

func testChannelMembersToRemove(t *testing.T, ss store.Store) {
	data := pendingMemberRemovalsDataSetup(t, ss)

	// one result when both users are in the group (for user C)
	channelMembers, err := ss.Group().ChannelMembersToRemove(nil)
	require.Nil(t, err)
	require.Len(t, channelMembers, 1)
	require.Equal(t, data.UserC.Id, channelMembers[0].UserId)

	_, err = ss.Group().DeleteMember(data.Group.Id, data.UserB.Id)
	require.Nil(t, err)

	// user b and c should now be returned
	channelMembers, err = ss.Group().ChannelMembersToRemove(nil)
	require.Nil(t, err)
	require.Len(t, channelMembers, 2)

	var userIDs []string
	for _, item := range channelMembers {
		userIDs = append(userIDs, item.UserId)
	}
	require.Contains(t, userIDs, data.UserB.Id)
	require.Contains(t, userIDs, data.UserC.Id)
	require.Equal(t, data.ConstrainedChannel.Id, channelMembers[0].ChannelId)
	require.Equal(t, data.ConstrainedChannel.Id, channelMembers[1].ChannelId)

	_, err = ss.Group().DeleteMember(data.Group.Id, data.UserA.Id)
	require.Nil(t, err)

	channelMembers, err = ss.Group().ChannelMembersToRemove(nil)
	require.Nil(t, err)
	require.Len(t, channelMembers, 3)

	// Make one of them a bot
	channelMembers, err = ss.Group().ChannelMembersToRemove(nil)
	require.Nil(t, err)
	channelMember := channelMembers[0]
	bot := &model.Bot{
		UserId:      channelMember.UserId,
		Username:    "un_" + model.NewId(),
		DisplayName: "dn_" + model.NewId(),
		OwnerId:     channelMember.UserId,
	}
	bot, err = ss.Bot().Save(bot)
	require.Nil(t, err)

	// verify that bot is not returned in results
	channelMembers, err = ss.Group().ChannelMembersToRemove(nil)
	require.Nil(t, err)
	require.Len(t, channelMembers, 2)

	// delete the bot
	err = ss.Bot().PermanentDelete(bot.UserId)
	require.Nil(t, err)

	// Should be back to 3 users
	channelMembers, err = ss.Group().ChannelMembersToRemove(nil)
	require.Nil(t, err)
	require.Len(t, channelMembers, 3)

	// add users back to groups
	res := ss.Team().RemoveMember(data.ConstrainedTeam.Id, data.UserA.Id)
	require.Nil(t, res)
	res = ss.Team().RemoveMember(data.ConstrainedTeam.Id, data.UserB.Id)
	require.Nil(t, res)
	res = ss.Team().RemoveMember(data.ConstrainedTeam.Id, data.UserC.Id)
	require.Nil(t, res)
	err = ss.Channel().RemoveMember(data.ConstrainedChannel.Id, data.UserA.Id)
	require.Nil(t, err)
	err = ss.Channel().RemoveMember(data.ConstrainedChannel.Id, data.UserB.Id)
	require.Nil(t, err)
	err = ss.Channel().RemoveMember(data.ConstrainedChannel.Id, data.UserC.Id)
	require.Nil(t, err)
}

func testChannelMembersToRemoveSingleChannel(t *testing.T, ss store.Store) {
	user1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user1, err := ss.User().Save(user1)
	require.Nil(t, err)

	user2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user2, err = ss.User().Save(user2)
	require.Nil(t, err)

	user3 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user3, err = ss.User().Save(user3)
	require.Nil(t, err)

	channel1 := &model.Channel{
		DisplayName:      "Name",
		Name:             "z-z-" + model.NewId() + "a",
		Type:             model.CHANNEL_OPEN,
		GroupConstrained: model.NewBool(true),
	}
	channel1, err = ss.Channel().Save(channel1, 999)
	require.Nil(t, err)

	channel2 := &model.Channel{
		DisplayName:      "Name",
		Name:             "z-z-" + model.NewId() + "a",
		Type:             model.CHANNEL_OPEN,
		GroupConstrained: model.NewBool(true),
	}
	channel2, err = ss.Channel().Save(channel2, 999)
	require.Nil(t, err)

	for _, user := range []*model.User{user1, user2} {
		_, err = ss.Channel().SaveMember(&model.ChannelMember{
			ChannelId:   channel1.Id,
			UserId:      user.Id,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		})
		require.Nil(t, err)
	}

	_, err = ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   channel2.Id,
		UserId:      user3.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.Nil(t, err)

	channelMembers, err := ss.Group().ChannelMembersToRemove(nil)
	require.Nil(t, err)
	require.Len(t, channelMembers, 3)

	channelMembers, err = ss.Group().ChannelMembersToRemove(&channel1.Id)
	require.Nil(t, err)
	require.Len(t, channelMembers, 2)

	channelMembers, err = ss.Group().ChannelMembersToRemove(&channel2.Id)
	require.Nil(t, err)
	require.Len(t, channelMembers, 1)
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
	group, err := ss.Group().Create(&model.Group{
		Name:        model.NewId(),
		DisplayName: "Pending[Channel|Team]MemberRemovals Test Group",
		RemoteId:    model.NewId(),
		Source:      model.GroupSourceLdap,
	})
	require.Nil(t, err)

	// create users
	// userA will get removed from the group
	userA := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	userA, err = ss.User().Save(userA)
	require.Nil(t, err)

	// userB will not get removed from the group
	userB := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	userB, err = ss.User().Save(userB)
	require.Nil(t, err)

	// userC was never in the group
	userC := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	userC, err = ss.User().Save(userC)
	require.Nil(t, err)

	// add users to group (but not userC)
	_, err = ss.Group().UpsertMember(group.Id, userA.Id)
	require.Nil(t, err)

	_, err = ss.Group().UpsertMember(group.Id, userB.Id)
	require.Nil(t, err)

	// create channels
	channelConstrained := &model.Channel{
		TeamId:           model.NewId(),
		DisplayName:      "A Name",
		Name:             model.NewId(),
		Type:             model.CHANNEL_PRIVATE,
		GroupConstrained: model.NewBool(true),
	}
	channelConstrained, err = ss.Channel().Save(channelConstrained, 9999)
	require.Nil(t, err)

	channelUnconstrained := &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "A Name",
		Name:        model.NewId(),
		Type:        model.CHANNEL_PRIVATE,
	}
	channelUnconstrained, err = ss.Channel().Save(channelUnconstrained, 9999)
	require.Nil(t, err)

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
	teamConstrained, err = ss.Team().Save(teamConstrained)
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
	_, err = ss.Group().CreateGroupSyncable(model.NewGroupTeam(group.Id, teamConstrained.Id, true))
	require.Nil(t, err)

	_, err = ss.Group().CreateGroupSyncable(model.NewGroupTeam(group.Id, teamUnconstrained.Id, true))
	require.Nil(t, err)

	// create groupchannels
	_, err = ss.Group().CreateGroupSyncable(model.NewGroupChannel(group.Id, channelConstrained.Id, true))
	require.Nil(t, err)

	_, err = ss.Group().CreateGroupSyncable(model.NewGroupChannel(group.Id, channelUnconstrained.Id, true))
	require.Nil(t, err)

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
		_, err = ss.Team().SaveMember(&model.TeamMember{
			UserId: item[0],
			TeamId: item[1],
		}, 99)
		require.Nil(t, err)
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
		_, err := ss.Channel().SaveMember(&model.ChannelMember{
			UserId:      item[0],
			ChannelId:   item[1],
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		})
		require.Nil(t, err)
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
	channel1, err := ss.Channel().Save(channel1, 9999)
	require.Nil(t, err)

	// Create Groups 1 and 2
	group1, err := ss.Group().Create(&model.Group{
		Name:        model.NewId(),
		DisplayName: "group-1",
		RemoteId:    model.NewId(),
		Source:      model.GroupSourceLdap,
	})
	require.Nil(t, err)

	group2, err := ss.Group().Create(&model.Group{
		Name:        model.NewId(),
		DisplayName: "group-2",
		RemoteId:    model.NewId(),
		Source:      model.GroupSourceLdap,
	})
	require.Nil(t, err)

	// And associate them with Channel1
	for _, g := range []*model.Group{group1, group2} {
		_, err = ss.Group().CreateGroupSyncable(&model.GroupSyncable{
			AutoAdd:    true,
			SyncableId: channel1.Id,
			Type:       model.GroupSyncableTypeChannel,
			GroupId:    g.Id,
		})
		require.Nil(t, err)
	}

	// Create Channel2
	channel2 := &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "Channel2",
		Name:        model.NewId(),
		Type:        model.CHANNEL_OPEN,
	}
	channel2, err = ss.Channel().Save(channel2, 9999)
	require.Nil(t, err)

	// Create Group3
	group3, err := ss.Group().Create(&model.Group{
		Name:        model.NewId(),
		DisplayName: "group-3",
		RemoteId:    model.NewId(),
		Source:      model.GroupSourceLdap,
	})
	require.Nil(t, err)

	// And associate it to Channel2
	_, err = ss.Group().CreateGroupSyncable(&model.GroupSyncable{
		AutoAdd:    true,
		SyncableId: channel2.Id,
		Type:       model.GroupSyncableTypeChannel,
		GroupId:    group3.Id,
	})
	require.Nil(t, err)

	// add members
	u1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user1, err := ss.User().Save(u1)
	require.Nil(t, err)

	u2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user2, err := ss.User().Save(u2)
	require.Nil(t, err)

	_, err = ss.Group().UpsertMember(group1.Id, user1.Id)
	require.Nil(t, err)

	_, err = ss.Group().UpsertMember(group1.Id, user2.Id)
	require.Nil(t, err)

	user2.DeleteAt = 1
	_, err = ss.User().Update(user2, true)
	require.Nil(t, err)

	group1WithMemberCount := *group1
	group1WithMemberCount.MemberCount = model.NewInt(1)

	group2WithMemberCount := *group2
	group2WithMemberCount.MemberCount = model.NewInt(0)

	group1WSA := &model.GroupWithSchemeAdmin{Group: *group1, SchemeAdmin: model.NewBool(false)}
	group2WSA := &model.GroupWithSchemeAdmin{Group: *group2, SchemeAdmin: model.NewBool(false)}
	group3WSA := &model.GroupWithSchemeAdmin{Group: *group3, SchemeAdmin: model.NewBool(false)}

	testCases := []struct {
		Name       string
		ChannelId  string
		Page       int
		PerPage    int
		Result     []*model.GroupWithSchemeAdmin
		Opts       model.GroupSearchOpts
		TotalCount *int64
	}{
		{
			Name:       "Get the two Groups for Channel1",
			ChannelId:  channel1.Id,
			Opts:       model.GroupSearchOpts{},
			Page:       0,
			PerPage:    60,
			Result:     []*model.GroupWithSchemeAdmin{group1WSA, group2WSA},
			TotalCount: model.NewInt64(2),
		},
		{
			Name:      "Get first Group for Channel1 with page 0 with 1 element",
			ChannelId: channel1.Id,
			Opts:      model.GroupSearchOpts{},
			Page:      0,
			PerPage:   1,
			Result:    []*model.GroupWithSchemeAdmin{group1WSA},
		},
		{
			Name:      "Get second Group for Channel1 with page 1 with 1 element",
			ChannelId: channel1.Id,
			Opts:      model.GroupSearchOpts{},
			Page:      1,
			PerPage:   1,
			Result:    []*model.GroupWithSchemeAdmin{group2WSA},
		},
		{
			Name:      "Get third Group for Channel2",
			ChannelId: channel2.Id,
			Opts:      model.GroupSearchOpts{},
			Page:      0,
			PerPage:   60,
			Result:    []*model.GroupWithSchemeAdmin{group3WSA},
		},
		{
			Name:       "Get empty Groups for a fake id",
			ChannelId:  model.NewId(),
			Opts:       model.GroupSearchOpts{},
			Page:       0,
			PerPage:    60,
			Result:     []*model.GroupWithSchemeAdmin{},
			TotalCount: model.NewInt64(0),
		},
		{
			Name:       "Get group matching name",
			ChannelId:  channel1.Id,
			Opts:       model.GroupSearchOpts{Q: string([]rune(group1.Name)[2:10])}, // very low change of a name collision
			Page:       0,
			PerPage:    100,
			Result:     []*model.GroupWithSchemeAdmin{group1WSA},
			TotalCount: model.NewInt64(1),
		},
		{
			Name:       "Get group matching display name",
			ChannelId:  channel1.Id,
			Opts:       model.GroupSearchOpts{Q: "rouP-1"},
			Page:       0,
			PerPage:    100,
			Result:     []*model.GroupWithSchemeAdmin{group1WSA},
			TotalCount: model.NewInt64(1),
		},
		{
			Name:       "Get group matching multiple display names",
			ChannelId:  channel1.Id,
			Opts:       model.GroupSearchOpts{Q: "roUp-"},
			Page:       0,
			PerPage:    100,
			Result:     []*model.GroupWithSchemeAdmin{group1WSA, group2WSA},
			TotalCount: model.NewInt64(2),
		},
		{
			Name:      "Include member counts",
			ChannelId: channel1.Id,
			Opts:      model.GroupSearchOpts{IncludeMemberCount: true},
			Page:      0,
			PerPage:   2,
			Result: []*model.GroupWithSchemeAdmin{
				{Group: group1WithMemberCount, SchemeAdmin: model.NewBool(false)},
				{Group: group2WithMemberCount, SchemeAdmin: model.NewBool(false)},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			if tc.Opts.PageOpts == nil {
				tc.Opts.PageOpts = &model.PageOpts{}
			}
			tc.Opts.PageOpts.Page = tc.Page
			tc.Opts.PageOpts.PerPage = tc.PerPage
			groups, err := ss.Group().GetGroupsByChannel(tc.ChannelId, tc.Opts)
			require.Nil(t, err)
			require.ElementsMatch(t, tc.Result, groups)
			if tc.TotalCount != nil {
				var count int64
				count, err = ss.Group().CountGroupsByChannel(tc.ChannelId, tc.Opts)
				require.Nil(t, err)
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
	group1, err := ss.Group().Create(&model.Group{
		Name:        model.NewId(),
		DisplayName: "group-1",
		RemoteId:    model.NewId(),
		Source:      model.GroupSourceLdap,
	})
	require.Nil(t, err)

	group2, err := ss.Group().Create(&model.Group{
		Name:        model.NewId(),
		DisplayName: "group-2",
		RemoteId:    model.NewId(),
		Source:      model.GroupSourceLdap,
	})
	require.Nil(t, err)

	// And associate them with Team1
	for _, g := range []*model.Group{group1, group2} {
		_, err = ss.Group().CreateGroupSyncable(&model.GroupSyncable{
			AutoAdd:    true,
			SyncableId: team1.Id,
			Type:       model.GroupSyncableTypeTeam,
			GroupId:    g.Id,
		})
		require.Nil(t, err)
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
	group3, err := ss.Group().Create(&model.Group{
		Name:        model.NewId(),
		DisplayName: "group-3",
		RemoteId:    model.NewId(),
		Source:      model.GroupSourceLdap,
	})
	require.Nil(t, err)

	// And associate it to Team2
	_, err = ss.Group().CreateGroupSyncable(&model.GroupSyncable{
		AutoAdd:    true,
		SyncableId: team2.Id,
		Type:       model.GroupSyncableTypeTeam,
		GroupId:    group3.Id,
	})
	require.Nil(t, err)

	// add members
	u1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user1, err := ss.User().Save(u1)
	require.Nil(t, err)

	u2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user2, err := ss.User().Save(u2)
	require.Nil(t, err)

	_, err = ss.Group().UpsertMember(group1.Id, user1.Id)
	require.Nil(t, err)

	_, err = ss.Group().UpsertMember(group1.Id, user2.Id)
	require.Nil(t, err)

	user2.DeleteAt = 1
	_, err = ss.User().Update(user2, true)
	require.Nil(t, err)

	group1WithMemberCount := *group1
	group1WithMemberCount.MemberCount = model.NewInt(1)

	group2WithMemberCount := *group2
	group2WithMemberCount.MemberCount = model.NewInt(0)

	group1WSA := &model.GroupWithSchemeAdmin{Group: *group1, SchemeAdmin: model.NewBool(false)}
	group2WSA := &model.GroupWithSchemeAdmin{Group: *group2, SchemeAdmin: model.NewBool(false)}
	group3WSA := &model.GroupWithSchemeAdmin{Group: *group3, SchemeAdmin: model.NewBool(false)}

	testCases := []struct {
		Name       string
		TeamId     string
		Page       int
		PerPage    int
		Opts       model.GroupSearchOpts
		Result     []*model.GroupWithSchemeAdmin
		TotalCount *int64
	}{
		{
			Name:       "Get the two Groups for Team1",
			TeamId:     team1.Id,
			Opts:       model.GroupSearchOpts{},
			Page:       0,
			PerPage:    60,
			Result:     []*model.GroupWithSchemeAdmin{group1WSA, group2WSA},
			TotalCount: model.NewInt64(2),
		},
		{
			Name:    "Get first Group for Team1 with page 0 with 1 element",
			TeamId:  team1.Id,
			Opts:    model.GroupSearchOpts{},
			Page:    0,
			PerPage: 1,
			Result:  []*model.GroupWithSchemeAdmin{group1WSA},
		},
		{
			Name:    "Get second Group for Team1 with page 1 with 1 element",
			TeamId:  team1.Id,
			Opts:    model.GroupSearchOpts{},
			Page:    1,
			PerPage: 1,
			Result:  []*model.GroupWithSchemeAdmin{group2WSA},
		},
		{
			Name:       "Get third Group for Team2",
			TeamId:     team2.Id,
			Opts:       model.GroupSearchOpts{},
			Page:       0,
			PerPage:    60,
			Result:     []*model.GroupWithSchemeAdmin{group3WSA},
			TotalCount: model.NewInt64(1),
		},
		{
			Name:       "Get empty Groups for a fake id",
			TeamId:     model.NewId(),
			Opts:       model.GroupSearchOpts{},
			Page:       0,
			PerPage:    60,
			Result:     []*model.GroupWithSchemeAdmin{},
			TotalCount: model.NewInt64(0),
		},
		{
			Name:       "Get group matching name",
			TeamId:     team1.Id,
			Opts:       model.GroupSearchOpts{Q: string([]rune(group1.Name)[2:10])}, // very low change of a name collision
			Page:       0,
			PerPage:    100,
			Result:     []*model.GroupWithSchemeAdmin{group1WSA},
			TotalCount: model.NewInt64(1),
		},
		{
			Name:       "Get group matching display name",
			TeamId:     team1.Id,
			Opts:       model.GroupSearchOpts{Q: "rouP-1"},
			Page:       0,
			PerPage:    100,
			Result:     []*model.GroupWithSchemeAdmin{group1WSA},
			TotalCount: model.NewInt64(1),
		},
		{
			Name:       "Get group matching multiple display names",
			TeamId:     team1.Id,
			Opts:       model.GroupSearchOpts{Q: "roUp-"},
			Page:       0,
			PerPage:    100,
			Result:     []*model.GroupWithSchemeAdmin{group1WSA, group2WSA},
			TotalCount: model.NewInt64(2),
		},
		{
			Name:    "Include member counts",
			TeamId:  team1.Id,
			Opts:    model.GroupSearchOpts{IncludeMemberCount: true},
			Page:    0,
			PerPage: 2,
			Result: []*model.GroupWithSchemeAdmin{
				{Group: group1WithMemberCount, SchemeAdmin: model.NewBool(false)},
				{Group: group2WithMemberCount, SchemeAdmin: model.NewBool(false)},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			if tc.Opts.PageOpts == nil {
				tc.Opts.PageOpts = &model.PageOpts{}
			}
			tc.Opts.PageOpts.Page = tc.Page
			tc.Opts.PageOpts.PerPage = tc.PerPage
			groups, err := ss.Group().GetGroupsByTeam(tc.TeamId, tc.Opts)
			require.Nil(t, err)
			require.ElementsMatch(t, tc.Result, groups)
			if tc.TotalCount != nil {
				var count int64
				count, err = ss.Group().CountGroupsByTeam(tc.TeamId, tc.Opts)
				require.Nil(t, err)
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
	channel1, err = ss.Channel().Save(channel1, 9999)
	require.Nil(t, err)

	// Create Groups 1 and 2
	group1, err := ss.Group().Create(&model.Group{
		Name:        model.NewId(),
		DisplayName: "group-1",
		RemoteId:    model.NewId(),
		Source:      model.GroupSourceLdap,
	})
	require.Nil(t, err)

	group2, err := ss.Group().Create(&model.Group{
		Name:        model.NewId() + "-group-2",
		DisplayName: "group-2",
		RemoteId:    model.NewId(),
		Source:      model.GroupSourceLdap,
	})
	require.Nil(t, err)

	// And associate them with Team1
	for _, g := range []*model.Group{group1, group2} {
		_, err = ss.Group().CreateGroupSyncable(&model.GroupSyncable{
			AutoAdd:    true,
			SyncableId: team1.Id,
			Type:       model.GroupSyncableTypeTeam,
			GroupId:    g.Id,
		})
		require.Nil(t, err)
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
	channel2, err = ss.Channel().Save(channel2, 9999)
	require.Nil(t, err)

	// Create Group3
	group3, err := ss.Group().Create(&model.Group{
		Name:        model.NewId() + "-group-3",
		DisplayName: "group-3",
		RemoteId:    model.NewId(),
		Source:      model.GroupSourceLdap,
	})
	require.Nil(t, err)

	// And associate it to Team2
	_, err = ss.Group().CreateGroupSyncable(&model.GroupSyncable{
		AutoAdd:    true,
		SyncableId: team2.Id,
		Type:       model.GroupSyncableTypeTeam,
		GroupId:    group3.Id,
	})
	require.Nil(t, err)

	// And associate Group1 to Channel2
	_, err = ss.Group().CreateGroupSyncable(&model.GroupSyncable{
		AutoAdd:    true,
		SyncableId: channel2.Id,
		Type:       model.GroupSyncableTypeChannel,
		GroupId:    group1.Id,
	})
	require.Nil(t, err)

	// And associate Group2 and Group3 to Channel1
	for _, g := range []*model.Group{group2, group3} {
		_, err = ss.Group().CreateGroupSyncable(&model.GroupSyncable{
			AutoAdd:    true,
			SyncableId: channel1.Id,
			Type:       model.GroupSyncableTypeChannel,
			GroupId:    g.Id,
		})
		require.Nil(t, err)
	}

	// add members
	u1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user1, err := ss.User().Save(u1)
	require.Nil(t, err)

	u2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user2, err := ss.User().Save(u2)
	require.Nil(t, err)

	_, err = ss.Group().UpsertMember(group1.Id, user1.Id)
	require.Nil(t, err)

	_, err = ss.Group().UpsertMember(group1.Id, user2.Id)
	require.Nil(t, err)

	user2.DeleteAt = 1
	ss.User().Update(user2, true)

	group2NameSubstring := "group-2"

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
					if !strings.Contains(g.Name, group2NameSubstring) && !strings.Contains(g.DisplayName, group2NameSubstring) {
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
			PerPage: 100,
			Resultf: func(groups []*model.Group) bool {
				for _, g := range groups {
					if g.MemberCount == nil {
						return false
					}
					if g.Id == group1.Id && *g.MemberCount != 1 {
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
			groups, err := ss.Group().GetGroups(tc.Page, tc.PerPage, tc.Opts)
			require.Nil(t, err)
			require.True(t, tc.Resultf(groups))
		})
	}
}

func testTeamMembersMinusGroupMembers(t *testing.T, ss store.Store) {
	const numberOfGroups = 3
	const numberOfUsers = 4

	groups := []*model.Group{}
	users := []*model.User{}

	team := &model.Team{
		DisplayName:      model.NewId(),
		Description:      model.NewId(),
		CompanyName:      model.NewId(),
		AllowOpenInvite:  false,
		InviteId:         model.NewId(),
		Name:             model.NewId(),
		Email:            model.NewId() + "@simulator.amazonses.com",
		Type:             model.TEAM_OPEN,
		GroupConstrained: model.NewBool(true),
	}
	team, err := ss.Team().Save(team)
	require.Nil(t, err)

	for i := 0; i < numberOfUsers; i++ {
		user := &model.User{
			Email:    MakeEmail(),
			Username: fmt.Sprintf("%d_%s", i, model.NewId()),
		}
		user, err = ss.User().Save(user)
		require.Nil(t, err)
		users = append(users, user)

		trueOrFalse := int(math.Mod(float64(i), 2)) == 0
		_, err = ss.Team().SaveMember(&model.TeamMember{TeamId: team.Id, UserId: user.Id, SchemeUser: trueOrFalse, SchemeAdmin: !trueOrFalse}, 999)
		require.Nil(t, err)
	}

	// Extra user outside of the group member users.
	user := &model.User{
		Email:    MakeEmail(),
		Username: "99_" + model.NewId(),
	}
	user, err = ss.User().Save(user)
	require.Nil(t, err)
	users = append(users, user)
	_, err = ss.Team().SaveMember(&model.TeamMember{TeamId: team.Id, UserId: user.Id, SchemeUser: true, SchemeAdmin: false}, 999)
	require.Nil(t, err)

	for i := 0; i < numberOfGroups; i++ {
		group := &model.Group{
			Name:        fmt.Sprintf("n_%d_%s", i, model.NewId()),
			DisplayName: model.NewId(),
			Source:      model.GroupSourceLdap,
			Description: model.NewId(),
			RemoteId:    model.NewId(),
		}
		group, err := ss.Group().Create(group)
		require.Nil(t, err)
		groups = append(groups, group)
	}

	sort.Slice(users, func(i, j int) bool {
		return users[i].Username < users[j].Username
	})

	// Add even users to even group, and the inverse
	for i := 0; i < numberOfUsers; i++ {
		groupIndex := int(math.Mod(float64(i), 2))
		_, err := ss.Group().UpsertMember(groups[groupIndex].Id, users[i].Id)
		require.Nil(t, err)

		// Add everyone to group 2
		_, err = ss.Group().UpsertMember(groups[numberOfGroups-1].Id, users[i].Id)
		require.Nil(t, err)
	}

	testCases := map[string]struct {
		expectedUserIDs    []string
		expectedTotalCount int64
		groupIDs           []string
		page               int
		perPage            int
		setup              func()
		teardown           func()
	}{
		"No group IDs, all members": {
			expectedUserIDs:    []string{users[0].Id, users[1].Id, users[2].Id, users[3].Id, user.Id},
			expectedTotalCount: numberOfUsers + 1,
			groupIDs:           []string{},
			page:               0,
			perPage:            100,
		},
		"All members, page 1": {
			expectedUserIDs:    []string{users[0].Id, users[1].Id, users[2].Id},
			expectedTotalCount: numberOfUsers + 1,
			groupIDs:           []string{},
			page:               0,
			perPage:            3,
		},
		"All members, page 2": {
			expectedUserIDs:    []string{users[3].Id, users[4].Id},
			expectedTotalCount: numberOfUsers + 1,
			groupIDs:           []string{},
			page:               1,
			perPage:            3,
		},
		"Group 1, even users would be removed": {
			expectedUserIDs:    []string{users[0].Id, users[2].Id, users[4].Id},
			expectedTotalCount: 3,
			groupIDs:           []string{groups[1].Id},
			page:               0,
			perPage:            100,
		},
		"Group 0, odd users would be removed": {
			expectedUserIDs:    []string{users[1].Id, users[3].Id, users[4].Id},
			expectedTotalCount: 3,
			groupIDs:           []string{groups[0].Id},
			page:               0,
			perPage:            100,
		},
		"All groups, no users would be removed": {
			expectedUserIDs:    []string{users[4].Id},
			expectedTotalCount: 1,
			groupIDs:           []string{groups[0].Id, groups[1].Id},
			page:               0,
			perPage:            100,
		},
	}

	mapUserIDs := func(users []*model.UserWithGroups) []string {
		ids := []string{}
		for _, user := range users {
			ids = append(ids, user.Id)
		}
		return ids
	}

	for tcName, tc := range testCases {
		t.Run(tcName, func(t *testing.T) {
			if tc.setup != nil {
				tc.setup()
			}

			if tc.teardown != nil {
				defer tc.teardown()
			}

			actual, err := ss.Group().TeamMembersMinusGroupMembers(team.Id, tc.groupIDs, tc.page, tc.perPage)
			require.Nil(t, err)
			require.ElementsMatch(t, tc.expectedUserIDs, mapUserIDs(actual))

			actualCount, err := ss.Group().CountTeamMembersMinusGroupMembers(team.Id, tc.groupIDs)
			require.Nil(t, err)
			require.Equal(t, tc.expectedTotalCount, actualCount)
		})
	}
}

func testChannelMembersMinusGroupMembers(t *testing.T, ss store.Store) {
	const numberOfGroups = 3
	const numberOfUsers = 4

	groups := []*model.Group{}
	users := []*model.User{}

	channel := &model.Channel{
		TeamId:           model.NewId(),
		DisplayName:      "A Name",
		Name:             model.NewId(),
		Type:             model.CHANNEL_PRIVATE,
		GroupConstrained: model.NewBool(true),
	}
	channel, err := ss.Channel().Save(channel, 9999)
	require.Nil(t, err)

	for i := 0; i < numberOfUsers; i++ {
		user := &model.User{
			Email:    MakeEmail(),
			Username: fmt.Sprintf("%d_%s", i, model.NewId()),
		}
		user, err = ss.User().Save(user)
		require.Nil(t, err)
		users = append(users, user)

		trueOrFalse := int(math.Mod(float64(i), 2)) == 0
		_, err = ss.Channel().SaveMember(&model.ChannelMember{
			ChannelId:   channel.Id,
			UserId:      user.Id,
			SchemeUser:  trueOrFalse,
			SchemeAdmin: !trueOrFalse,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		})
		require.Nil(t, err)
	}

	// Extra user outside of the group member users.
	user, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "99_" + model.NewId(),
	})
	require.Nil(t, err)
	users = append(users, user)
	_, err = ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   channel.Id,
		UserId:      user.Id,
		SchemeUser:  true,
		SchemeAdmin: false,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.Nil(t, err)

	for i := 0; i < numberOfGroups; i++ {
		group := &model.Group{
			Name:        fmt.Sprintf("n_%d_%s", i, model.NewId()),
			DisplayName: model.NewId(),
			Source:      model.GroupSourceLdap,
			Description: model.NewId(),
			RemoteId:    model.NewId(),
		}
		group, err := ss.Group().Create(group)
		require.Nil(t, err)
		groups = append(groups, group)
	}

	sort.Slice(users, func(i, j int) bool {
		return users[i].Username < users[j].Username
	})

	// Add even users to even group, and the inverse
	for i := 0; i < numberOfUsers; i++ {
		groupIndex := int(math.Mod(float64(i), 2))
		_, err := ss.Group().UpsertMember(groups[groupIndex].Id, users[i].Id)
		require.Nil(t, err)

		// Add everyone to group 2
		_, err = ss.Group().UpsertMember(groups[numberOfGroups-1].Id, users[i].Id)
		require.Nil(t, err)
	}

	testCases := map[string]struct {
		expectedUserIDs    []string
		expectedTotalCount int64
		groupIDs           []string
		page               int
		perPage            int
		setup              func()
		teardown           func()
	}{
		"No group IDs, all members": {
			expectedUserIDs:    []string{users[0].Id, users[1].Id, users[2].Id, users[3].Id, users[4].Id},
			expectedTotalCount: numberOfUsers + 1,
			groupIDs:           []string{},
			page:               0,
			perPage:            100,
		},
		"All members, page 1": {
			expectedUserIDs:    []string{users[0].Id, users[1].Id, users[2].Id},
			expectedTotalCount: numberOfUsers + 1,
			groupIDs:           []string{},
			page:               0,
			perPage:            3,
		},
		"All members, page 2": {
			expectedUserIDs:    []string{users[3].Id, users[4].Id},
			expectedTotalCount: numberOfUsers + 1,
			groupIDs:           []string{},
			page:               1,
			perPage:            3,
		},
		"Group 1, even users would be removed": {
			expectedUserIDs:    []string{users[0].Id, users[2].Id, users[4].Id},
			expectedTotalCount: 3,
			groupIDs:           []string{groups[1].Id},
			page:               0,
			perPage:            100,
		},
		"Group 0, odd users would be removed": {
			expectedUserIDs:    []string{users[1].Id, users[3].Id, users[4].Id},
			expectedTotalCount: 3,
			groupIDs:           []string{groups[0].Id},
			page:               0,
			perPage:            100,
		},
		"All groups, no users would be removed": {
			expectedUserIDs:    []string{users[4].Id},
			expectedTotalCount: 1,
			groupIDs:           []string{groups[0].Id, groups[1].Id},
			page:               0,
			perPage:            100,
		},
	}

	mapUserIDs := func(users []*model.UserWithGroups) []string {
		ids := []string{}
		for _, user := range users {
			ids = append(ids, user.Id)
		}
		return ids
	}

	for tcName, tc := range testCases {
		t.Run(tcName, func(t *testing.T) {
			if tc.setup != nil {
				tc.setup()
			}

			if tc.teardown != nil {
				defer tc.teardown()
			}

			actual, err := ss.Group().ChannelMembersMinusGroupMembers(channel.Id, tc.groupIDs, tc.page, tc.perPage)
			require.Nil(t, err)
			require.ElementsMatch(t, tc.expectedUserIDs, mapUserIDs(actual))

			actualCount, err := ss.Group().CountChannelMembersMinusGroupMembers(channel.Id, tc.groupIDs)
			require.Nil(t, err)
			require.Equal(t, tc.expectedTotalCount, actualCount)
		})
	}
}

func groupTestGetMemberCount(t *testing.T, ss store.Store) {
	group := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		Description: model.NewId(),
		RemoteId:    model.NewId(),
	}
	group, err := ss.Group().Create(group)
	require.Nil(t, err)

	var user *model.User

	for i := 0; i < 2; i++ {
		user = &model.User{
			Email:    MakeEmail(),
			Username: fmt.Sprintf("%d_%s", i, model.NewId()),
		}
		user, err = ss.User().Save(user)
		require.Nil(t, err)

		_, err = ss.Group().UpsertMember(group.Id, user.Id)
		require.Nil(t, err)
	}

	count, err := ss.Group().GetMemberCount(group.Id)
	require.Nil(t, err)
	require.Equal(t, int64(2), count)

	user.DeleteAt = 1
	_, err = ss.User().Update(user, true)
	require.Nil(t, err)

	count, err = ss.Group().GetMemberCount(group.Id)
	require.Nil(t, err)
	require.Equal(t, int64(1), count)
}

func groupTestAdminRoleGroupsForSyncableMemberChannel(t *testing.T, ss store.Store) {
	user := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user, err := ss.User().Save(user)
	require.Nil(t, err)

	group1 := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		Description: model.NewId(),
		RemoteId:    model.NewId(),
	}
	group1, err = ss.Group().Create(group1)
	require.Nil(t, err)

	_, err = ss.Group().UpsertMember(group1.Id, user.Id)
	require.Nil(t, err)

	group2 := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		Description: model.NewId(),
		RemoteId:    model.NewId(),
	}
	group2, err = ss.Group().Create(group2)
	require.Nil(t, err)

	_, err = ss.Group().UpsertMember(group2.Id, user.Id)
	require.Nil(t, err)

	channel := &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "A Name",
		Name:        model.NewId(),
		Type:        model.CHANNEL_OPEN,
	}
	channel, err = ss.Channel().Save(channel, 9999)
	require.Nil(t, err)

	_, err = ss.Group().CreateGroupSyncable(&model.GroupSyncable{
		AutoAdd:     true,
		SyncableId:  channel.Id,
		Type:        model.GroupSyncableTypeChannel,
		GroupId:     group1.Id,
		SchemeAdmin: true,
	})
	require.Nil(t, err)

	groupSyncable2, err := ss.Group().CreateGroupSyncable(&model.GroupSyncable{
		AutoAdd:    true,
		SyncableId: channel.Id,
		Type:       model.GroupSyncableTypeChannel,
		GroupId:    group2.Id,
	})
	require.Nil(t, err)

	// User is a member of both groups but only one is SchmeAdmin: true
	actualGroupIDs, err := ss.Group().AdminRoleGroupsForSyncableMember(user.Id, channel.Id, model.GroupSyncableTypeChannel)
	require.Nil(t, err)
	require.ElementsMatch(t, []string{group1.Id}, actualGroupIDs)

	// Update the second group syncable to be SchemeAdmin: true and both groups should be returned
	groupSyncable2.SchemeAdmin = true
	_, err = ss.Group().UpdateGroupSyncable(groupSyncable2)
	require.Nil(t, err)
	actualGroupIDs, err = ss.Group().AdminRoleGroupsForSyncableMember(user.Id, channel.Id, model.GroupSyncableTypeChannel)
	require.Nil(t, err)
	require.ElementsMatch(t, []string{group1.Id, group2.Id}, actualGroupIDs)

	// Deleting membership from group should stop the group from being returned
	_, err = ss.Group().DeleteMember(group1.Id, user.Id)
	require.Nil(t, err)
	actualGroupIDs, err = ss.Group().AdminRoleGroupsForSyncableMember(user.Id, channel.Id, model.GroupSyncableTypeChannel)
	require.Nil(t, err)
	require.ElementsMatch(t, []string{group2.Id}, actualGroupIDs)

	// Deleting group syncable should stop it being returned
	_, err = ss.Group().DeleteGroupSyncable(group2.Id, channel.Id, model.GroupSyncableTypeChannel)
	require.Nil(t, err)
	actualGroupIDs, err = ss.Group().AdminRoleGroupsForSyncableMember(user.Id, channel.Id, model.GroupSyncableTypeChannel)
	require.Nil(t, err)
	require.ElementsMatch(t, []string{}, actualGroupIDs)
}

func groupTestAdminRoleGroupsForSyncableMemberTeam(t *testing.T, ss store.Store) {
	user := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user, err := ss.User().Save(user)
	require.Nil(t, err)

	group1 := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		Description: model.NewId(),
		RemoteId:    model.NewId(),
	}
	group1, err = ss.Group().Create(group1)
	require.Nil(t, err)

	_, err = ss.Group().UpsertMember(group1.Id, user.Id)
	require.Nil(t, err)

	group2 := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		Description: model.NewId(),
		RemoteId:    model.NewId(),
	}
	group2, err = ss.Group().Create(group2)
	require.Nil(t, err)

	_, err = ss.Group().UpsertMember(group2.Id, user.Id)
	require.Nil(t, err)

	team := &model.Team{
		DisplayName: "A Name",
		Name:        model.NewId(),
		Type:        model.CHANNEL_OPEN,
	}
	team, err = ss.Team().Save(team)
	require.Nil(t, err)

	_, err = ss.Group().CreateGroupSyncable(&model.GroupSyncable{
		AutoAdd:     true,
		SyncableId:  team.Id,
		Type:        model.GroupSyncableTypeTeam,
		GroupId:     group1.Id,
		SchemeAdmin: true,
	})
	require.Nil(t, err)

	groupSyncable2, err := ss.Group().CreateGroupSyncable(&model.GroupSyncable{
		AutoAdd:    true,
		SyncableId: team.Id,
		Type:       model.GroupSyncableTypeTeam,
		GroupId:    group2.Id,
	})
	require.Nil(t, err)

	// User is a member of both groups but only one is SchmeAdmin: true
	actualGroupIDs, err := ss.Group().AdminRoleGroupsForSyncableMember(user.Id, team.Id, model.GroupSyncableTypeTeam)
	require.Nil(t, err)
	require.ElementsMatch(t, []string{group1.Id}, actualGroupIDs)

	// Update the second group syncable to be SchemeAdmin: true and both groups should be returned
	groupSyncable2.SchemeAdmin = true
	_, err = ss.Group().UpdateGroupSyncable(groupSyncable2)
	require.Nil(t, err)
	actualGroupIDs, err = ss.Group().AdminRoleGroupsForSyncableMember(user.Id, team.Id, model.GroupSyncableTypeTeam)
	require.Nil(t, err)
	require.ElementsMatch(t, []string{group1.Id, group2.Id}, actualGroupIDs)

	// Deleting membership from group should stop the group from being returned
	_, err = ss.Group().DeleteMember(group1.Id, user.Id)
	require.Nil(t, err)
	actualGroupIDs, err = ss.Group().AdminRoleGroupsForSyncableMember(user.Id, team.Id, model.GroupSyncableTypeTeam)
	require.Nil(t, err)
	require.ElementsMatch(t, []string{group2.Id}, actualGroupIDs)

	// Deleting group syncable should stop it being returned
	_, err = ss.Group().DeleteGroupSyncable(group2.Id, team.Id, model.GroupSyncableTypeTeam)
	require.Nil(t, err)
	actualGroupIDs, err = ss.Group().AdminRoleGroupsForSyncableMember(user.Id, team.Id, model.GroupSyncableTypeTeam)
	require.Nil(t, err)
	require.ElementsMatch(t, []string{}, actualGroupIDs)
}

func groupTestPermittedSyncableAdminsTeam(t *testing.T, ss store.Store) {
	user1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user1, err := ss.User().Save(user1)
	require.Nil(t, err)

	user2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user2, err = ss.User().Save(user2)
	require.Nil(t, err)

	user3 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user3, err = ss.User().Save(user3)
	require.Nil(t, err)

	group1 := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		Description: model.NewId(),
		RemoteId:    model.NewId(),
	}
	group1, err = ss.Group().Create(group1)
	require.Nil(t, err)

	_, err = ss.Group().UpsertMember(group1.Id, user1.Id)
	require.Nil(t, err)
	_, err = ss.Group().UpsertMember(group1.Id, user2.Id)
	require.Nil(t, err)

	group2 := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		Description: model.NewId(),
		RemoteId:    model.NewId(),
	}
	group2, err = ss.Group().Create(group2)
	require.Nil(t, err)

	_, err = ss.Group().UpsertMember(group2.Id, user3.Id)
	require.Nil(t, err)

	team := &model.Team{
		DisplayName: "A Name",
		Name:        model.NewId(),
		Type:        model.CHANNEL_OPEN,
	}
	team, err = ss.Team().Save(team)
	require.Nil(t, err)

	_, err = ss.Group().CreateGroupSyncable(&model.GroupSyncable{
		AutoAdd:     true,
		SyncableId:  team.Id,
		Type:        model.GroupSyncableTypeTeam,
		GroupId:     group1.Id,
		SchemeAdmin: true,
	})
	require.Nil(t, err)

	groupSyncable2, err := ss.Group().CreateGroupSyncable(&model.GroupSyncable{
		AutoAdd:     true,
		SyncableId:  team.Id,
		Type:        model.GroupSyncableTypeTeam,
		GroupId:     group2.Id,
		SchemeAdmin: false,
	})
	require.Nil(t, err)

	// group 1's users are returned because groupsyncable 2 has SchemeAdmin false.
	actualUserIDs, err := ss.Group().PermittedSyncableAdmins(team.Id, model.GroupSyncableTypeTeam)
	require.Nil(t, err)
	require.ElementsMatch(t, []string{user1.Id, user2.Id}, actualUserIDs)

	// update groupsyncable 2 to be SchemeAdmin true
	groupSyncable2.SchemeAdmin = true
	_, err = ss.Group().UpdateGroupSyncable(groupSyncable2)
	require.Nil(t, err)

	// group 2's users are now included in return value
	actualUserIDs, err = ss.Group().PermittedSyncableAdmins(team.Id, model.GroupSyncableTypeTeam)
	require.Nil(t, err)
	require.ElementsMatch(t, []string{user1.Id, user2.Id, user3.Id}, actualUserIDs)

	// deleted group member should not be included
	ss.Group().DeleteMember(group1.Id, user2.Id)
	require.Nil(t, err)
	actualUserIDs, err = ss.Group().PermittedSyncableAdmins(team.Id, model.GroupSyncableTypeTeam)
	require.Nil(t, err)
	require.ElementsMatch(t, []string{user1.Id, user3.Id}, actualUserIDs)

	// deleted group syncable no longer includes group members
	_, err = ss.Group().DeleteGroupSyncable(group1.Id, team.Id, model.GroupSyncableTypeTeam)
	require.Nil(t, err)
	actualUserIDs, err = ss.Group().PermittedSyncableAdmins(team.Id, model.GroupSyncableTypeTeam)
	require.Nil(t, err)
	require.ElementsMatch(t, []string{user3.Id}, actualUserIDs)
}

func groupTestPermittedSyncableAdminsChannel(t *testing.T, ss store.Store) {
	user1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user1, err := ss.User().Save(user1)
	require.Nil(t, err)

	user2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user2, err = ss.User().Save(user2)
	require.Nil(t, err)

	user3 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user3, err = ss.User().Save(user3)
	require.Nil(t, err)

	group1 := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		Description: model.NewId(),
		RemoteId:    model.NewId(),
	}
	group1, err = ss.Group().Create(group1)
	require.Nil(t, err)

	_, err = ss.Group().UpsertMember(group1.Id, user1.Id)
	require.Nil(t, err)
	_, err = ss.Group().UpsertMember(group1.Id, user2.Id)
	require.Nil(t, err)

	group2 := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		Description: model.NewId(),
		RemoteId:    model.NewId(),
	}
	group2, err = ss.Group().Create(group2)
	require.Nil(t, err)

	_, err = ss.Group().UpsertMember(group2.Id, user3.Id)
	require.Nil(t, err)

	channel := &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "A Name",
		Name:        model.NewId(),
		Type:        model.CHANNEL_OPEN,
	}
	channel, err = ss.Channel().Save(channel, 9999)
	require.Nil(t, err)

	_, err = ss.Group().CreateGroupSyncable(&model.GroupSyncable{
		AutoAdd:     true,
		SyncableId:  channel.Id,
		Type:        model.GroupSyncableTypeChannel,
		GroupId:     group1.Id,
		SchemeAdmin: true,
	})
	require.Nil(t, err)

	groupSyncable2, err := ss.Group().CreateGroupSyncable(&model.GroupSyncable{
		AutoAdd:     true,
		SyncableId:  channel.Id,
		Type:        model.GroupSyncableTypeChannel,
		GroupId:     group2.Id,
		SchemeAdmin: false,
	})
	require.Nil(t, err)

	// group 1's users are returned because groupsyncable 2 has SchemeAdmin false.
	actualUserIDs, err := ss.Group().PermittedSyncableAdmins(channel.Id, model.GroupSyncableTypeChannel)
	require.Nil(t, err)
	require.ElementsMatch(t, []string{user1.Id, user2.Id}, actualUserIDs)

	// update groupsyncable 2 to be SchemeAdmin true
	groupSyncable2.SchemeAdmin = true
	_, err = ss.Group().UpdateGroupSyncable(groupSyncable2)
	require.Nil(t, err)

	// group 2's users are now included in return value
	actualUserIDs, err = ss.Group().PermittedSyncableAdmins(channel.Id, model.GroupSyncableTypeChannel)
	require.Nil(t, err)
	require.ElementsMatch(t, []string{user1.Id, user2.Id, user3.Id}, actualUserIDs)

	// deleted group member should not be included
	ss.Group().DeleteMember(group1.Id, user2.Id)
	require.Nil(t, err)
	actualUserIDs, err = ss.Group().PermittedSyncableAdmins(channel.Id, model.GroupSyncableTypeChannel)
	require.Nil(t, err)
	require.ElementsMatch(t, []string{user1.Id, user3.Id}, actualUserIDs)

	// deleted group syncable no longer includes group members
	_, err = ss.Group().DeleteGroupSyncable(group1.Id, channel.Id, model.GroupSyncableTypeChannel)
	require.Nil(t, err)
	actualUserIDs, err = ss.Group().PermittedSyncableAdmins(channel.Id, model.GroupSyncableTypeChannel)
	require.Nil(t, err)
	require.ElementsMatch(t, []string{user3.Id}, actualUserIDs)
}

func groupTestpUpdateMembersRoleTeam(t *testing.T, ss store.Store) {
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

	user1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user1, err = ss.User().Save(user1)
	require.Nil(t, err)

	user2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user2, err = ss.User().Save(user2)
	require.Nil(t, err)

	user3 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user3, err = ss.User().Save(user3)
	require.Nil(t, err)

	user4 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user4, err = ss.User().Save(user4)
	require.Nil(t, err)

	for _, user := range []*model.User{user1, user2, user3} {
		_, err = ss.Team().SaveMember(&model.TeamMember{TeamId: team.Id, UserId: user.Id}, 9999)
		require.Nil(t, err)
	}

	_, err = ss.Team().SaveMember(&model.TeamMember{TeamId: team.Id, UserId: user4.Id, SchemeGuest: true}, 9999)
	require.Nil(t, err)

	tests := []struct {
		testName               string
		inUserIDs              []string
		targetSchemeAdminValue bool
	}{
		{
			"Given users are admins",
			[]string{user1.Id, user2.Id},
			true,
		},
		{
			"Given users are members",
			[]string{user2.Id},
			false,
		},
		{
			"Non-given users are admins",
			[]string{user2.Id},
			false,
		},
		{
			"Non-given users are members",
			[]string{user2.Id},
			false,
		},
	}

	includes := func(list []string, item string) bool {
		for _, it := range list {
			if it == item {
				return true
			}
		}
		return false
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			err = ss.Team().UpdateMembersRole(team.Id, tt.inUserIDs)
			require.Nil(t, err)

			members, err := ss.Team().GetMembers(team.Id, 0, 100, nil)
			require.Nil(t, err)
			require.GreaterOrEqual(t, len(members), 4) // sanity check for team membership

			for _, member := range members {
				if includes(tt.inUserIDs, member.UserId) {
					require.True(t, member.SchemeAdmin)
				} else {
					require.False(t, member.SchemeAdmin)
				}

				// Ensure guest account never changes.
				if member.UserId == user4.Id {
					require.False(t, member.SchemeUser)
					require.False(t, member.SchemeAdmin)
					require.True(t, member.SchemeGuest)
				}
			}
		})
	}
}

func groupTestpUpdateMembersRoleChannel(t *testing.T, ss store.Store) {
	channel := &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "A Name",
		Name:        model.NewId(),
		Type:        model.CHANNEL_OPEN, // Query does not look at type so this shouldn't matter.
	}
	channel, err := ss.Channel().Save(channel, 9999)
	require.Nil(t, err)

	user1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user1, err = ss.User().Save(user1)
	require.Nil(t, err)

	user2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user2, err = ss.User().Save(user2)
	require.Nil(t, err)

	user3 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user3, err = ss.User().Save(user3)
	require.Nil(t, err)

	user4 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user4, err = ss.User().Save(user4)
	require.Nil(t, err)

	for _, user := range []*model.User{user1, user2, user3} {
		_, err = ss.Channel().SaveMember(&model.ChannelMember{
			ChannelId:   channel.Id,
			UserId:      user.Id,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		})
		require.Nil(t, err)
	}

	_, err = ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   channel.Id,
		UserId:      user4.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
		SchemeGuest: true,
	})
	require.Nil(t, err)

	tests := []struct {
		testName               string
		inUserIDs              []string
		targetSchemeAdminValue bool
	}{
		{
			"Given users are admins",
			[]string{user1.Id, user2.Id},
			true,
		},
		{
			"Given users are members",
			[]string{user2.Id},
			false,
		},
		{
			"Non-given users are admins",
			[]string{user2.Id},
			false,
		},
		{
			"Non-given users are members",
			[]string{user2.Id},
			false,
		},
	}

	includes := func(list []string, item string) bool {
		for _, it := range list {
			if it == item {
				return true
			}
		}
		return false
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			err = ss.Channel().UpdateMembersRole(channel.Id, tt.inUserIDs)
			require.Nil(t, err)

			members, err := ss.Channel().GetMembers(channel.Id, 0, 100)
			require.Nil(t, err)

			require.GreaterOrEqual(t, len(*members), 4) // sanity check for channel membership

			for _, member := range *members {
				if includes(tt.inUserIDs, member.UserId) {
					require.True(t, member.SchemeAdmin)
				} else {
					require.False(t, member.SchemeAdmin)
				}

				// Ensure guest account never changes.
				if member.UserId == user4.Id {
					require.False(t, member.SchemeUser)
					require.False(t, member.SchemeAdmin)
					require.True(t, member.SchemeGuest)
				}
			}
		})
	}
}
