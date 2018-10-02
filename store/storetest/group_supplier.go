// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

func TestGroupStore(t *testing.T, ss store.Store) {
	t.Run("Create", func(t *testing.T) { testGroupStoreCreate(t, ss) })
	t.Run("Get", func(t *testing.T) { testGroupStoreGet(t, ss) })
	t.Run("GetByRemoteID", func(t *testing.T) { testGroupStoreGetByRemoteID(t, ss) })
	t.Run("GetAllPage", func(t *testing.T) { testGroupStoreGetAllPage(t, ss) })
	t.Run("Update", func(t *testing.T) { testGroupStoreUpdate(t, ss) })
	t.Run("Delete", func(t *testing.T) { testGroupStoreDelete(t, ss) })

	t.Run("CreateMember", func(t *testing.T) { testGroupCreateMember(t, ss) })
	t.Run("DeleteMember", func(t *testing.T) { testGroupDeleteMember(t, ss) })

	t.Run("CreateGroupSyncable", func(t *testing.T) { testCreateGroupSyncable(t, ss) })
	t.Run("GetGroupSyncable", func(t *testing.T) { testGetGroupSyncable(t, ss) })
	t.Run("GetAllGroupSyncablesByGroupPage", func(t *testing.T) { testGetAllGroupSyncablesByGroupPage(t, ss) })
	t.Run("UpdateGroupSyncable", func(t *testing.T) { testUpdateGroupSyncable(t, ss) })
	t.Run("DeleteGroupSyncable", func(t *testing.T) { testDeleteGroupSyncable(t, ss) })
}

func testGroupStoreCreate(t *testing.T, ss store.Store) {
	// Save a new group
	g1 := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Type:        model.GroupTypeLdap,
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
		Type:        model.GroupTypeLdap,
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

	// Can't invent an ID and save it
	g3 := &model.Group{
		Id:          model.NewId(),
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Type:        model.GroupTypeLdap,
		CreateAt:    1,
		UpdateAt:    1,
		RemoteId:    model.NewId(),
	}
	res4 := <-ss.Group().Create(g3)
	assert.Nil(t, res4.Data)
	assert.Equal(t, res4.Err.Id, "store.sql_group.invalid_group_id")

	// Won't accept a duplicate name
	g4 := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Type:        model.GroupTypeLdap,
		RemoteId:    model.NewId(),
	}
	res5 := <-ss.Group().Create(g4)
	assert.Nil(t, res5.Err)
	g4b := &model.Group{
		Name:        g4.Name,
		DisplayName: model.NewId(),
		Type:        model.GroupTypeLdap,
		RemoteId:    model.NewId(),
	}
	res5b := <-ss.Group().Create(g4b)
	assert.Nil(t, res5b.Data)
	assert.Equal(t, res5b.Err.Id, "store.sql_group.commit_error")

	// Fields cannot be greater than max values
	g5 := &model.Group{
		Name:        strings.Repeat("x", model.GroupNameMaxLength),
		DisplayName: strings.Repeat("x", model.GroupDisplayNameMaxLength),
		Description: strings.Repeat("x", model.GroupDescriptionMaxLength),
		Type:        model.GroupTypeLdap,
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
		Type:        model.GroupType("fake"),
		RemoteId:    model.NewId(),
	}
	assert.Equal(t, g6.IsValidForCreate().Id, "model.group.type.app_error")
}

func testGroupStoreGet(t *testing.T, ss store.Store) {
	// Create a group
	g1 := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Type:        model.GroupTypeLdap,
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
		Type:        model.GroupTypeLdap,
		RemoteId:    model.NewId(),
	}
	res1 := <-ss.Group().Create(g1)
	assert.Nil(t, res1.Err)
	d1 := res1.Data.(*model.Group)
	assert.Len(t, d1.Id, 26)

	// Get the group
	res2 := <-ss.Group().GetByRemoteID(d1.RemoteId, model.GroupTypeLdap)
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
	res3 := <-ss.Group().GetByRemoteID(model.NewId(), model.GroupType("fake"))
	assert.NotNil(t, res3.Err)
	assert.Equal(t, res3.Err.Id, "store.sql_group.no_rows")
}

