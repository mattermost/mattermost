// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"strings"
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/stretchr/testify/assert"
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

	t.Run("PendingAutoAddTeamMembers", func(t *testing.T) { testPendingAutoAddTeamMembers(t, ss) })
	t.Run("PendingAutoAddChannelMembers", func(t *testing.T) { testPendingAutoAddChannelMembers(t, ss) })
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
	assert.Nil(t, res1.Err)
	d1 := res1.Data.(*model.Group)
	assert.Len(t, d1.Id, 26)
	assert.Equal(t, g1.Name, d1.Name)
	assert.Equal(t, g1.DisplayName, d1.DisplayName)
	assert.Equal(t, g1.Description, d1.Description)
	assert.Equal(t, g1.RemoteId, d1.RemoteId)
	assert.NotZero(t, d1.CreateAt)
	assert.NotZero(t, d1.UpdateAt)
	assert.Zero(t, d1.DeleteAt)

	// Requires name and display name
	g2 := &model.Group{
		Name:        "",
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewId(),
	}
	res2 := <-ss.Group().Create(g2)
	assert.Nil(t, res2.Data)
	assert.NotNil(t, res2.Err)
	assert.Equal(t, res2.Err.Id, "model.group.name.app_error")

	g2.Name = model.NewId()
	g2.DisplayName = ""
	res3 := <-ss.Group().Create(g2)
	assert.Nil(t, res3.Data)
	assert.NotNil(t, res3.Err)
	assert.Equal(t, res3.Err.Id, "model.group.display_name.app_error")

	// Won't accept a duplicate name
	g4 := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewId(),
	}
	res5 := <-ss.Group().Create(g4)
	assert.Nil(t, res5.Err)
	g4b := &model.Group{
		Name:        g4.Name,
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewId(),
	}
	res5b := <-ss.Group().Create(g4b)
	assert.Nil(t, res5b.Data)
	assert.Equal(t, res5b.Err.Id, "store.sql_group.unique_constraint")

	// Fields cannot be greater than max values
	g5 := &model.Group{
		Name:        strings.Repeat("x", model.GroupNameMaxLength),
		DisplayName: strings.Repeat("x", model.GroupDisplayNameMaxLength),
		Description: strings.Repeat("x", model.GroupDescriptionMaxLength),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewId(),
	}
	assert.Nil(t, g5.IsValidForCreate())

	g5.Name = g5.Name + "x"
	assert.Equal(t, g5.IsValidForCreate().Id, "model.group.name.app_error")
	g5.Name = model.NewId()
	assert.Nil(t, g5.IsValidForCreate())

	g5.DisplayName = g5.DisplayName + "x"
	assert.Equal(t, g5.IsValidForCreate().Id, "model.group.display_name.app_error")
	g5.DisplayName = model.NewId()
	assert.Nil(t, g5.IsValidForCreate())

	g5.Description = g5.Description + "x"
	assert.Equal(t, g5.IsValidForCreate().Id, "model.group.description.app_error")
	g5.Description = model.NewId()
	assert.Nil(t, g5.IsValidForCreate())

	// Must use a valid type
	g6 := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Source:      model.GroupSource("fake"),
		RemoteId:    model.NewId(),
	}
	assert.Equal(t, g6.IsValidForCreate().Id, "model.group.source.app_error")
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
	assert.Nil(t, res1.Err)
	d1 := res1.Data.(*model.Group)
	assert.Len(t, d1.Id, 26)

	// Get the group
	res2 := <-ss.Group().Get(d1.Id)
	assert.Nil(t, res2.Err)
	d2 := res2.Data.(*model.Group)
	assert.Equal(t, d1.Id, d2.Id)
	assert.Equal(t, d1.Name, d2.Name)
	assert.Equal(t, d1.DisplayName, d2.DisplayName)
	assert.Equal(t, d1.Description, d2.Description)
	assert.Equal(t, d1.RemoteId, d2.RemoteId)
	assert.Equal(t, d1.CreateAt, d2.CreateAt)
	assert.Equal(t, d1.UpdateAt, d2.UpdateAt)
	assert.Equal(t, d1.DeleteAt, d2.DeleteAt)

	// Get an invalid group
	res3 := <-ss.Group().Get(model.NewId())
	assert.NotNil(t, res3.Err)
	assert.Equal(t, res3.Err.Id, "store.sql_group.no_rows")
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
	assert.Nil(t, res1.Err)
	d1 := res1.Data.(*model.Group)
	assert.Len(t, d1.Id, 26)

	// Get the group
	res2 := <-ss.Group().GetByRemoteID(d1.RemoteId, model.GroupSourceLdap)
	assert.Nil(t, res2.Err)
	d2 := res2.Data.(*model.Group)
	assert.Equal(t, d1.Id, d2.Id)
	assert.Equal(t, d1.Name, d2.Name)
	assert.Equal(t, d1.DisplayName, d2.DisplayName)
	assert.Equal(t, d1.Description, d2.Description)
	assert.Equal(t, d1.RemoteId, d2.RemoteId)
	assert.Equal(t, d1.CreateAt, d2.CreateAt)
	assert.Equal(t, d1.UpdateAt, d2.UpdateAt)
	assert.Equal(t, d1.DeleteAt, d2.DeleteAt)

	// Get an invalid group
	res3 := <-ss.Group().GetByRemoteID(model.NewId(), model.GroupSource("fake"))
	assert.NotNil(t, res3.Err)
	assert.Equal(t, res3.Err.Id, "store.sql_group.no_rows")
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
		assert.Nil(t, res.Err)
	}

	// Returns all the groups
	res1 := <-ss.Group().GetAllBySource(model.GroupSourceLdap)
	d1 := res1.Data.([]*model.Group)
	assert.Condition(t, func() bool { return len(d1) >= numGroups })
	for _, expectedGroup := range groups {
		present := false
		for _, dbGroup := range d1 {
			if dbGroup.Id == expectedGroup.Id {
				present = true
				break
			}
		}
		assert.True(t, present)
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
	assert.Nil(t, res.Err)
	d1 := res.Data.(*model.Group)

	// Update happy path
	g1Update := &model.Group{}
	*g1Update = *g1
	g1Update.Name = model.NewId()
	g1Update.DisplayName = model.NewId()
	g1Update.Description = model.NewId()
	g1Update.RemoteId = model.NewId()

	res2 := <-ss.Group().Update(g1Update)
	assert.Nil(t, res2.Err)
	ud1 := res2.Data.(*model.Group)
	// Not changed...
	assert.Equal(t, d1.Id, ud1.Id)
	assert.Equal(t, d1.CreateAt, ud1.CreateAt)
	assert.Equal(t, d1.Source, ud1.Source)
	// Still zero...
	assert.Zero(t, ud1.DeleteAt)
	// Updated...
	assert.Equal(t, g1Update.Name, ud1.Name)
	assert.Equal(t, g1Update.DisplayName, ud1.DisplayName)
	assert.Equal(t, g1Update.Description, ud1.Description)
	assert.Equal(t, g1Update.RemoteId, ud1.RemoteId)

	// Requires name and display name
	res3 := <-ss.Group().Update(&model.Group{
		Id:          d1.Id,
		Name:        "",
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewId(),
		Description: model.NewId(),
	})
	assert.Nil(t, res3.Data)
	assert.NotNil(t, res3.Err)
	assert.Equal(t, res3.Err.Id, "model.group.name.app_error")

	res4 := <-ss.Group().Update(&model.Group{
		Id:          d1.Id,
		Name:        model.NewId(),
		DisplayName: "",
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewId(),
	})
	assert.Nil(t, res4.Data)
	assert.NotNil(t, res4.Err)
	assert.Equal(t, res4.Err.Id, "model.group.display_name.app_error")

	// Create another Group
	g2 := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		Description: model.NewId(),
		RemoteId:    model.NewId(),
	}
	res5 := <-ss.Group().Create(g2)
	assert.Nil(t, res5.Err)
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
	assert.Equal(t, res6.Err.Id, "store.update_error")

	// Cannot update CreateAt
	someVal := model.GetMillis()
	d1.CreateAt = someVal
	res7 := <-ss.Group().Update(d1)
	d3 := res7.Data.(*model.Group)
	assert.NotEqual(t, someVal, d3.CreateAt)

	// Cannot update DeleteAt to non-zero
	d1.DeleteAt = 1
	res9 := <-ss.Group().Update(d1)
	assert.Equal(t, "model.group.delete_at.app_error", res9.Err.Id)

	//...except for 0 for DeleteAt
	d1.DeleteAt = 0
	res8 := <-ss.Group().Update(d1)
	assert.Nil(t, res8.Err)
	d4 := res8.Data.(*model.Group)
	assert.Zero(t, d4.DeleteAt)
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
	assert.Nil(t, res1.Err)
	d1 := res1.Data.(*model.Group)
	assert.Len(t, d1.Id, 26)

	// Check the group is retrievable
	res2 := <-ss.Group().Get(d1.Id)
	assert.Nil(t, res2.Err)

	// Get the before count
	res7 := <-ss.Group().GetAllBySource(model.GroupSourceLdap)
	d7 := res7.Data.([]*model.Group)
	beforeCount := len(d7)

	// Delete the group
	res3 := <-ss.Group().Delete(d1.Id)
	assert.Nil(t, res3.Err)

	// Check the group is deleted
	res4 := <-ss.Group().Get(d1.Id)
	d4 := res4.Data.(*model.Group)
	assert.NotZero(t, d4.DeleteAt)

	// Check the after count
	res5 := <-ss.Group().GetAllBySource(model.GroupSourceLdap)
	d5 := res5.Data.([]*model.Group)
	afterCount := len(d5)
	assert.Condition(t, func() bool { return beforeCount == afterCount+1 })

	// Try and delete a nonexistent group
	res6 := <-ss.Group().Delete(model.NewId())
	assert.NotNil(t, res6.Err)
	assert.Equal(t, res6.Err.Id, "store.sql_group.no_rows")

	// Cannot delete again
	res8 := <-ss.Group().Delete(d1.Id)
	assert.Equal(t, res8.Err.Id, "store.sql_group.no_rows")
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
	assert.Nil(t, res.Err)
	group := res.Data.(*model.Group)

	u1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	res = <-ss.User().Save(u1)
	assert.Nil(t, res.Err)
	user1 := res.Data.(*model.User)

	res = <-ss.Group().CreateOrRestoreMember(group.Id, user1.Id)
	assert.Nil(t, res.Err)

	u2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	res = <-ss.User().Save(u2)
	assert.Nil(t, res.Err)
	user2 := res.Data.(*model.User)

	res = <-ss.Group().CreateOrRestoreMember(group.Id, user2.Id)
	assert.Nil(t, res.Err)

	// Check returns members
	res = <-ss.Group().GetMemberUsers(group.Id)
	assert.Nil(t, res.Err)
	groupMembers := res.Data.([]*model.User)
	assert.Equal(t, 2, len(groupMembers))

	// Check madeup id
	res = <-ss.Group().GetMemberUsers(model.NewId())
	assert.Equal(t, 0, len(res.Data.([]*model.User)))

	// Delete a member
	<-ss.Group().DeleteMember(group.Id, user1.Id)

	// Should not return deleted members
	res = <-ss.Group().GetMemberUsers(group.Id)
	groupMembers = res.Data.([]*model.User)
	assert.Equal(t, 1, len(groupMembers))
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
	assert.Nil(t, res.Err)
	group := res.Data.(*model.Group)

	u1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	res = <-ss.User().Save(u1)
	assert.Nil(t, res.Err)
	user1 := res.Data.(*model.User)

	res = <-ss.Group().CreateOrRestoreMember(group.Id, user1.Id)
	assert.Nil(t, res.Err)

	u2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	res = <-ss.User().Save(u2)
	assert.Nil(t, res.Err)
	user2 := res.Data.(*model.User)

	res = <-ss.Group().CreateOrRestoreMember(group.Id, user2.Id)
	assert.Nil(t, res.Err)

	// Check returns members
	res = <-ss.Group().GetMemberUsersPage(group.Id, 0, 100)
	assert.Nil(t, res.Err)
	groupMembers := res.Data.([]*model.User)
	assert.Equal(t, 2, len(groupMembers))

	// Check page 1
	res = <-ss.Group().GetMemberUsersPage(group.Id, 0, 1)
	assert.Nil(t, res.Err)
	groupMembers = res.Data.([]*model.User)
	assert.Equal(t, 1, len(groupMembers))
	assert.Equal(t, user2.Id, groupMembers[0].Id)

	// Check page 2
	res = <-ss.Group().GetMemberUsersPage(group.Id, 1, 1)
	assert.Nil(t, res.Err)
	groupMembers = res.Data.([]*model.User)
	assert.Equal(t, 1, len(groupMembers))
	assert.Equal(t, user1.Id, groupMembers[0].Id)

	// Check madeup id
	res = <-ss.Group().GetMemberUsersPage(model.NewId(), 0, 100)
	assert.Equal(t, 0, len(res.Data.([]*model.User)))

	// Delete a member
	<-ss.Group().DeleteMember(group.Id, user1.Id)

	// Should not return deleted members
	res = <-ss.Group().GetMemberUsersPage(group.Id, 0, 100)
	groupMembers = res.Data.([]*model.User)
	assert.Equal(t, 1, len(groupMembers))
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
	assert.Nil(t, res1.Err)
	group := res1.Data.(*model.Group)

	// Create user
	u1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	res2 := <-ss.User().Save(u1)
	assert.Nil(t, res2.Err)
	user := res2.Data.(*model.User)

	// Happy path
	res3 := <-ss.Group().CreateOrRestoreMember(group.Id, user.Id)
	assert.Nil(t, res3.Err)
	d2 := res3.Data.(*model.GroupMember)
	assert.Equal(t, d2.GroupId, group.Id)
	assert.Equal(t, d2.UserId, user.Id)
	assert.NotZero(t, d2.CreateAt)
	assert.Zero(t, d2.DeleteAt)

	// Duplicate composite key (GroupId, UserId)
	res4 := <-ss.Group().CreateOrRestoreMember(group.Id, user.Id)
	assert.Equal(t, res4.Err.Id, "store.sql_group.uniqueness_error")

	// Invalid GroupId
	res6 := <-ss.Group().CreateOrRestoreMember(model.NewId(), user.Id)
	assert.Equal(t, res6.Err.Id, "store.insert_error")

	// Restores a deleted member
	res := <-ss.Group().CreateOrRestoreMember(group.Id, user.Id)
	assert.NotNil(t, res.Err)

	res = <-ss.Group().DeleteMember(group.Id, user.Id)
	assert.Nil(t, res.Err)

	res = <-ss.Group().GetMemberUsers(group.Id)
	beforeRestoreCount := len(res.Data.([]*model.User))

	res = <-ss.Group().CreateOrRestoreMember(group.Id, user.Id)
	assert.Nil(t, res.Err)

	res = <-ss.Group().GetMemberUsers(group.Id)
	afterRestoreCount := len(res.Data.([]*model.User))

	assert.Equal(t, beforeRestoreCount+1, afterRestoreCount)
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
	assert.Nil(t, res1.Err)
	group := res1.Data.(*model.Group)

	// Create user
	u1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	res2 := <-ss.User().Save(u1)
	assert.Nil(t, res2.Err)
	user := res2.Data.(*model.User)

	// Create member
	res3 := <-ss.Group().CreateOrRestoreMember(group.Id, user.Id)
	assert.Nil(t, res3.Err)
	d1 := res3.Data.(*model.GroupMember)

	// Happy path
	res4 := <-ss.Group().DeleteMember(group.Id, user.Id)
	assert.Nil(t, res4.Err)
	d2 := res4.Data.(*model.GroupMember)
	assert.Equal(t, d2.GroupId, group.Id)
	assert.Equal(t, d2.UserId, user.Id)
	assert.Equal(t, d2.CreateAt, d1.CreateAt)
	assert.NotZero(t, d2.DeleteAt)

	// Delete an already deleted member
	res5 := <-ss.Group().DeleteMember(group.Id, user.Id)
	assert.Equal(t, res5.Err.Id, "store.sql_group.no_rows")

	// Delete with non-existent User
	res8 := <-ss.Group().DeleteMember(group.Id, model.NewId())
	assert.Equal(t, res8.Err.Id, "store.sql_group.no_rows")

	// Delete non-existent Group
	res9 := <-ss.Group().DeleteMember(model.NewId(), group.Id)
	assert.Equal(t, res9.Err.Id, "store.sql_group.no_rows")
}