func testGroupStoreGetAllPage(t *testing.T, ss store.Store) {
	numGroups := 10

	groups := []*model.Group{}

	// Create groups
	for i := 0; i < numGroups; i++ {
		g := &model.Group{
			Name:        model.NewId(),
			DisplayName: model.NewId(),
			Description: model.NewId(),
			Type:        model.GroupTypeLdap,
			RemoteId:    model.NewId(),
		}
		groups = append(groups, g)
		res := <-ss.Group().Create(g)
		assert.Nil(t, res.Err)
	}

	// Returns all the groups
	res1 := <-ss.Group().GetAllPage(0, 999)
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

	// Returns the correct number based on limit
	res2 := <-ss.Group().GetAllPage(0, 2)
	d2 := res2.Data.([]*model.Group)
	assert.Len(t, d2, 2)

	// Check that result sets are different using an offset
	res3 := <-ss.Group().GetAllPage(0, 5)
	d3 := res3.Data.([]*model.Group)
	res4 := <-ss.Group().GetAllPage(5, 5)
	d4 := res4.Data.([]*model.Group)
	for _, d3i := range d3 {
		for _, d4i := range d4 {
			if d4i.Id == d3i.Id {
				t.Error("Expected results to be unique.")
			}
		}
	}
}

func testGroupStoreUpdate(t *testing.T, ss store.Store) {
	// Save a new group
	g1 := &model.Group{
		Name:        "g1-test",
		DisplayName: model.NewId(),
		Type:        model.GroupTypeLdap,
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
	assert.Equal(t, d1.Type, ud1.Type)
	// Still zero...
	assert.Zero(t, ud1.DeleteAt)
	// Updated...
	assert.NotEqual(t, d1.UpdateAt, ud1.UpdateAt)
	assert.Equal(t, g1Update.Name, ud1.Name)
	assert.Equal(t, g1Update.DisplayName, ud1.DisplayName)
	assert.Equal(t, g1Update.Description, ud1.Description)
	assert.Equal(t, g1Update.RemoteId, ud1.RemoteId)

	// Requires name and display name
	res3 := <-ss.Group().Update(&model.Group{
		Id:          d1.Id,
		Name:        "",
		DisplayName: model.NewId(),
		Type:        model.GroupTypeLdap,
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
		Type:        model.GroupTypeLdap,
		RemoteId:    model.NewId(),
	})
	assert.Nil(t, res4.Data)
	assert.NotNil(t, res4.Err)
	assert.Equal(t, res4.Err.Id, "model.group.display_name.app_error")

	// Create another Group
	g2 := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Type:        model.GroupTypeLdap,
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
		Type:        model.GroupTypeLdap,
		Description: model.NewId(),
		RemoteId:    model.NewId(),
	})
	assert.Equal(t, res6.Err.Id, "store.sql_group.update_error")

	// Cannot update CreateAt
	someVal := model.GetMillis()
	d1.CreateAt = someVal
	res7 := <-ss.Group().Update(d1)
	d3 := res7.Data.(*model.Group)
	assert.NotEqual(t, someVal, d3.CreateAt)

	// Cannot update DeleteAt to non-zero
	d1.DeleteAt = 1
	res9 := <-ss.Group().Update(d1)
	assert.Equal(t, "store.sql_group.invalid_delete_at", res9.Err.Id)

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
		Type:        model.GroupTypeLdap,
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
	res7 := <-ss.Group().GetAllPage(0, 999)
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
	res5 := <-ss.Group().GetAllPage(0, 999)
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

func testGroupCreateMember(t *testing.T, ss store.Store) {
	// Create group
	g1 := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Type:        model.GroupTypeLdap,
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
	res3 := <-ss.Group().CreateMember(group.Id, user.Id)
	assert.Nil(t, res3.Err)
	d2 := res3.Data.(*model.GroupMember)
	assert.Equal(t, d2.GroupId, group.Id)
	assert.Equal(t, d2.UserId, user.Id)
	assert.NotZero(t, d2.CreateAt)
	assert.Zero(t, d2.DeleteAt)

	// Duplicate composite key (GroupId, UserId)
	res4 := <-ss.Group().CreateMember(group.Id, user.Id)
	assert.Equal(t, res4.Err.Id, "store.sql_group.uniqueness_error")

	// Invalid UserId
	res5 := <-ss.Group().CreateMember(group.Id, model.NewId())
	assert.Equal(t, res5.Err.Id, "store.sql_group.insert_error")

	// Invalid GroupId
	res6 := <-ss.Group().CreateMember(model.NewId(), user.Id)
	assert.Equal(t, res6.Err.Id, "store.sql_group.insert_error")
}

func testGroupDeleteMember(t *testing.T, ss store.Store) {
	// Create group
	g1 := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Type:        model.GroupTypeLdap,
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
	res3 := <-ss.Group().CreateMember(group.Id, user.Id)
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

	// Delete with invalid UserId
	res6 := <-ss.Group().DeleteMember(group.Id, strings.Repeat("x", 27))
	assert.Equal(t, res6.Err.Id, "store.sql_group.invalid_user_id")

	// Delete with invalid GroupId
	res7 := <-ss.Group().DeleteMember(strings.Repeat("x", 27), user.Id)
	assert.Equal(t, res7.Err.Id, "store.sql_group.invalid_group_id")

	// Delete with non-existent User
	res8 := <-ss.Group().DeleteMember(group.Id, model.NewId())
	assert.Equal(t, res8.Err.Id, "store.sql_group.no_rows")

	// Delete non-existent Group
	res9 := <-ss.Group().DeleteMember(model.NewId(), group.Id)
	assert.Equal(t, res9.Err.Id, "store.sql_group.no_rows")
}

func testCreateGroupSyncable(t *testing.T, ss store.Store) {
	// Invalid TeamID
	res1 := <-ss.Group().CreateGroupSyncable(&model.GroupSyncable{
		GroupId:    model.NewId(),
		CanLeave:   true,
		SyncableId: string("x"),
		Type:       model.GSTeam,
	})
	assert.Equal(t, res1.Err.Id, "model.group_syncable.syncable_id.app_error")

	// Invalid GroupID
	res2 := <-ss.Group().CreateGroupSyncable(&model.GroupSyncable{
		GroupId:    "x",
		CanLeave:   true,
		SyncableId: string(model.NewId()),
		Type:       model.GSTeam,
	})
	assert.Equal(t, res2.Err.Id, "model.group_syncable.group_id.app_error")

	// Invalid CanLeave/AutoAdd combo (both false)
	res3 := <-ss.Group().CreateGroupSyncable(&model.GroupSyncable{
		GroupId:    model.NewId(),
		CanLeave:   false,
		AutoAdd:    false,
		SyncableId: string(model.NewId()),
		Type:       model.GSTeam,
	})
	assert.Equal(t, res3.Err.Id, "model.group_syncable.invalid_state")

	// Create Group
	g1 := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Type:        model.GroupTypeLdap,
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
		CanLeave:   true,
		AutoAdd:    false,
		SyncableId: string(team.Id),
		Type:       model.GSTeam,
	}
	res6 := <-ss.Group().CreateGroupSyncable(gt1)
	assert.Nil(t, res6.Err)
	d1 := res6.Data.(*model.GroupSyncable)
	assert.Equal(t, gt1.SyncableId, d1.SyncableId)
	assert.Equal(t, gt1.GroupId, d1.GroupId)
	assert.Equal(t, gt1.CanLeave, d1.CanLeave)
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
		Type:        model.GroupTypeLdap,
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
		CanLeave:   true,
		AutoAdd:    false,
		SyncableId: string(team.Id),
		Type:       model.GSTeam,
	}
	res3 := <-ss.Group().CreateGroupSyncable(gt1)
	assert.Nil(t, res3.Err)
	groupTeam := res3.Data.(*model.GroupSyncable)

	// Get GroupSyncable
	res4 := <-ss.Group().GetGroupSyncable(groupTeam.GroupId, groupTeam.SyncableId, model.GSTeam)
	assert.Nil(t, res4.Err)
	dgt := res4.Data.(*model.GroupSyncable)
	assert.Equal(t, gt1.GroupId, dgt.GroupId)
	assert.Equal(t, gt1.SyncableId, dgt.SyncableId)
	assert.Equal(t, gt1.CanLeave, dgt.CanLeave)
	assert.Equal(t, gt1.AutoAdd, dgt.AutoAdd)
	assert.NotZero(t, gt1.CreateAt)
	assert.NotZero(t, gt1.UpdateAt)
	assert.Zero(t, gt1.DeleteAt)
}