func testCreateGroupSyncable(t *testing.T, ss store.Store) {
	// Invalid GroupID
	res2 := <-ss.Group().CreateGroupSyncable(&model.GroupSyncable{
		GroupId:    "x",
		SyncableId: string(model.NewId()),
		Type:       model.GroupSyncableTypeTeam,
	})
	assert.Equal(t, res2.Err.Id, "model.group_syncable.group_id.app_error")

	// Create Group
	g1 := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewId(),
	}
	res4 := <-ss.Group().Create(g1)
	assert.Nil(t, res4.Err)
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
	res5 := <-ss.Team().Save(t1)
	assert.Nil(t, res5.Err)
	team := res5.Data.(*model.Team)

	// New GroupSyncable, happy path
	gt1 := &model.GroupSyncable{
		GroupId:    group.Id,
		AutoAdd:    false,
		SyncableId: string(team.Id),
		Type:       model.GroupSyncableTypeTeam,
	}
	res6 := <-ss.Group().CreateGroupSyncable(gt1)
	assert.Nil(t, res6.Err)
	d1 := res6.Data.(*model.GroupSyncable)
	assert.Equal(t, gt1.SyncableId, d1.SyncableId)
	assert.Equal(t, gt1.GroupId, d1.GroupId)
	assert.Equal(t, gt1.AutoAdd, d1.AutoAdd)
	assert.NotZero(t, d1.CreateAt)
	assert.Zero(t, d1.DeleteAt)
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
	assert.Nil(t, res1.Err)
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
	res2 := <-ss.Team().Save(t1)
	assert.Nil(t, res2.Err)
	team := res2.Data.(*model.Team)

	// Create GroupSyncable
	gt1 := &model.GroupSyncable{
		GroupId:    group.Id,
		AutoAdd:    false,
		SyncableId: string(team.Id),
		Type:       model.GroupSyncableTypeTeam,
	}
	res3 := <-ss.Group().CreateGroupSyncable(gt1)
	assert.Nil(t, res3.Err)
	groupTeam := res3.Data.(*model.GroupSyncable)

	// Get GroupSyncable
	res4 := <-ss.Group().GetGroupSyncable(groupTeam.GroupId, groupTeam.SyncableId, model.GroupSyncableTypeTeam)
	assert.Nil(t, res4.Err)
	dgt := res4.Data.(*model.GroupSyncable)
	assert.Equal(t, gt1.GroupId, dgt.GroupId)
	assert.Equal(t, gt1.SyncableId, dgt.SyncableId)
	assert.Equal(t, gt1.AutoAdd, dgt.AutoAdd)
	assert.NotZero(t, gt1.CreateAt)
	assert.NotZero(t, gt1.UpdateAt)
	assert.Zero(t, gt1.DeleteAt)
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
	assert.Nil(t, res1.Err)
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
		res2 := <-ss.Team().Save(t1)
		assert.Nil(t, res2.Err)
		team := res2.Data.(*model.Team)

		// create groupteam
		res3 := <-ss.Group().CreateGroupSyncable(&model.GroupSyncable{
			GroupId:    group.Id,
			SyncableId: string(team.Id),
			Type:       model.GroupSyncableTypeTeam,
		})
		assert.Nil(t, res3.Err)
		groupTeam := res3.Data.(*model.GroupSyncable)
		groupTeams = append(groupTeams, groupTeam)
	}

	// Returns all the group teams
	res4 := <-ss.Group().GetAllGroupSyncablesByGroupId(group.Id, model.GroupSyncableTypeTeam)
	d1 := res4.Data.([]*model.GroupSyncable)
	assert.Condition(t, func() bool { return len(d1) >= numGroupSyncables })
	for _, expectedGroupTeam := range groupTeams {
		present := false
		for _, dbGroupTeam := range d1 {
			if dbGroupTeam.GroupId == expectedGroupTeam.GroupId && dbGroupTeam.SyncableId == expectedGroupTeam.SyncableId {
				present = true
				break
			}
		}
		assert.True(t, present)
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
	assert.Nil(t, res4.Err)
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
	res5 := <-ss.Team().Save(t1)
	assert.Nil(t, res5.Err)
	team := res5.Data.(*model.Team)

	// New GroupSyncable, happy path
	gt1 := &model.GroupSyncable{
		GroupId:    group.Id,
		AutoAdd:    false,
		SyncableId: string(team.Id),
		Type:       model.GroupSyncableTypeTeam,
	}
	res6 := <-ss.Group().CreateGroupSyncable(gt1)
	assert.Nil(t, res6.Err)
	d1 := res6.Data.(*model.GroupSyncable)

	// Update existing group team
	gt1.AutoAdd = true
	res7 := <-ss.Group().UpdateGroupSyncable(gt1)
	assert.Nil(t, res7.Err)
	d2 := res7.Data.(*model.GroupSyncable)
	assert.True(t, d2.AutoAdd)

	// Non-existent Group
	gt2 := &model.GroupSyncable{
		GroupId:    model.NewId(),
		AutoAdd:    false,
		SyncableId: string(team.Id),
		Type:       model.GroupSyncableTypeTeam,
	}
	res9 := <-ss.Group().UpdateGroupSyncable(gt2)
	assert.Equal(t, res9.Err.Id, "store.sql_group.no_rows")

	// Non-existent Team
	gt3 := &model.GroupSyncable{
		GroupId:    group.Id,
		AutoAdd:    false,
		SyncableId: string(model.NewId()),
		Type:       model.GroupSyncableTypeTeam,
	}
	res10 := <-ss.Group().UpdateGroupSyncable(gt3)
	assert.Equal(t, res10.Err.Id, "store.sql_group.no_rows")

	// Cannot update CreateAt or DeleteAt
	origCreateAt := d1.CreateAt
	d1.CreateAt = model.GetMillis()
	d1.AutoAdd = true
	res11 := <-ss.Group().UpdateGroupSyncable(d1)
	assert.Nil(t, res11.Err)
	d3 := res11.Data.(*model.GroupSyncable)
	assert.Equal(t, origCreateAt, d3.CreateAt)

	// Cannot update DeleteAt to arbitrary value
	d1.DeleteAt = 1
	res12 := <-ss.Group().UpdateGroupSyncable(d1)
	assert.Equal(t, "model.group.delete_at.app_error", res12.Err.Id)

	// Can update DeleteAt to 0
	d1.DeleteAt = 0
	res13 := <-ss.Group().UpdateGroupSyncable(d1)
	assert.Nil(t, res13.Err)
	d4 := res13.Data.(*model.GroupSyncable)
	assert.Zero(t, d4.DeleteAt)
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
	assert.Nil(t, res1.Err)
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
	res2 := <-ss.Team().Save(t1)
	assert.Nil(t, res2.Err)
	team := res2.Data.(*model.Team)

	// Create GroupSyncable
	gt1 := &model.GroupSyncable{
		GroupId:    group.Id,
		AutoAdd:    false,
		SyncableId: string(team.Id),
		Type:       model.GroupSyncableTypeTeam,
	}
	res7 := <-ss.Group().CreateGroupSyncable(gt1)
	assert.Nil(t, res7.Err)
	groupTeam := res7.Data.(*model.GroupSyncable)

	// Non-existent Group
	res5 := <-ss.Group().DeleteGroupSyncable(model.NewId(), groupTeam.SyncableId, model.GroupSyncableTypeTeam)
	assert.Equal(t, res5.Err.Id, "store.sql_group.no_rows")

	// Non-existent Team
	res6 := <-ss.Group().DeleteGroupSyncable(groupTeam.GroupId, string(model.NewId()), model.GroupSyncableTypeTeam)
	assert.Equal(t, res6.Err.Id, "store.sql_group.no_rows")

	// Happy path...
	res8 := <-ss.Group().DeleteGroupSyncable(groupTeam.GroupId, groupTeam.SyncableId, model.GroupSyncableTypeTeam)
	assert.Nil(t, res8.Err)
	d1 := res8.Data.(*model.GroupSyncable)
	assert.NotZero(t, d1.DeleteAt)
	assert.Equal(t, d1.GroupId, groupTeam.GroupId)
	assert.Equal(t, d1.SyncableId, groupTeam.SyncableId)
	assert.Equal(t, d1.AutoAdd, groupTeam.AutoAdd)
	assert.Equal(t, d1.CreateAt, groupTeam.CreateAt)
	assert.Condition(t, func() bool { return d1.UpdateAt > groupTeam.UpdateAt })

	// Record already deleted
	res9 := <-ss.Group().DeleteGroupSyncable(d1.GroupId, d1.SyncableId, d1.Type)
	assert.NotNil(t, res9.Err)
	assert.Equal(t, res9.Err.Id, "store.sql_group.group_syncable_already_deleted")
}