func testGetAllGroupSyncablesByGroupPage(t *testing.T, ss store.Store) {
	numGroupSyncables := 10

	// Create group
	g := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Type:        model.GroupTypeLdap,
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
			CanLeave:   true,
			SyncableId: string(team.Id),
			Type:       model.GSTeam,
		})
		assert.Nil(t, res3.Err)
		groupTeam := res3.Data.(*model.GroupSyncable)
		groupTeams = append(groupTeams, groupTeam)
	}

	// Returns all the group teams
	res4 := <-ss.Group().GetAllGroupSyncablesByGroupPage(group.Id, model.GSTeam, 0, 999)
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

	// Returns the correct number based on limit
	res5 := <-ss.Group().GetAllGroupSyncablesByGroupPage(group.Id, model.GSTeam, 0, 2)
	d2 := res5.Data.([]*model.GroupSyncable)
	assert.Len(t, d2, 2)

	// Check that result sets are different using an offset
	res6 := <-ss.Group().GetAllGroupSyncablesByGroupPage(group.Id, model.GSTeam, 0, 5)
	d3 := res6.Data.([]*model.GroupSyncable)
	res7 := <-ss.Group().GetAllGroupSyncablesByGroupPage(group.Id, model.GSTeam, 5, 5)
	d4 := res7.Data.([]*model.GroupSyncable)
	for _, d3i := range d3 {
		for _, d4i := range d4 {
			if d4i.GroupId == d3i.GroupId && d4i.SyncableId == d3i.SyncableId {
				t.Error("Expected results to be unique.")
			}
		}
	}
}

func testUpdateGroupSyncable(t *testing.T, ss store.Store) {
	// Create Group
	g1 := &model.Group{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Type:        model.GroupTypeLdap,
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
		CanLeave:   true,
		AutoAdd:    false,
		SyncableId: string(team.Id),
		Type:       model.GSTeam,
	}
	res6 := <-ss.Group().CreateGroupSyncable(gt1)
	assert.Nil(t, res6.Err)
	d1 := res6.Data.(*model.GroupSyncable)

	// Update existing group team
	gt1.CanLeave = false
	gt1.AutoAdd = true
	res7 := <-ss.Group().UpdateGroupSyncable(gt1)
	assert.Nil(t, res7.Err)
	d2 := res7.Data.(*model.GroupSyncable)
	assert.False(t, d2.CanLeave)
	assert.True(t, d2.AutoAdd)

	// Update to invalid state
	gt1.AutoAdd = false
	gt1.CanLeave = false
	res8 := <-ss.Group().UpdateGroupSyncable(gt1)
	assert.Equal(t, res8.Err.Id, "model.group_syncable.invalid_state")

	// Non-existent Group
	gt2 := &model.GroupSyncable{
		GroupId:    model.NewId(),
		CanLeave:   true,
		AutoAdd:    false,
		SyncableId: string(team.Id),
		Type:       model.GSTeam,
	}
	res9 := <-ss.Group().UpdateGroupSyncable(gt2)
	assert.Equal(t, res9.Err.Id, "store.sql_group.no_rows")

	// Non-existent Team
	gt3 := &model.GroupSyncable{
		GroupId:    group.Id,
		CanLeave:   true,
		AutoAdd:    false,
		SyncableId: string(model.NewId()),
		Type:       model.GSTeam,
	}
	res10 := <-ss.Group().UpdateGroupSyncable(gt3)
	assert.Equal(t, res10.Err.Id, "store.sql_group.no_rows")

	// Cannot update CreateAt or DeleteAt
	origCreateAt := d1.CreateAt
	d1.CreateAt = model.GetMillis()
	d1.AutoAdd = true
	d1.CanLeave = true
	res11 := <-ss.Group().UpdateGroupSyncable(d1)
	assert.Nil(t, res11.Err)
	d3 := res11.Data.(*model.GroupSyncable)
	assert.Equal(t, origCreateAt, d3.CreateAt)

	// Cannot update DeleteAt to arbitrary value
	d1.DeleteAt = 1
	res12 := <-ss.Group().UpdateGroupSyncable(d1)
	assert.Equal(t, "store.sql_group.invalid_delete_at", res12.Err.Id)

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
		Type:        model.GroupTypeLdap,
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
		CanLeave:   true,
		AutoAdd:    false,
		SyncableId: string(team.Id),
		Type:       model.GSTeam,
	}
	res7 := <-ss.Group().CreateGroupSyncable(gt1)
	assert.Nil(t, res7.Err)
	groupTeam := res7.Data.(*model.GroupSyncable)

	// Invalid GroupId
	res3 := <-ss.Group().DeleteGroupSyncable("x", groupTeam.SyncableId, model.GSTeam)
	assert.Equal(t, res3.Err.Id, "store.sql_group.invalid_group_id")

	// Invalid TeamId
	res4 := <-ss.Group().DeleteGroupSyncable(groupTeam.GroupId, "x", model.GSTeam)
	assert.Equal(t, res4.Err.Id, "store.sql_group.invalid_syncable_id")

	// Non-existent Group
	res5 := <-ss.Group().DeleteGroupSyncable(model.NewId(), groupTeam.SyncableId, model.GSTeam)
	assert.Equal(t, res5.Err.Id, "store.sql_group.no_rows")

	// Non-existent Team
	res6 := <-ss.Group().DeleteGroupSyncable(groupTeam.GroupId, string(model.NewId()), model.GSTeam)
	assert.Equal(t, res6.Err.Id, "store.sql_group.no_rows")

	// Happy path...
	res8 := <-ss.Group().DeleteGroupSyncable(groupTeam.GroupId, groupTeam.SyncableId, model.GSTeam)
	assert.Nil(t, res8.Err)
	d1 := res8.Data.(*model.GroupSyncable)
	assert.NotZero(t, d1.DeleteAt)
	assert.Equal(t, d1.GroupId, groupTeam.GroupId)
	assert.Equal(t, d1.SyncableId, groupTeam.SyncableId)
	assert.Equal(t, d1.CanLeave, groupTeam.CanLeave)
	assert.Equal(t, d1.AutoAdd, groupTeam.AutoAdd)
	assert.Equal(t, d1.CreateAt, groupTeam.CreateAt)
	assert.Condition(t, func() bool { return d1.UpdateAt > groupTeam.UpdateAt })

	// Record already deleted
	res9 := <-ss.Group().DeleteGroupSyncable(d1.GroupId, d1.SyncableId, d1.Type)
	assert.NotNil(t, res9.Err)
	assert.Equal(t, res9.Err.Id, "store.sql_group.already_deleted")
}