func testPendingAutoAddTeamMembers(t *testing.T, ss store.Store) {
	// Create Group
	res := <-ss.Group().Create(&model.Group{
		Name:        model.NewId(),
		DisplayName: "PendingAutoAddTeamMembers Test Group",
		RemoteId:    model.NewId(),
		Source:      model.GroupSourceLdap,
	})
	assert.Nil(t, res.Err)
	group := res.Data.(*model.Group)

	// Create User
	user := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	res = <-ss.User().Save(user)
	assert.Nil(t, res.Err)
	user = res.Data.(*model.User)

	// Create GroupMember
	res = <-ss.Group().CreateOrRestoreMember(group.Id, user.Id)
	assert.Nil(t, res.Err)

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
	res = <-ss.Team().Save(team)
	assert.Nil(t, res.Err)
	team = res.Data.(*model.Team)

	// Create GroupTeam
	res = <-ss.Group().CreateGroupSyncable(&model.GroupSyncable{
		AutoAdd:    true,
		SyncableId: team.Id,
		Type:       model.GroupSyncableTypeTeam,
		GroupId:    group.Id,
	})
	assert.Nil(t, res.Err)
	syncable := res.Data.(*model.GroupSyncable)

	// Time before syncable was created
	res = <-ss.Group().PendingAutoAddTeamMembers(syncable.CreateAt - 1)
	assert.Nil(t, res.Err)
	userTeamIDs := res.Data.([]*model.UserTeamIDPair)
	assert.Len(t, userTeamIDs, 1)
	assert.Equal(t, user.Id, userTeamIDs[0].UserID)
	assert.Equal(t, team.Id, userTeamIDs[0].TeamID)

	// Time after syncable was created
	res = <-ss.Group().PendingAutoAddTeamMembers(syncable.CreateAt + 1)
	assert.Nil(t, res.Err)
	assert.Len(t, res.Data, 0)

	// Delete and restore GroupMember should return result
	res = <-ss.Group().DeleteMember(group.Id, user.Id)
	assert.Nil(t, res.Err)
	res = <-ss.Group().CreateOrRestoreMember(group.Id, user.Id)
	assert.Nil(t, res.Err)
	res = <-ss.Group().PendingAutoAddTeamMembers(syncable.CreateAt + 1)
	assert.Nil(t, res.Err)
	assert.Len(t, res.Data, 1)

	pristineSyncable := *syncable

	res = <-ss.Group().UpdateGroupSyncable(syncable)
	assert.Nil(t, res.Err)

	// Time before syncable was updated
	res = <-ss.Group().PendingAutoAddTeamMembers(syncable.UpdateAt - 1)
	assert.Nil(t, res.Err)
	userTeamIDs = res.Data.([]*model.UserTeamIDPair)
	assert.Len(t, userTeamIDs, 1)
	assert.Equal(t, user.Id, userTeamIDs[0].UserID)
	assert.Equal(t, team.Id, userTeamIDs[0].TeamID)

	// Time after syncable was updated
	res = <-ss.Group().PendingAutoAddTeamMembers(syncable.UpdateAt + 1)
	assert.Nil(t, res.Err)
	assert.Len(t, res.Data, 0)

	// Only includes if auto-add
	syncable.AutoAdd = false
	res = <-ss.Group().UpdateGroupSyncable(syncable)
	assert.Nil(t, res.Err)
	res = <-ss.Group().PendingAutoAddTeamMembers(0)
	assert.Nil(t, res.Err)
	assert.Len(t, res.Data, 0)

	// reset state of syncable and verify
	res = <-ss.Group().UpdateGroupSyncable(&pristineSyncable)
	assert.Nil(t, res.Err)
	res = <-ss.Group().PendingAutoAddTeamMembers(0)
	assert.Nil(t, res.Err)
	assert.Len(t, res.Data, 1)

	// No result if Group deleted
	res = <-ss.Group().Delete(group.Id)
	assert.Nil(t, res.Err)
	res = <-ss.Group().PendingAutoAddTeamMembers(0)
	assert.Nil(t, res.Err)
	assert.Len(t, res.Data, 0)

	// reset state of group and verify
	group.DeleteAt = 0
	res = <-ss.Group().Update(group)
	res = <-ss.Group().PendingAutoAddTeamMembers(0)
	assert.Nil(t, res.Err)
	assert.Len(t, res.Data, 1)

	// No result if Team deleted
	team.DeleteAt = model.GetMillis()
	res = <-ss.Team().Update(team)
	assert.Nil(t, res.Err)
	res = <-ss.Group().PendingAutoAddTeamMembers(0)
	assert.Nil(t, res.Err)
	assert.Len(t, res.Data, 0)

	// reset state of team and verify
	team.DeleteAt = 0
	res = <-ss.Team().Update(team)
	assert.Nil(t, res.Err)
	res = <-ss.Group().PendingAutoAddTeamMembers(0)
	assert.Nil(t, res.Err)
	assert.Len(t, res.Data, 1)

	// No result if GroupTeam deleted
	res = <-ss.Group().DeleteGroupSyncable(group.Id, team.Id, model.GroupSyncableTypeTeam)
	assert.Nil(t, res.Err)
	res = <-ss.Group().PendingAutoAddTeamMembers(0)
	assert.Nil(t, res.Err)
	assert.Len(t, res.Data, 0)

	// reset GroupTeam and verify
	res = <-ss.Group().UpdateGroupSyncable(&pristineSyncable)
	assert.Nil(t, res.Err)
	res = <-ss.Group().PendingAutoAddTeamMembers(0)
	assert.Nil(t, res.Err)
	assert.Len(t, res.Data, 1)

	// No result if GroupMember deleted
	res = <-ss.Group().DeleteMember(group.Id, user.Id)
	assert.Nil(t, res.Err)
	res = <-ss.Group().PendingAutoAddTeamMembers(0)
	assert.Nil(t, res.Err)
	assert.Len(t, res.Data, 0)

	// restore group member and verify
	res = <-ss.Group().CreateOrRestoreMember(group.Id, user.Id)
	res = <-ss.Group().PendingAutoAddTeamMembers(0)
	assert.Nil(t, res.Err)
	assert.Len(t, res.Data, 1)

	// adding team membership stops returning result
	res = <-ss.Team().SaveMember(&model.TeamMember{
		TeamId: team.Id,
		UserId: user.Id,
	}, 999)
	assert.Nil(t, res.Err)
	res = <-ss.Group().PendingAutoAddTeamMembers(0)
	assert.Nil(t, res.Err)
	assert.Len(t, res.Data, 0)
}

func testPendingAutoAddChannelMembers(t *testing.T, ss store.Store) {
	// Create Group
	res := <-ss.Group().Create(&model.Group{
		Name:        model.NewId(),
		DisplayName: "PendingAutoAddChannelMembers Test Group",
		RemoteId:    model.NewId(),
		Source:      model.GroupSourceLdap,
	})
	assert.Nil(t, res.Err)
	group := res.Data.(*model.Group)

	// Create User
	user := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	res = <-ss.User().Save(user)
	assert.Nil(t, res.Err)
	user = res.Data.(*model.User)

	// Create GroupMember
	res = <-ss.Group().CreateOrRestoreMember(group.Id, user.Id)
	assert.Nil(t, res.Err)

	// Create Channel
	channel := &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "A Name",
		Name:        model.NewId(),
		Type:        model.CHANNEL_OPEN, // Query does not look at type so this shouldn't matter.
	}
	res = <-ss.Channel().Save(channel, 9999)
	assert.Nil(t, res.Err)
	channel = res.Data.(*model.Channel)

	// Create GroupChannel
	res = <-ss.Group().CreateGroupSyncable(&model.GroupSyncable{
		AutoAdd:    true,
		SyncableId: channel.Id,
		Type:       model.GroupSyncableTypeChannel,
		GroupId:    group.Id,
	})
	assert.Nil(t, res.Err)
	syncable := res.Data.(*model.GroupSyncable)

	// Time before syncable was created
	res = <-ss.Group().PendingAutoAddChannelMembers(syncable.CreateAt - 1)
	assert.Nil(t, res.Err)
	userChannelIDs := res.Data.([]*model.UserChannelIDPair)
	assert.Len(t, userChannelIDs, 1)
	assert.Equal(t, user.Id, userChannelIDs[0].UserID)
	assert.Equal(t, channel.Id, userChannelIDs[0].ChannelID)

	// Time after syncable was created
	res = <-ss.Group().PendingAutoAddChannelMembers(syncable.CreateAt + 1)
	assert.Nil(t, res.Err)
	assert.Len(t, res.Data, 0)

	// Delete and restore GroupMember should return result
	res = <-ss.Group().DeleteMember(group.Id, user.Id)
	assert.Nil(t, res.Err)
	res = <-ss.Group().CreateOrRestoreMember(group.Id, user.Id)
	assert.Nil(t, res.Err)
	res = <-ss.Group().PendingAutoAddChannelMembers(syncable.CreateAt + 1)
	assert.Nil(t, res.Err)
	assert.Len(t, res.Data, 1)

	pristineSyncable := *syncable

	res = <-ss.Group().UpdateGroupSyncable(syncable)
	assert.Nil(t, res.Err)

	// Time before syncable was updated
	res = <-ss.Group().PendingAutoAddChannelMembers(syncable.UpdateAt - 1)
	assert.Nil(t, res.Err)
	userChannelIDs = res.Data.([]*model.UserChannelIDPair)
	assert.Len(t, userChannelIDs, 1)
	assert.Equal(t, user.Id, userChannelIDs[0].UserID)
	assert.Equal(t, channel.Id, userChannelIDs[0].ChannelID)

	// Time after syncable was updated
	res = <-ss.Group().PendingAutoAddChannelMembers(syncable.UpdateAt + 1)
	assert.Nil(t, res.Err)
	assert.Len(t, res.Data, 0)

	// Only includes if auto-add
	syncable.AutoAdd = false
	res = <-ss.Group().UpdateGroupSyncable(syncable)
	assert.Nil(t, res.Err)
	res = <-ss.Group().PendingAutoAddChannelMembers(0)
	assert.Nil(t, res.Err)
	assert.Len(t, res.Data, 0)

	// reset state of syncable and verify
	res = <-ss.Group().UpdateGroupSyncable(&pristineSyncable)
	assert.Nil(t, res.Err)
	res = <-ss.Group().PendingAutoAddChannelMembers(0)
	assert.Nil(t, res.Err)
	assert.Len(t, res.Data, 1)

	// No result if Group deleted
	res = <-ss.Group().Delete(group.Id)
	assert.Nil(t, res.Err)
	res = <-ss.Group().PendingAutoAddChannelMembers(0)
	assert.Nil(t, res.Err)
	assert.Len(t, res.Data, 0)

	// reset state of group and verify
	group.DeleteAt = 0
	res = <-ss.Group().Update(group)
	res = <-ss.Group().PendingAutoAddChannelMembers(0)
	assert.Nil(t, res.Err)
	assert.Len(t, res.Data, 1)

	// No result if Channel deleted
	res = <-ss.Channel().Delete(channel.Id, model.GetMillis())
	assert.Nil(t, res.Err)
	res = <-ss.Group().PendingAutoAddChannelMembers(0)
	assert.Nil(t, res.Err)
	assert.Len(t, res.Data, 0)

	// reset state of channel and verify
	channel.DeleteAt = 0
	res = <-ss.Channel().Update(channel)
	assert.Nil(t, res.Err)
	res = <-ss.Group().PendingAutoAddChannelMembers(0)
	assert.Nil(t, res.Err)
	assert.Len(t, res.Data, 1)

	// No result if GroupChannel deleted
	res = <-ss.Group().DeleteGroupSyncable(group.Id, channel.Id, model.GroupSyncableTypeChannel)
	assert.Nil(t, res.Err)
	res = <-ss.Group().PendingAutoAddChannelMembers(0)
	assert.Nil(t, res.Err)
	assert.Len(t, res.Data, 0)

	// reset GroupChannel and verify
	res = <-ss.Group().UpdateGroupSyncable(&pristineSyncable)
	assert.Nil(t, res.Err)
	res = <-ss.Group().PendingAutoAddChannelMembers(0)
	assert.Nil(t, res.Err)
	assert.Len(t, res.Data, 1)

	// No result if GroupMember deleted
	res = <-ss.Group().DeleteMember(group.Id, user.Id)
	assert.Nil(t, res.Err)
	res = <-ss.Group().PendingAutoAddChannelMembers(0)
	assert.Nil(t, res.Err)
	assert.Len(t, res.Data, 0)

	// restore group member and verify
	res = <-ss.Group().CreateOrRestoreMember(group.Id, user.Id)
	assert.Nil(t, res.Err)
	res = <-ss.Group().PendingAutoAddChannelMembers(0)
	assert.Nil(t, res.Err)
	assert.Len(t, res.Data, 1)

	// Adding Channel (ChannelMemberHistory) should stop returning result
	res = <-ss.ChannelMemberHistory().LogJoinEvent(user.Id, channel.Id, model.GetMillis())
	assert.Nil(t, res.Err)
	res = <-ss.Group().PendingAutoAddChannelMembers(0)
	assert.Nil(t, res.Err)
	assert.Len(t, res.Data, 0)

	// Leaving Channel (ChannelMemberHistory) should still not return result
	res = <-ss.ChannelMemberHistory().LogLeaveEvent(user.Id, channel.Id, model.GetMillis())
	assert.Nil(t, res.Err)
	res = <-ss.Group().PendingAutoAddChannelMembers(0)
	assert.Nil(t, res.Err)
	assert.Len(t, res.Data, 0)

	// Purging ChannelMemberHistory re-returns the result
	res = <-ss.ChannelMemberHistory().PermanentDeleteBatch(model.GetMillis()+1, 100)
	assert.Nil(t, res.Err)
	res = <-ss.Group().PendingAutoAddChannelMembers(0)
	assert.Nil(t, res.Err)
	assert.Len(t, res.Data, 1)
}
