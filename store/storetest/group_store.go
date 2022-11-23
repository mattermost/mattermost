// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store"
	"github.com/mattermost/mattermost-server/v6/utils"
)

func TestGroupStore(t *testing.T, ss store.Store) {
	t.Run("Create", func(t *testing.T) { testGroupStoreCreate(t, ss) })
	t.Run("CreateWithUserIds", func(t *testing.T) { testGroupCreateWithUserIds(t, ss) })

	t.Run("Get", func(t *testing.T) { testGroupStoreGet(t, ss) })
	t.Run("GetByName", func(t *testing.T) { testGroupStoreGetByName(t, ss) })
	t.Run("GetByIDs", func(t *testing.T) { testGroupStoreGetByIDs(t, ss) })
	t.Run("GetByRemoteID", func(t *testing.T) { testGroupStoreGetByRemoteID(t, ss) })
	t.Run("GetAllBySource", func(t *testing.T) { testGroupStoreGetAllByType(t, ss) })
	t.Run("GetByUser", func(t *testing.T) { testGroupStoreGetByUser(t, ss) })
	t.Run("Update", func(t *testing.T) { testGroupStoreUpdate(t, ss) })
	t.Run("Delete", func(t *testing.T) { testGroupStoreDelete(t, ss) })
	t.Run("Restore", func(t *testing.T) { testGroupStoreRestore(t, ss) })

	t.Run("GetMemberUsers", func(t *testing.T) { testGroupGetMemberUsers(t, ss) })
	t.Run("GetMemberUsersPage", func(t *testing.T) { testGroupGetMemberUsersPage(t, ss) })
	t.Run("GetMemberUsersSortedPage", func(t *testing.T) { testGroupGetMemberUsersSortedPage(t, ss) })

	t.Run("GetMemberUsersInTeam", func(t *testing.T) { testGroupGetMemberUsersInTeam(t, ss) })
	t.Run("GetMemberUsersNotInChannel", func(t *testing.T) { testGroupGetMemberUsersNotInChannel(t, ss) })

	t.Run("UpsertMember", func(t *testing.T) { testUpsertMember(t, ss) })
	t.Run("UpsertMembers", func(t *testing.T) { testUpsertMembers(t, ss) })
	t.Run("DeleteMember", func(t *testing.T) { testGroupDeleteMember(t, ss) })
	t.Run("DeleteMembers", func(t *testing.T) { testGroupDeleteMembers(t, ss) })
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
	t.Run("GetGroupsAssociatedToChannelsByTeam", func(t *testing.T) { testGetGroupsAssociatedToChannelsByTeam(t, ss) })
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

	t.Run("GroupCount", func(t *testing.T) { groupTestGroupCount(t, ss) })
	t.Run("GroupTeamCount", func(t *testing.T) { groupTestGroupTeamCount(t, ss) })
	t.Run("GroupChannelCount", func(t *testing.T) { groupTestGroupChannelCount(t, ss) })
	t.Run("GroupMemberCount", func(t *testing.T) { groupTestGroupMemberCount(t, ss) })
	t.Run("DistinctGroupMemberCount", func(t *testing.T) { groupTestDistinctGroupMemberCount(t, ss) })
	t.Run("GroupCountWithAllowReference", func(t *testing.T) { groupTestGroupCountWithAllowReference(t, ss) })

	t.Run("GetMember", func(t *testing.T) { groupTestGetMember(t, ss) })
	t.Run("GetNonMemberUsersPage", func(t *testing.T) { groupTestGetNonMemberUsersPage(t, ss) })

	t.Run("DistinctGroupMemberCountForSource", func(t *testing.T) { groupTestDistinctGroupMemberCountForSource(t, ss) })
}

func testGroupStoreCreate(t *testing.T, ss store.Store) {
	// Save a new group
	g1 := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		Description: model.NewId(),
		RemoteId:    model.NewString(model.NewId()),
	}

	// Happy path
	d1, err := ss.Group().Create(g1)
	require.NoError(t, err)
	require.Len(t, d1.Id, 26)
	require.Equal(t, *g1.Name, *d1.Name)
	require.Equal(t, g1.DisplayName, d1.DisplayName)
	require.Equal(t, g1.Description, d1.Description)
	require.Equal(t, g1.RemoteId, d1.RemoteId)
	require.NotZero(t, d1.CreateAt)
	require.NotZero(t, d1.UpdateAt)
	require.Zero(t, d1.DeleteAt)

	// Requires display name
	g2 := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: "",
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString(model.NewId()),
	}
	data, err := ss.Group().Create(g2)
	require.Nil(t, data)
	require.Error(t, err)
	var appErr *model.AppError
	require.True(t, errors.As(err, &appErr))
	require.Equal(t, appErr.Id, "model.group.display_name.app_error")

	// Won't accept a duplicate name
	g4 := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString(model.NewId()),
	}
	_, err = ss.Group().Create(g4)
	require.NoError(t, err)
	g4b := &model.Group{
		Name:        g4.Name,
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString(model.NewId()),
	}
	data, err = ss.Group().Create(g4b)
	require.Nil(t, data)
	require.Error(t, err)
	require.Contains(t, err.Error(), fmt.Sprintf("Group with name %s already exists", *g4b.Name))

	// Fields cannot be greater than max values
	g5 := &model.Group{
		Name:        model.NewString(strings.Repeat("x", model.GroupNameMaxLength)),
		DisplayName: strings.Repeat("x", model.GroupDisplayNameMaxLength),
		Description: strings.Repeat("x", model.GroupDescriptionMaxLength),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString(model.NewId()),
	}
	require.Nil(t, g5.IsValidForCreate())

	g5.Name = model.NewString(*g5.Name + "x")
	require.Equal(t, g5.IsValidForCreate().Id, "model.group.name.invalid_length.app_error")
	g5.Name = model.NewString(model.NewId())
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
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Source:      model.GroupSource("fake"),
		RemoteId:    model.NewString(model.NewId()),
	}
	require.Equal(t, g6.IsValidForCreate().Id, "model.group.source.app_error")

	//must use valid characters
	g7 := &model.Group{
		Name:        model.NewString("%^#@$$"),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString(model.NewId()),
	}
	require.Equal(t, g7.IsValidForCreate().Id, "model.group.name.invalid_chars.app_error")
}

func testGroupCreateWithUserIds(t *testing.T, ss store.Store) {
	// Create user 1
	u1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user1, nErr := ss.User().Save(u1)
	require.NoError(t, nErr)

	// Create user 2
	u2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user2, nErr := ss.User().Save(u2)
	require.NoError(t, nErr)

	g1 := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceCustom,
		Description: model.NewId(),
		RemoteId:    model.NewString(model.NewId()),
	}

	// Save a new group
	guids1 := &model.GroupWithUserIds{
		Group:   *g1,
		UserIds: []string{user1.Id, user2.Id},
	}

	// Happy path
	d1, err := ss.Group().CreateWithUserIds(guids1)
	require.NoError(t, err)
	require.Len(t, d1.Id, 26)
	require.Equal(t, *guids1.Name, *d1.Name)
	require.Equal(t, guids1.DisplayName, d1.DisplayName)
	require.Equal(t, guids1.Description, d1.Description)
	require.Equal(t, guids1.RemoteId, d1.RemoteId)
	require.NotZero(t, d1.CreateAt)
	require.NotZero(t, d1.UpdateAt)
	require.Zero(t, d1.DeleteAt)
	require.Equal(t, *model.NewInt64(2), int64(*d1.MemberCount))

	// Requires display name

	g2 := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: "",
		Source:      model.GroupSourceCustom,
		Description: model.NewId(),
		RemoteId:    model.NewString(model.NewId()),
	}

	guids2 := &model.GroupWithUserIds{
		Group:   *g2,
		UserIds: []string{user1.Id, user2.Id},
	}
	data, err := ss.Group().CreateWithUserIds(guids2)
	require.Nil(t, data)
	require.Error(t, err)
	var appErr *model.AppError
	require.True(t, errors.As(err, &appErr))
	require.Equal(t, appErr.Id, "model.group.display_name.app_error")

	// Won't accept a duplicate name
	g4 := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceCustom,
		RemoteId:    model.NewString(model.NewId()),
	}
	guids4 := &model.GroupWithUserIds{
		Group:   *g4,
		UserIds: []string{user1.Id, user2.Id},
	}
	_, err = ss.Group().CreateWithUserIds(guids4)
	require.NoError(t, err)
	g4b := &model.Group{
		Name:        g4.Name,
		DisplayName: model.NewId(),
		Source:      model.GroupSourceCustom,
		RemoteId:    model.NewString(model.NewId()),
	}
	guids4b := &model.GroupWithUserIds{
		Group:   *g4b,
		UserIds: []string{user1.Id},
	}
	data, err = ss.Group().CreateWithUserIds(guids4b)
	require.Nil(t, data)
	require.Error(t, err)
	require.Contains(t, err.Error(), "unique constraint: Name")

	// Fields cannot be greater than max values
	g5 := &model.Group{
		Name:        model.NewString(strings.Repeat("x", model.GroupNameMaxLength)),
		DisplayName: strings.Repeat("x", model.GroupDisplayNameMaxLength),
		Description: strings.Repeat("x", model.GroupDescriptionMaxLength),
		Source:      model.GroupSourceCustom,
		RemoteId:    model.NewString(model.NewId()),
	}
	guids5 := &model.GroupWithUserIds{
		Group: *g5,
	}
	require.Nil(t, guids5.IsValidForCreate())

	guids5.Name = model.NewString(*guids5.Name + "x")
	require.Equal(t, guids5.IsValidForCreate().Id, "model.group.name.invalid_length.app_error")
	guids5.Name = model.NewString(model.NewId())
	require.Nil(t, guids5.IsValidForCreate())

	guids5.DisplayName = guids5.DisplayName + "x"
	require.Equal(t, guids5.IsValidForCreate().Id, "model.group.display_name.app_error")
	guids5.DisplayName = model.NewId()
	require.Nil(t, guids5.IsValidForCreate())

	guids5.Description = guids5.Description + "x"
	require.Equal(t, guids5.IsValidForCreate().Id, "model.group.description.app_error")
	guids5.Description = model.NewId()
	require.Nil(t, guids5.IsValidForCreate())

	// Must use a valid type
	g6 := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Source:      model.GroupSource("fake"),
		RemoteId:    model.NewString(model.NewId()),
	}
	guids6 := &model.GroupWithUserIds{
		Group: *g6,
	}
	require.Equal(t, guids6.IsValidForCreate().Id, "model.group.source.app_error")

	//must use valid characters
	g7 := &model.Group{
		Name:        model.NewString("%^#@$$"),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Source:      model.GroupSourceCustom,
		RemoteId:    model.NewString(model.NewId()),
	}
	guids7 := &model.GroupWithUserIds{
		Group: *g7,
	}
	require.Equal(t, guids7.IsValidForCreate().Id, "model.group.name.invalid_chars.app_error")

	// Invalid user ids
	g8 := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Source:      model.GroupSourceCustom,
		RemoteId:    model.NewString(model.NewId()),
	}
	guids8 := &model.GroupWithUserIds{
		Group:   *g8,
		UserIds: []string{"1234uid"},
	}
	data, err = ss.Group().CreateWithUserIds(guids8)
	require.Nil(t, data)
	require.Error(t, err)
	require.Equal(t, store.NewErrNotFound("User", "1234uid"), err)
}

func testGroupStoreGet(t *testing.T, ss store.Store) {
	// Create a group
	g1 := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString(model.NewId()),
	}
	d1, err := ss.Group().Create(g1)
	require.NoError(t, err)
	require.Len(t, d1.Id, 26)

	// Get the group
	d2, err := ss.Group().Get(d1.Id)
	require.NoError(t, err)
	require.Equal(t, d1.Id, d2.Id)
	require.Equal(t, *d1.Name, *d2.Name)
	require.Equal(t, d1.DisplayName, d2.DisplayName)
	require.Equal(t, d1.Description, d2.Description)
	require.Equal(t, d1.RemoteId, d2.RemoteId)
	require.Equal(t, d1.CreateAt, d2.CreateAt)
	require.Equal(t, d1.UpdateAt, d2.UpdateAt)
	require.Equal(t, d1.DeleteAt, d2.DeleteAt)

	// Get an invalid group
	_, err = ss.Group().Get(model.NewId())
	require.Error(t, err)
	var nfErr *store.ErrNotFound
	require.True(t, errors.As(err, &nfErr))
}

func testGroupStoreGetByName(t *testing.T, ss store.Store) {
	// Create a group
	g1 := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString(model.NewId()),
	}
	g1Opts := model.GroupSearchOpts{
		FilterAllowReference: false,
	}

	d1, err := ss.Group().Create(g1)
	require.NoError(t, err)
	require.Len(t, d1.Id, 26)

	// Get the group
	d2, err := ss.Group().GetByName(*d1.Name, g1Opts)
	require.NoError(t, err)
	require.Equal(t, d1.Id, d2.Id)
	require.Equal(t, *d1.Name, *d2.Name)
	require.Equal(t, d1.DisplayName, d2.DisplayName)
	require.Equal(t, d1.Description, d2.Description)
	require.Equal(t, d1.RemoteId, d2.RemoteId)
	require.Equal(t, d1.CreateAt, d2.CreateAt)
	require.Equal(t, d1.UpdateAt, d2.UpdateAt)
	require.Equal(t, d1.DeleteAt, d2.DeleteAt)

	// Get an invalid group
	_, err = ss.Group().GetByName(model.NewId(), g1Opts)
	require.Error(t, err)
	var nfErr *store.ErrNotFound
	require.True(t, errors.As(err, &nfErr))
}

func testGroupStoreGetByIDs(t *testing.T, ss store.Store) {
	var group1 *model.Group
	var group2 *model.Group

	for i := 0; i < 2; i++ {
		group := &model.Group{
			Name:        model.NewString(model.NewId()),
			DisplayName: model.NewId(),
			Description: model.NewId(),
			Source:      model.GroupSourceLdap,
			RemoteId:    model.NewString(model.NewId()),
		}
		group, err := ss.Group().Create(group)
		require.NoError(t, err)
		switch i {
		case 0:
			group1 = group
		case 1:
			group2 = group
		}
	}

	groups, err := ss.Group().GetByIDs([]string{group1.Id, group2.Id})
	require.NoError(t, err)
	require.Len(t, groups, 2)

	for i := 0; i < 2; i++ {
		require.True(t, (groups[i].Id == group1.Id || groups[i].Id == group2.Id))
	}

	require.True(t, groups[0].Id != groups[1].Id)
}

func testGroupStoreGetByRemoteID(t *testing.T, ss store.Store) {
	// Create a group
	g1 := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString(model.NewId()),
	}
	d1, err := ss.Group().Create(g1)
	require.NoError(t, err)
	require.Len(t, d1.Id, 26)

	// Get the group
	d2, err := ss.Group().GetByRemoteID(*d1.RemoteId, model.GroupSourceLdap)
	require.NoError(t, err)
	require.Equal(t, d1.Id, d2.Id)
	require.Equal(t, *d1.Name, *d2.Name)
	require.Equal(t, d1.DisplayName, d2.DisplayName)
	require.Equal(t, d1.Description, d2.Description)
	require.Equal(t, d1.RemoteId, d2.RemoteId)
	require.Equal(t, d1.CreateAt, d2.CreateAt)
	require.Equal(t, d1.UpdateAt, d2.UpdateAt)
	require.Equal(t, d1.DeleteAt, d2.DeleteAt)

	// Get an invalid group
	_, err = ss.Group().GetByRemoteID(model.NewId(), model.GroupSource("fake"))
	require.Error(t, err)
	var nfErr *store.ErrNotFound
	require.True(t, errors.As(err, &nfErr))
}

func testGroupStoreGetAllByType(t *testing.T, ss store.Store) {
	numGroups := 10

	groups := []*model.Group{}

	// Create groups
	for i := 0; i < numGroups; i++ {
		g := &model.Group{
			Name:        model.NewString(model.NewId()),
			DisplayName: model.NewId(),
			Description: model.NewId(),
			Source:      model.GroupSourceLdap,
			RemoteId:    model.NewString(model.NewId()),
		}
		groups = append(groups, g)
		_, err := ss.Group().Create(g)
		require.NoError(t, err)
	}

	// Returns all the groups
	d1, err := ss.Group().GetAllBySource(model.GroupSourceLdap)
	require.NoError(t, err)
	require.Condition(t, func() bool { return len(d1) >= numGroups }, len(d1), ">=", numGroups)
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
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString(model.NewId()),
	}
	g1, err := ss.Group().Create(g1)
	require.NoError(t, err)

	g2 := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString(model.NewId()),
	}
	g2, err = ss.Group().Create(g2)
	require.NoError(t, err)

	u1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	u1, nErr := ss.User().Save(u1)
	require.NoError(t, nErr)

	_, err = ss.Group().UpsertMember(g1.Id, u1.Id)
	require.NoError(t, err)
	_, err = ss.Group().UpsertMember(g2.Id, u1.Id)
	require.NoError(t, err)

	u2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	u2, nErr = ss.User().Save(u2)
	require.NoError(t, nErr)

	_, err = ss.Group().UpsertMember(g2.Id, u2.Id)
	require.NoError(t, err)

	groups, err := ss.Group().GetByUser(u1.Id)
	require.NoError(t, err)
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
	require.NoError(t, err)
	require.Equal(t, 1, len(groups))
	assert.Equal(t, g2.Id, groups[0].Id)

	groups, err = ss.Group().GetByUser(model.NewId())
	require.NoError(t, err)
	assert.Equal(t, 0, len(groups))
}

func testGroupStoreUpdate(t *testing.T, ss store.Store) {
	// Save a new group
	g1 := &model.Group{
		Name:        model.NewString("g1-test"),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		Description: model.NewId(),
		RemoteId:    model.NewString(model.NewId()),
	}

	// Create a group
	d1, err := ss.Group().Create(g1)
	require.NoError(t, err)

	// Update happy path
	g1Update := &model.Group{}
	*g1Update = *g1
	g1Update.Name = model.NewString(model.NewId())
	g1Update.DisplayName = model.NewId()
	g1Update.Description = model.NewId()
	g1Update.RemoteId = model.NewString(model.NewId())

	ud1, err := ss.Group().Update(g1Update)
	require.NoError(t, err)
	// Not changed...
	require.Equal(t, d1.Id, ud1.Id)
	require.Equal(t, d1.CreateAt, ud1.CreateAt)
	require.Equal(t, d1.Source, ud1.Source)
	// Still zero...
	require.Zero(t, ud1.DeleteAt)
	// Updated...
	require.Equal(t, *g1Update.Name, *ud1.Name)
	require.Equal(t, g1Update.DisplayName, ud1.DisplayName)
	require.Equal(t, g1Update.Description, ud1.Description)
	require.Equal(t, g1Update.RemoteId, ud1.RemoteId)

	// Requires display name
	data, err := ss.Group().Update(&model.Group{
		Id:          d1.Id,
		Name:        model.NewString(model.NewId()),
		DisplayName: "",
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString(model.NewId()),
	})
	require.Nil(t, data)
	require.Error(t, err)
	var appErr *model.AppError
	require.True(t, errors.As(err, &appErr))
	require.Equal(t, appErr.Id, "model.group.display_name.app_error")

	// Create another Group
	g2 := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		Description: model.NewId(),
		RemoteId:    model.NewString(model.NewId()),
	}
	d2, err := ss.Group().Create(g2)
	require.NoError(t, err)

	// Can't update the name to be a duplicate of an existing group's name
	_, err = ss.Group().Update(&model.Group{
		Id:          d2.Id,
		Name:        g1Update.Name,
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		Description: model.NewId(),
		RemoteId:    model.NewString(model.NewId()),
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "unique constraint: Name")

	// Cannot update CreateAt
	someVal := model.GetMillis()
	d1.CreateAt = someVal
	d3, err := ss.Group().Update(d1)
	require.NoError(t, err)
	require.NotEqual(t, someVal, d3.CreateAt)

	// Cannot update DeleteAt to non-zero
	d1.DeleteAt = 1
	_, err = ss.Group().Update(d1)
	require.Error(t, err)
	require.Contains(t, err.Error(), "DeleteAt should be 0 when updating")

	//...except for 0 for DeleteAt
	d1.DeleteAt = 0
	d4, err := ss.Group().Update(d1)
	require.NoError(t, err)
	require.Zero(t, d4.DeleteAt)
}

func testGroupStoreDelete(t *testing.T, ss store.Store) {
	// Save a group
	g1 := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString(model.NewId()),
	}

	d1, err := ss.Group().Create(g1)
	require.NoError(t, err)
	require.Len(t, d1.Id, 26)

	// Check the group is retrievable
	_, err = ss.Group().Get(d1.Id)
	require.NoError(t, err)

	// Get the before count
	d7, err := ss.Group().GetAllBySource(model.GroupSourceLdap)
	require.NoError(t, err)
	beforeCount := len(d7)

	// Delete the group
	_, err = ss.Group().Delete(d1.Id)
	require.NoError(t, err)

	// Check the group is deleted
	d4, err := ss.Group().Get(d1.Id)
	require.NoError(t, err)
	require.NotZero(t, d4.DeleteAt)

	// Check the after count
	d5, err := ss.Group().GetAllBySource(model.GroupSourceLdap)
	require.NoError(t, err)
	afterCount := len(d5)
	require.Condition(t, func() bool { return beforeCount == afterCount+1 }, beforeCount, "==", afterCount+1)

	// Try and delete a nonexistent group
	_, err = ss.Group().Delete(model.NewId())
	require.Error(t, err)
	var nfErr *store.ErrNotFound
	require.True(t, errors.As(err, &nfErr))

	// Cannot delete again
	_, err = ss.Group().Delete(d1.Id)
	require.True(t, errors.As(err, &nfErr))
}

func testGroupStoreRestore(t *testing.T, ss store.Store) {
	// Save a group
	g1 := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString(model.NewId()),
	}

	d1, err := ss.Group().Create(g1)
	require.NoError(t, err)
	require.Len(t, d1.Id, 26)

	// Check the group is retrievable
	_, err = ss.Group().Get(d1.Id)
	require.NoError(t, err)

	// Delete the group
	_, err = ss.Group().Delete(d1.Id)
	require.NoError(t, err)

	// Get the before count
	d7, err := ss.Group().GetAllBySource(model.GroupSourceLdap)
	require.NoError(t, err)
	beforeCount := len(d7)

	// restore the group
	_, err = ss.Group().Restore(d1.Id)
	require.NoError(t, err)

	// Check the group is restored
	d4, err := ss.Group().Get(d1.Id)
	require.NoError(t, err)
	require.Zero(t, d4.DeleteAt)

	// Check the after count
	d5, err := ss.Group().GetAllBySource(model.GroupSourceLdap)
	require.NoError(t, err)
	afterCount := len(d5)
	require.Condition(t, func() bool { return beforeCount == afterCount-1 })

	// Try and restore a nonexistent group
	_, err = ss.Group().Delete(model.NewId())
	require.Error(t, err)
	var nfErr *store.ErrNotFound
	require.True(t, errors.As(err, &nfErr))

	// Cannot restore again
	_, err = ss.Group().Restore(d1.Id)
	require.True(t, errors.As(err, &nfErr))
}

func testGroupGetMemberUsers(t *testing.T, ss store.Store) {
	// Save a group
	g1 := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString(model.NewId()),
	}
	group, err := ss.Group().Create(g1)
	require.NoError(t, err)

	u1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user1, nErr := ss.User().Save(u1)
	require.NoError(t, nErr)

	_, err = ss.Group().UpsertMember(group.Id, user1.Id)
	require.NoError(t, err)

	u2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user2, nErr := ss.User().Save(u2)
	require.NoError(t, nErr)

	_, err = ss.Group().UpsertMember(group.Id, user2.Id)
	require.NoError(t, err)

	// Check returns members
	groupMembers, err := ss.Group().GetMemberUsers(group.Id)
	require.NoError(t, err)
	require.Equal(t, 2, len(groupMembers))

	// Check madeup id
	groupMembers, err = ss.Group().GetMemberUsers(model.NewId())
	require.NoError(t, err)
	require.Equal(t, 0, len(groupMembers))

	// Delete a member
	_, err = ss.Group().DeleteMember(group.Id, user1.Id)
	require.NoError(t, err)

	// Should not return deleted members
	groupMembers, err = ss.Group().GetMemberUsers(group.Id)
	require.NoError(t, err)
	require.Equal(t, 1, len(groupMembers))
}

func testGroupGetMemberUsersPage(t *testing.T, ss store.Store) {
	// Save a group
	g1 := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString(model.NewId()),
	}
	group, err := ss.Group().Create(g1)
	require.NoError(t, err)

	u1 := &model.User{
		Email:    MakeEmail(),
		Username: "user1" + model.NewId(),
	}
	user1, nErr := ss.User().Save(u1)
	require.NoError(t, nErr)

	_, err = ss.Group().UpsertMember(group.Id, user1.Id)
	require.NoError(t, err)

	u2 := &model.User{
		Email:    MakeEmail(),
		Username: "user2" + model.NewId(),
	}
	user2, nErr := ss.User().Save(u2)
	require.NoError(t, nErr)

	_, err = ss.Group().UpsertMember(group.Id, user2.Id)
	require.NoError(t, err)

	u3 := &model.User{
		Email:    MakeEmail(),
		Username: "user3" + model.NewId(),
	}
	user3, nErr := ss.User().Save(u3)
	require.NoError(t, nErr)

	_, err = ss.Group().UpsertMember(group.Id, user3.Id)
	require.NoError(t, err)

	// Check returns members
	groupMembers, err := ss.Group().GetMemberUsersPage(group.Id, 0, 100, nil)
	require.NoError(t, err)
	require.Equal(t, 3, len(groupMembers))

	// Check page 1
	groupMembers, err = ss.Group().GetMemberUsersPage(group.Id, 0, 2, nil)
	require.NoError(t, err)
	require.Equal(t, 2, len(groupMembers))
	require.ElementsMatch(t, []*model.User{user1, user2}, groupMembers)

	// Check page 2
	groupMembers, err = ss.Group().GetMemberUsersPage(group.Id, 1, 2, nil)
	require.NoError(t, err)
	require.Equal(t, 1, len(groupMembers))
	require.ElementsMatch(t, []*model.User{user3}, groupMembers)

	// Check madeup id
	groupMembers, err = ss.Group().GetMemberUsersPage(model.NewId(), 0, 100, nil)
	require.NoError(t, err)
	require.Equal(t, 0, len(groupMembers))

	// Delete a member
	_, err = ss.Group().DeleteMember(group.Id, user1.Id)
	require.NoError(t, err)

	// Should not return deleted members
	groupMembers, err = ss.Group().GetMemberUsersPage(group.Id, 0, 100, nil)
	require.NoError(t, err)
	require.Equal(t, 2, len(groupMembers))
}

func testGroupGetMemberUsersSortedPage(t *testing.T, ss store.Store) {
	// Save a group
	g1 := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString(model.NewId()),
	}
	group, err := ss.Group().Create(g1)
	require.NoError(t, err)

	// First by nickname, third by full name, second by username
	u1 := &model.User{
		Email:     MakeEmail(),
		Username:  "y" + model.NewId(),
		Nickname:  "a" + model.NewId(),
		FirstName: "z" + model.NewId(),
		LastName:  "z" + model.NewId(),
	}
	user1, nErr := ss.User().Save(u1)
	require.NoError(t, nErr)

	_, err = ss.Group().UpsertMember(group.Id, user1.Id)
	require.NoError(t, err)

	// Second by nickname, first by full name, third by username
	u2 := &model.User{
		Email:     MakeEmail(),
		Username:  "z" + model.NewId(),
		FirstName: "b" + model.NewId(),
		LastName:  "b" + model.NewId(),
	}
	user2, nErr := ss.User().Save(u2)
	require.NoError(t, nErr)

	_, err = ss.Group().UpsertMember(group.Id, user2.Id)
	require.NoError(t, err)

	// Third by nickname, second by full name, first by username
	u3 := &model.User{
		Email:    MakeEmail(),
		Username: "d" + model.NewId(),
	}
	user3, nErr := ss.User().Save(u3)
	require.NoError(t, nErr)

	_, err = ss.Group().UpsertMember(group.Id, user3.Id)
	require.NoError(t, err)
	/*
		// Check nickname ordering, paged
		groupMembers, err := ss.Group().GetMemberUsersSortedPage(group.Id, 0, 2, nil, model.ShowNicknameFullName)
		require.NoError(t, err)
		require.Equal(t, 2, len(groupMembers))
		require.ElementsMatch(t, []*model.User{user1, user2}, groupMembers)
		groupMembers, err = ss.Group().GetMemberUsersSortedPage(group.Id, 1, 2, nil, model.ShowNicknameFullName)
		require.NoError(t, err)
		require.Equal(t, 1, len(groupMembers))
		require.ElementsMatch(t, []*model.User{user3}, groupMembers)
	*/

	// Check full name ordering, paged
	groupMembers, err := ss.Group().GetMemberUsersSortedPage(group.Id, 0, 2, nil, model.ShowFullName)
	require.NoError(t, err)
	require.Equal(t, 2, len(groupMembers))
	require.ElementsMatch(t, []*model.User{user2, user3}, groupMembers)
	groupMembers, err = ss.Group().GetMemberUsersSortedPage(group.Id, 1, 2, nil, model.ShowFullName)
	require.NoError(t, err)
	require.Equal(t, 1, len(groupMembers))
	require.ElementsMatch(t, []*model.User{user1}, groupMembers)
	/*
	   // Check username ordering
	   groupMembers, err = ss.Group().GetMemberUsersSortedPage(group.Id, 0, 2, nil, model.ShowUsername)
	   require.NoError(t, err)
	   require.Equal(t, 2, len(groupMembers))
	   require.ElementsMatch(t, []*model.User{user3, user1}, groupMembers)
	   groupMembers, err = ss.Group().GetMemberUsersSortedPage(group.Id, 1, 2, nil, model.ShowUsername)
	   require.NoError(t, err)
	   require.Equal(t, 1, len(groupMembers))
	   require.ElementsMatch(t, []*model.User{user2}, groupMembers)
	*/
}

func testGroupGetMemberUsersInTeam(t *testing.T, ss store.Store) {
	// Save a team
	team := &model.Team{
		DisplayName: "Name",
		Description: "Some description",
		CompanyName: "Some company name",
		Name:        "z-z-" + model.NewId() + "a",
		Email:       "success+" + model.NewId() + "@simulator.amazonses.com",
		Type:        model.TeamOpen,
	}
	team, err := ss.Team().Save(team)
	require.NoError(t, err)

	// Save a group
	g1 := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString(model.NewId()),
	}
	group, err := ss.Group().Create(g1)
	require.NoError(t, err)

	u1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user1, err := ss.User().Save(u1)
	require.NoError(t, err)

	_, err = ss.Group().UpsertMember(group.Id, user1.Id)
	require.NoError(t, err)

	u2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user2, err := ss.User().Save(u2)
	require.NoError(t, err)

	_, err = ss.Group().UpsertMember(group.Id, user2.Id)
	require.NoError(t, err)

	u3 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user3, err := ss.User().Save(u3)
	require.NoError(t, err)

	_, err = ss.Group().UpsertMember(group.Id, user3.Id)
	require.NoError(t, err)

	// returns no members when team does not exist
	groupMembers, err := ss.Group().GetMemberUsersInTeam(group.Id, "non-existent-channel-id")
	require.NoError(t, err)
	require.Equal(t, 0, len(groupMembers))

	// returns no members when group has no members in the team
	groupMembers, err = ss.Group().GetMemberUsersInTeam(group.Id, team.Id)
	require.NoError(t, err)
	require.Equal(t, 0, len(groupMembers))

	m1 := &model.TeamMember{TeamId: team.Id, UserId: user1.Id}
	_, nErr := ss.Team().SaveMember(m1, -1)
	require.NoError(t, nErr)

	// returns single member in team
	groupMembers, err = ss.Group().GetMemberUsersInTeam(group.Id, team.Id)
	require.NoError(t, err)
	require.Equal(t, 1, len(groupMembers))

	m2 := &model.TeamMember{TeamId: team.Id, UserId: user2.Id}
	m3 := &model.TeamMember{TeamId: team.Id, UserId: user3.Id}
	_, nErr = ss.Team().SaveMember(m2, -1)
	require.NoError(t, nErr)
	_, nErr = ss.Team().SaveMember(m3, -1)
	require.NoError(t, nErr)

	// returns all members when all members are in team
	groupMembers, err = ss.Group().GetMemberUsersInTeam(group.Id, team.Id)
	require.NoError(t, err)
	require.Equal(t, 3, len(groupMembers))
}

func testGroupGetMemberUsersNotInChannel(t *testing.T, ss store.Store) {
	// Save a team
	team := &model.Team{
		DisplayName: "Name",
		Description: "Some description",
		CompanyName: "Some company name",
		Name:        "z-z-" + model.NewId() + "a",
		Email:       "success+" + model.NewId() + "@simulator.amazonses.com",
		Type:        model.TeamOpen,
	}
	team, err := ss.Team().Save(team)
	require.NoError(t, err)

	// Save a group
	g1 := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString(model.NewId()),
	}
	group, err := ss.Group().Create(g1)
	require.NoError(t, err)

	u1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user1, err := ss.User().Save(u1)
	require.NoError(t, err)

	_, err = ss.Group().UpsertMember(group.Id, user1.Id)
	require.NoError(t, err)

	u2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user2, err := ss.User().Save(u2)
	require.NoError(t, err)

	_, err = ss.Group().UpsertMember(group.Id, user2.Id)
	require.NoError(t, err)

	u3 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user3, err := ss.User().Save(u3)
	require.NoError(t, err)

	_, err = ss.Group().UpsertMember(group.Id, user3.Id)
	require.NoError(t, err)

	// Create Channel
	channel := &model.Channel{
		TeamId:      team.Id,
		DisplayName: "Channel",
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen, // Query does not look at type so this shouldn't matter.
	}
	channel, nErr := ss.Channel().Save(channel, 9999)
	require.NoError(t, nErr)

	// returns no members when channel does not exist
	groupMembers, err := ss.Group().GetMemberUsersNotInChannel(group.Id, "non-existent-channel-id")
	require.NoError(t, err)
	require.Equal(t, 0, len(groupMembers))

	// returns no members when group has no members in the team that the channel belongs to
	groupMembers, err = ss.Group().GetMemberUsersNotInChannel(group.Id, channel.Id)
	require.NoError(t, err)
	require.Equal(t, 0, len(groupMembers))

	m1 := &model.TeamMember{TeamId: team.Id, UserId: user1.Id}
	_, nErr = ss.Team().SaveMember(m1, -1)
	require.NoError(t, nErr)

	// returns single member in team and not in channel
	groupMembers, err = ss.Group().GetMemberUsersNotInChannel(group.Id, channel.Id)
	require.NoError(t, err)
	require.Equal(t, 1, len(groupMembers))

	m2 := &model.TeamMember{TeamId: team.Id, UserId: user2.Id}
	m3 := &model.TeamMember{TeamId: team.Id, UserId: user3.Id}
	_, nErr = ss.Team().SaveMember(m2, -1)
	require.NoError(t, nErr)
	_, nErr = ss.Team().SaveMember(m3, -1)
	require.NoError(t, nErr)

	// returns all members when all members are in team and not in channel
	groupMembers, err = ss.Group().GetMemberUsersNotInChannel(group.Id, channel.Id)
	require.NoError(t, err)
	require.Equal(t, 3, len(groupMembers))

	cm1 := &model.ChannelMember{
		ChannelId:   channel.Id,
		UserId:      user1.Id,
		SchemeGuest: false,
		SchemeUser:  true,
		SchemeAdmin: false,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}
	_, err = ss.Channel().SaveMember(cm1)
	require.NoError(t, err)

	// returns both members not yet added to channel
	groupMembers, err = ss.Group().GetMemberUsersNotInChannel(group.Id, channel.Id)
	require.NoError(t, err)
	require.Equal(t, 2, len(groupMembers))

	cm2 := &model.ChannelMember{
		ChannelId:   channel.Id,
		UserId:      user2.Id,
		SchemeGuest: false,
		SchemeUser:  true,
		SchemeAdmin: false,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}
	cm3 := &model.ChannelMember{
		ChannelId:   channel.Id,
		UserId:      user3.Id,
		SchemeGuest: false,
		SchemeUser:  true,
		SchemeAdmin: false,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}

	_, err = ss.Channel().SaveMember(cm2)
	require.NoError(t, err)
	_, err = ss.Channel().SaveMember(cm3)
	require.NoError(t, err)

	// returns none when all members have been added to team and channel
	groupMembers, err = ss.Group().GetMemberUsersNotInChannel(group.Id, channel.Id)
	require.NoError(t, err)
	require.Equal(t, 0, len(groupMembers))
}

func testUpsertMember(t *testing.T, ss store.Store) {
	// Create group
	g1 := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString(model.NewId()),
	}
	group, err := ss.Group().Create(g1)
	require.NoError(t, err)

	// Create user
	u1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user, nErr := ss.User().Save(u1)
	require.NoError(t, nErr)

	// Happy path
	d2, err := ss.Group().UpsertMember(group.Id, user.Id)
	require.NoError(t, err)
	require.Equal(t, d2.GroupId, group.Id)
	require.Equal(t, d2.UserId, user.Id)
	require.NotZero(t, d2.CreateAt)
	require.Zero(t, d2.DeleteAt)

	// Duplicate composite key (GroupId, UserId)
	// Ensure new CreateAt > previous CreateAt for the same (groupId, userId)
	time.Sleep(2 * time.Millisecond)
	_, err = ss.Group().UpsertMember(group.Id, user.Id)
	require.NoError(t, err)

	// Invalid GroupId
	_, err = ss.Group().UpsertMember(model.NewId(), user.Id)
	require.Error(t, err)
	require.Contains(t, err.Error(), "failed to get UserGroup with")

	// Restores a deleted member
	// Ensure new CreateAt > previous CreateAt for the same (groupId, userId)
	time.Sleep(2 * time.Millisecond)
	_, err = ss.Group().UpsertMember(group.Id, user.Id)
	require.NoError(t, err)

	_, err = ss.Group().DeleteMember(group.Id, user.Id)
	require.NoError(t, err)

	groupMembers, err := ss.Group().GetMemberUsers(group.Id)
	require.NoError(t, err)
	beforeRestoreCount := len(groupMembers)

	_, err = ss.Group().UpsertMember(group.Id, user.Id)
	require.NoError(t, err)

	groupMembers, err = ss.Group().GetMemberUsers(group.Id)
	require.NoError(t, err)
	afterRestoreCount := len(groupMembers)

	require.Equal(t, beforeRestoreCount+1, afterRestoreCount)
}

func testUpsertMembers(t *testing.T, ss store.Store) {
	// Create group
	g1 := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString(model.NewId()),
	}
	group, err := ss.Group().Create(g1)
	require.NoError(t, err)

	// Create user
	u1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user, nErr := ss.User().Save(u1)
	require.NoError(t, nErr)

	// Create user
	u2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user2, nErr := ss.User().Save(u2)
	require.NoError(t, nErr)

	// Happy path
	m, err := ss.Group().UpsertMembers(group.Id, []string{user.Id, user2.Id})
	require.NoError(t, err)
	require.Equal(t, 2, len(m))

	// Duplicate composite key (GroupId, UserId)
	// Ensure new CreateAt > previous CreateAt for the same (groupId, userId)
	// time.Sleep(2 * time.Millisecond)
	_, err = ss.Group().UpsertMembers(group.Id, []string{user.Id})
	require.NoError(t, err)

	// Invalid GroupId
	_, err = ss.Group().UpsertMembers(model.NewId(), []string{user.Id})
	require.Error(t, err)
	require.Contains(t, err.Error(), "failed to get UserGroup with")

	// Restores a deleted member
	// Ensure new CreateAt > previous CreateAt for the same (groupId, userId)
	time.Sleep(2 * time.Millisecond)
	_, err = ss.Group().UpsertMembers(group.Id, []string{user.Id, user2.Id})
	require.NoError(t, err)

	_, err = ss.Group().DeleteMembers(group.Id, []string{user.Id})
	require.NoError(t, err)

	groupMembers, err := ss.Group().GetMemberUsers(group.Id)
	require.NoError(t, err)
	beforeRestoreCount := len(groupMembers)

	_, err = ss.Group().UpsertMembers(group.Id, []string{user.Id, user2.Id})
	require.NoError(t, err)

	groupMembers, err = ss.Group().GetMemberUsers(group.Id)
	require.NoError(t, err)
	afterRestoreCount := len(groupMembers)

	require.Equal(t, beforeRestoreCount+1, afterRestoreCount)
}

func testGroupDeleteMember(t *testing.T, ss store.Store) {
	// Create group
	g1 := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString(model.NewId()),
	}
	group, err := ss.Group().Create(g1)
	require.NoError(t, err)

	// Create user
	u1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user, nErr := ss.User().Save(u1)
	require.NoError(t, nErr)

	// Create member
	d1, err := ss.Group().UpsertMember(group.Id, user.Id)
	require.NoError(t, err)

	// Happy path
	d2, err := ss.Group().DeleteMember(group.Id, user.Id)
	require.NoError(t, err)
	require.Equal(t, d2.GroupId, group.Id)
	require.Equal(t, d2.UserId, user.Id)
	require.Equal(t, d2.CreateAt, d1.CreateAt)
	require.NotZero(t, d2.DeleteAt)

	// Delete an already deleted member
	_, err = ss.Group().DeleteMember(group.Id, user.Id)
	var nfErr *store.ErrNotFound
	require.True(t, errors.As(err, &nfErr))

	// Delete with non-existent User
	_, err = ss.Group().DeleteMember(group.Id, model.NewId())
	require.True(t, errors.As(err, &nfErr))

	// Delete non-existent Group
	_, err = ss.Group().DeleteMember(model.NewId(), group.Id)
	require.True(t, errors.As(err, &nfErr))
}

func testGroupDeleteMembers(t *testing.T, ss store.Store) {
	// Create user
	u1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user, nErr := ss.User().Save(u1)
	require.NoError(t, nErr)
	// Create group
	g1 := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString(model.NewId()),
	}
	guids := &model.GroupWithUserIds{
		Group:   *g1,
		UserIds: []string{user.Id},
	}
	group, err := ss.Group().CreateWithUserIds(guids)
	require.NoError(t, err)

	// Happy path
	d2, err := ss.Group().DeleteMembers(group.Id, []string{user.Id})
	require.NoError(t, err)
	require.Equal(t, d2[0].GroupId, group.Id)
	require.Equal(t, d2[0].UserId, user.Id)
	require.NotZero(t, d2[0].DeleteAt)

	// Delete an already deleted member
	_, err = ss.Group().DeleteMembers(group.Id, []string{user.Id})
	var nfErr *store.ErrNotFound
	require.True(t, errors.As(err, &nfErr))

	// Delete with non-existent User
	_, err = ss.Group().DeleteMembers(group.Id, []string{model.NewId()})
	require.True(t, errors.As(err, &nfErr))

	// Delete non-existent Group
	_, err = ss.Group().DeleteMembers(model.NewId(), []string{user.Id})
	require.True(t, errors.As(err, &nfErr))
}

func testGroupPermanentDeleteMembersByUser(t *testing.T, ss store.Store) {
	var g *model.Group
	var groups []*model.Group
	numberOfGroups := 5

	for i := 0; i < numberOfGroups; i++ {
		g = &model.Group{
			Name:        model.NewString(model.NewId()),
			DisplayName: model.NewId(),
			Source:      model.GroupSourceLdap,
			RemoteId:    model.NewString(model.NewId()),
		}
		group, err := ss.Group().Create(g)
		groups = append(groups, group)
		require.NoError(t, err)
	}

	// Create user
	u1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user, err := ss.User().Save(u1)
	require.NoError(t, err)

	// Create members
	for _, group := range groups {
		_, err = ss.Group().UpsertMember(group.Id, user.Id)
		require.NoError(t, err)
	}

	// Happy path
	err = ss.Group().PermanentDeleteMembersByUser(user.Id)
	require.NoError(t, err)
}

func testCreateGroupSyncable(t *testing.T, ss store.Store) {
	// Invalid GroupID
	_, err := ss.Group().CreateGroupSyncable(model.NewGroupTeam("x", model.NewId(), false))
	var appErr *model.AppError
	require.True(t, errors.As(err, &appErr))
	require.Equal(t, appErr.Id, "model.group_syncable.group_id.app_error")

	// Create Group
	g1 := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString(model.NewId()),
	}
	group, err := ss.Group().Create(g1)
	require.NoError(t, err)

	// Create Team
	t1 := &model.Team{
		DisplayName:     "Name",
		Description:     "Some description",
		CompanyName:     "Some company name",
		AllowOpenInvite: false,
		InviteId:        "inviteid0",
		Name:            "z-z-" + model.NewId() + "a",
		Email:           "success+" + model.NewId() + "@simulator.amazonses.com",
		Type:            model.TeamOpen,
	}
	team, nErr := ss.Team().Save(t1)
	require.NoError(t, nErr)

	// New GroupSyncable, happy path
	gt1 := model.NewGroupTeam(group.Id, team.Id, false)
	d1, err := ss.Group().CreateGroupSyncable(gt1)
	require.NoError(t, err)
	require.Equal(t, gt1.SyncableId, d1.SyncableId)
	require.Equal(t, gt1.GroupId, d1.GroupId)
	require.Equal(t, gt1.AutoAdd, d1.AutoAdd)
	require.NotZero(t, d1.CreateAt)
	require.Zero(t, d1.DeleteAt)
}

func testGetGroupSyncable(t *testing.T, ss store.Store) {
	// Create a group
	g1 := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString(model.NewId()),
	}
	group, err := ss.Group().Create(g1)
	require.NoError(t, err)

	// Create Team
	t1 := &model.Team{
		DisplayName:     "Name",
		Description:     "Some description",
		CompanyName:     "Some company name",
		AllowOpenInvite: false,
		InviteId:        "inviteid0",
		Name:            "z-z-" + model.NewId() + "a",
		Email:           "success+" + model.NewId() + "@simulator.amazonses.com",
		Type:            model.TeamOpen,
	}
	team, nErr := ss.Team().Save(t1)
	require.NoError(t, nErr)

	// Create GroupSyncable
	gt1 := model.NewGroupTeam(group.Id, team.Id, false)
	groupTeam, err := ss.Group().CreateGroupSyncable(gt1)
	require.NoError(t, err)

	// Get GroupSyncable
	dgt, err := ss.Group().GetGroupSyncable(groupTeam.GroupId, groupTeam.SyncableId, model.GroupSyncableTypeTeam)
	require.NoError(t, err)
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
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString(model.NewId()),
	}
	group, err := ss.Group().Create(g)
	require.NoError(t, err)

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
			Type:            model.TeamOpen,
		}
		var team *model.Team
		team, nErr := ss.Team().Save(t1)
		require.NoError(t, nErr)

		// create groupteam
		var groupTeam *model.GroupSyncable
		gt := model.NewGroupTeam(group.Id, team.Id, false)
		gt.SchemeAdmin = true
		groupTeam, err = ss.Group().CreateGroupSyncable(gt)
		require.NoError(t, err)
		groupTeams = append(groupTeams, groupTeam)
	}

	// Returns all the group teams
	d1, err := ss.Group().GetAllGroupSyncablesByGroupId(group.Id, model.GroupSyncableTypeTeam)
	require.NoError(t, err)
	require.Condition(t, func() bool { return len(d1) >= numGroupSyncables }, len(d1), ">=", numGroupSyncables)
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
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString(model.NewId()),
	}
	group, err := ss.Group().Create(g1)
	require.NoError(t, err)

	// Create Team
	t1 := &model.Team{
		DisplayName:     "Name",
		Description:     "Some description",
		CompanyName:     "Some company name",
		AllowOpenInvite: false,
		InviteId:        "inviteid0",
		Name:            "z-z-" + model.NewId() + "a",
		Email:           "success+" + model.NewId() + "@simulator.amazonses.com",
		Type:            model.TeamOpen,
	}
	team, nErr := ss.Team().Save(t1)
	require.NoError(t, nErr)

	// New GroupSyncable, happy path
	gt1 := model.NewGroupTeam(group.Id, team.Id, false)
	d1, err := ss.Group().CreateGroupSyncable(gt1)
	require.NoError(t, err)

	// Update existing group team
	gt1.AutoAdd = true
	d2, err := ss.Group().UpdateGroupSyncable(gt1)
	require.NoError(t, err)
	require.True(t, d2.AutoAdd)

	// Non-existent Group
	gt2 := model.NewGroupTeam(model.NewId(), team.Id, false)
	_, err = ss.Group().UpdateGroupSyncable(gt2)
	var nfErr *store.ErrNotFound
	require.True(t, errors.As(err, &nfErr))

	// Non-existent Team
	gt3 := model.NewGroupTeam(group.Id, model.NewId(), false)
	_, err = ss.Group().UpdateGroupSyncable(gt3)
	require.True(t, errors.As(err, &nfErr))

	// Cannot update CreateAt or DeleteAt
	origCreateAt := d1.CreateAt
	d1.CreateAt = model.GetMillis()
	d1.AutoAdd = true
	d3, err := ss.Group().UpdateGroupSyncable(d1)
	require.NoError(t, err)
	require.Equal(t, origCreateAt, d3.CreateAt)

	// Cannot update DeleteAt to arbitrary value
	d1.DeleteAt = 1
	_, err = ss.Group().UpdateGroupSyncable(d1)
	require.Error(t, err)
	require.Contains(t, err.Error(), "DeleteAt should be 0 when updating")

	// Can update DeleteAt to 0
	d1.DeleteAt = 0
	d4, err := ss.Group().UpdateGroupSyncable(d1)
	require.NoError(t, err)
	require.Zero(t, d4.DeleteAt)
}

func testDeleteGroupSyncable(t *testing.T, ss store.Store) {
	// Create Group
	g1 := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString(model.NewId()),
	}
	group, err := ss.Group().Create(g1)
	require.NoError(t, err)

	// Create Team
	t1 := &model.Team{
		DisplayName:     "Name",
		Description:     "Some description",
		CompanyName:     "Some company name",
		AllowOpenInvite: false,
		InviteId:        "inviteid0",
		Name:            "z-z-" + model.NewId() + "a",
		Email:           "success+" + model.NewId() + "@simulator.amazonses.com",
		Type:            model.TeamOpen,
	}
	team, nErr := ss.Team().Save(t1)
	require.NoError(t, nErr)

	// Create GroupSyncable
	gt1 := model.NewGroupTeam(group.Id, team.Id, false)
	groupTeam, err := ss.Group().CreateGroupSyncable(gt1)
	require.NoError(t, err)

	// Non-existent Group
	_, err = ss.Group().DeleteGroupSyncable(model.NewId(), groupTeam.SyncableId, model.GroupSyncableTypeTeam)
	var nfErr *store.ErrNotFound
	require.True(t, errors.As(err, &nfErr))

	// Non-existent Team
	_, err = ss.Group().DeleteGroupSyncable(groupTeam.GroupId, model.NewId(), model.GroupSyncableTypeTeam)
	require.True(t, errors.As(err, &nfErr))

	// Happy path...
	d1, err := ss.Group().DeleteGroupSyncable(groupTeam.GroupId, groupTeam.SyncableId, model.GroupSyncableTypeTeam)
	require.NoError(t, err)
	require.NotZero(t, d1.DeleteAt)
	require.Equal(t, d1.GroupId, groupTeam.GroupId)
	require.Equal(t, d1.SyncableId, groupTeam.SyncableId)
	require.Equal(t, d1.AutoAdd, groupTeam.AutoAdd)
	require.Equal(t, d1.CreateAt, groupTeam.CreateAt)
	require.Condition(t, func() bool { return d1.UpdateAt >= groupTeam.UpdateAt }, d1.UpdateAt, ">=", groupTeam.UpdateAt)

	// Record already deleted
	_, err = ss.Group().DeleteGroupSyncable(d1.GroupId, d1.SyncableId, d1.Type)
	require.Error(t, err)
	var invErr *store.ErrInvalidInput
	require.True(t, errors.As(err, &invErr))
}

func testTeamMembersToAdd(t *testing.T, ss store.Store) {
	// Create Group
	group, err := ss.Group().Create(&model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: "TeamMembersToAdd Test Group",
		RemoteId:    model.NewString(model.NewId()),
		Source:      model.GroupSourceLdap,
	})
	require.NoError(t, err)

	// Create User
	user := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user, nErr := ss.User().Save(user)
	require.NoError(t, nErr)

	// Create GroupMember
	_, err = ss.Group().UpsertMember(group.Id, user.Id)
	require.NoError(t, err)

	// Create Team
	team := &model.Team{
		DisplayName:     "Name",
		Description:     "Some description",
		CompanyName:     "Some company name",
		AllowOpenInvite: false,
		InviteId:        "inviteid0",
		Name:            "z-z-" + model.NewId() + "a",
		Email:           "success+" + model.NewId() + "@simulator.amazonses.com",
		Type:            model.TeamOpen,
	}
	team, nErr = ss.Team().Save(team)
	require.NoError(t, nErr)

	// Create GroupTeam
	syncable, err := ss.Group().CreateGroupSyncable(model.NewGroupTeam(group.Id, team.Id, true))
	require.NoError(t, err)

	// Time before syncable was created
	teamMembers, err := ss.Group().TeamMembersToAdd(syncable.CreateAt-1, nil, false)
	require.NoError(t, err)
	require.Len(t, teamMembers, 1)
	require.Equal(t, user.Id, teamMembers[0].UserID)
	require.Equal(t, team.Id, teamMembers[0].TeamID)

	// Time after syncable was created
	teamMembers, err = ss.Group().TeamMembersToAdd(syncable.CreateAt+1, nil, false)
	require.NoError(t, err)
	require.Empty(t, teamMembers)

	// Delete and restore GroupMember should return result
	_, err = ss.Group().DeleteMember(group.Id, user.Id)
	require.NoError(t, err)
	_, err = ss.Group().UpsertMember(group.Id, user.Id)
	require.NoError(t, err)
	teamMembers, err = ss.Group().TeamMembersToAdd(syncable.CreateAt+1, nil, false)
	require.NoError(t, err)
	require.Len(t, teamMembers, 1)

	pristineSyncable := *syncable

	_, err = ss.Group().UpdateGroupSyncable(syncable)
	require.NoError(t, err)

	// Time before syncable was updated
	teamMembers, err = ss.Group().TeamMembersToAdd(syncable.UpdateAt-1, nil, false)
	require.NoError(t, err)
	require.Len(t, teamMembers, 1)
	require.Equal(t, user.Id, teamMembers[0].UserID)
	require.Equal(t, team.Id, teamMembers[0].TeamID)

	// Time after syncable was updated
	teamMembers, err = ss.Group().TeamMembersToAdd(syncable.UpdateAt+1, nil, false)
	require.NoError(t, err)
	require.Empty(t, teamMembers)

	// Only includes if auto-add
	syncable.AutoAdd = false
	_, err = ss.Group().UpdateGroupSyncable(syncable)
	require.NoError(t, err)
	teamMembers, err = ss.Group().TeamMembersToAdd(0, nil, false)
	require.NoError(t, err)
	require.Empty(t, teamMembers)

	// reset state of syncable and verify
	_, err = ss.Group().UpdateGroupSyncable(&pristineSyncable)
	require.NoError(t, err)
	teamMembers, err = ss.Group().TeamMembersToAdd(0, nil, false)
	require.NoError(t, err)
	require.Len(t, teamMembers, 1)

	// No result if Group deleted
	_, err = ss.Group().Delete(group.Id)
	require.NoError(t, err)
	teamMembers, err = ss.Group().TeamMembersToAdd(0, nil, false)
	require.NoError(t, err)
	require.Empty(t, teamMembers)

	// reset state of group and verify
	group.DeleteAt = 0
	_, err = ss.Group().Update(group)
	require.NoError(t, err)
	teamMembers, err = ss.Group().TeamMembersToAdd(0, nil, false)
	require.NoError(t, err)
	require.Len(t, teamMembers, 1)

	// No result if Team deleted
	team.DeleteAt = model.GetMillis()
	team, nErr = ss.Team().Update(team)
	require.NoError(t, nErr)
	teamMembers, err = ss.Group().TeamMembersToAdd(0, nil, false)
	require.NoError(t, err)
	require.Empty(t, teamMembers)

	// reset state of team and verify
	team.DeleteAt = 0
	team, nErr = ss.Team().Update(team)
	require.NoError(t, nErr)
	teamMembers, err = ss.Group().TeamMembersToAdd(0, nil, false)
	require.NoError(t, err)
	require.Len(t, teamMembers, 1)

	// No result if GroupTeam deleted
	_, err = ss.Group().DeleteGroupSyncable(group.Id, team.Id, model.GroupSyncableTypeTeam)
	require.NoError(t, err)
	teamMembers, err = ss.Group().TeamMembersToAdd(0, nil, false)
	require.NoError(t, err)
	require.Empty(t, teamMembers)

	// reset GroupTeam and verify
	_, err = ss.Group().UpdateGroupSyncable(&pristineSyncable)
	require.NoError(t, err)
	teamMembers, err = ss.Group().TeamMembersToAdd(0, nil, false)
	require.NoError(t, err)
	require.Len(t, teamMembers, 1)

	// No result if GroupMember deleted
	_, err = ss.Group().DeleteMember(group.Id, user.Id)
	require.NoError(t, err)
	teamMembers, err = ss.Group().TeamMembersToAdd(0, nil, false)
	require.NoError(t, err)
	require.Empty(t, teamMembers)

	// restore group member and verify
	_, err = ss.Group().UpsertMember(group.Id, user.Id)
	require.NoError(t, err)
	teamMembers, err = ss.Group().TeamMembersToAdd(0, nil, false)
	require.NoError(t, err)
	require.Len(t, teamMembers, 1)

	// adding team membership stops returning result
	_, nErr = ss.Team().SaveMember(&model.TeamMember{
		TeamId: team.Id,
		UserId: user.Id,
	}, 999)
	require.NoError(t, nErr)
	teamMembers, err = ss.Group().TeamMembersToAdd(0, nil, false)
	require.NoError(t, err)
	require.Empty(t, teamMembers)

	// Leaving Team should still not return result
	_, nErr = ss.Team().UpdateMember(&model.TeamMember{
		TeamId:   team.Id,
		UserId:   user.Id,
		DeleteAt: model.GetMillis(),
	})
	require.NoError(t, nErr)
	teamMembers, err = ss.Group().TeamMembersToAdd(0, nil, false)
	require.NoError(t, err)
	require.Empty(t, teamMembers)

	// If includeRemovedMembers is set to true, removed members should be added back in
	teamMembers, err = ss.Group().TeamMembersToAdd(0, nil, true)
	require.NoError(t, err)
	require.Len(t, teamMembers, 1)
}

func testTeamMembersToAddSingleTeam(t *testing.T, ss store.Store) {
	group1, err := ss.Group().Create(&model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: "TeamMembersToAdd Test Group",
		RemoteId:    model.NewString(model.NewId()),
		Source:      model.GroupSourceLdap,
	})
	require.NoError(t, err)

	group2, err := ss.Group().Create(&model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: "TeamMembersToAdd Test Group",
		RemoteId:    model.NewString(model.NewId()),
		Source:      model.GroupSourceLdap,
	})
	require.NoError(t, err)

	user1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user1, nErr := ss.User().Save(user1)
	require.NoError(t, nErr)

	user2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user2, nErr = ss.User().Save(user2)
	require.NoError(t, nErr)

	user3 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user3, nErr = ss.User().Save(user3)
	require.NoError(t, nErr)

	for _, user := range []*model.User{user1, user2} {
		_, err = ss.Group().UpsertMember(group1.Id, user.Id)
		require.NoError(t, err)
	}
	_, err = ss.Group().UpsertMember(group2.Id, user3.Id)
	require.NoError(t, err)

	team1 := &model.Team{
		DisplayName:     "Name",
		Description:     "Some description",
		CompanyName:     "Some company name",
		AllowOpenInvite: false,
		InviteId:        "inviteid0",
		Name:            "z-z-" + model.NewId() + "a",
		Email:           "success+" + model.NewId() + "@simulator.amazonses.com",
		Type:            model.TeamOpen,
	}
	team1, nErr = ss.Team().Save(team1)
	require.NoError(t, nErr)

	team2 := &model.Team{
		DisplayName:     "Name",
		Description:     "Some description",
		CompanyName:     "Some company name",
		AllowOpenInvite: false,
		InviteId:        "inviteid0",
		Name:            "z-z-" + model.NewId() + "a",
		Email:           "success+" + model.NewId() + "@simulator.amazonses.com",
		Type:            model.TeamOpen,
	}
	team2, nErr = ss.Team().Save(team2)
	require.NoError(t, nErr)

	_, err = ss.Group().CreateGroupSyncable(model.NewGroupTeam(group1.Id, team1.Id, true))
	require.NoError(t, err)

	_, err = ss.Group().CreateGroupSyncable(model.NewGroupTeam(group2.Id, team2.Id, true))
	require.NoError(t, err)

	teamMembers, err := ss.Group().TeamMembersToAdd(0, nil, false)
	require.NoError(t, err)
	require.Len(t, teamMembers, 3)

	teamMembers, err = ss.Group().TeamMembersToAdd(0, &team1.Id, false)
	require.NoError(t, err)
	require.Len(t, teamMembers, 2)

	teamMembers, err = ss.Group().TeamMembersToAdd(0, &team2.Id, false)
	require.NoError(t, err)
	require.Len(t, teamMembers, 1)
}

func testChannelMembersToAdd(t *testing.T, ss store.Store) {
	// Create Group
	group, err := ss.Group().Create(&model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: "ChannelMembersToAdd Test Group",
		RemoteId:    model.NewString(model.NewId()),
		Source:      model.GroupSourceLdap,
	})
	require.NoError(t, err)

	// Create User
	user := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user, nErr := ss.User().Save(user)
	require.NoError(t, nErr)

	// Create GroupMember
	_, err = ss.Group().UpsertMember(group.Id, user.Id)
	require.NoError(t, err)

	// Create Channel
	channel := &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "A Name",
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen, // Query does not look at type so this shouldn't matter.
	}
	channel, nErr = ss.Channel().Save(channel, 9999)
	require.NoError(t, nErr)

	// Create GroupChannel
	syncable, err := ss.Group().CreateGroupSyncable(model.NewGroupChannel(group.Id, channel.Id, true))
	require.NoError(t, err)

	// Time before syncable was created
	channelMembers, err := ss.Group().ChannelMembersToAdd(syncable.CreateAt-1, nil, false)
	require.NoError(t, err)
	require.Len(t, channelMembers, 1)
	require.Equal(t, user.Id, channelMembers[0].UserID)
	require.Equal(t, channel.Id, channelMembers[0].ChannelID)

	// Time after syncable was created
	channelMembers, err = ss.Group().ChannelMembersToAdd(syncable.CreateAt+1, nil, false)
	require.NoError(t, err)
	require.Empty(t, channelMembers)

	// Delete and restore GroupMember should return result
	_, err = ss.Group().DeleteMember(group.Id, user.Id)
	require.NoError(t, err)
	_, err = ss.Group().UpsertMember(group.Id, user.Id)
	require.NoError(t, err)
	channelMembers, err = ss.Group().ChannelMembersToAdd(syncable.CreateAt+1, nil, false)
	require.NoError(t, err)
	require.Len(t, channelMembers, 1)

	pristineSyncable := *syncable

	_, err = ss.Group().UpdateGroupSyncable(syncable)
	require.NoError(t, err)

	// Time before syncable was updated
	channelMembers, err = ss.Group().ChannelMembersToAdd(syncable.UpdateAt-1, nil, false)
	require.NoError(t, err)
	require.Len(t, channelMembers, 1)
	require.Equal(t, user.Id, channelMembers[0].UserID)
	require.Equal(t, channel.Id, channelMembers[0].ChannelID)

	// Time after syncable was updated
	channelMembers, err = ss.Group().ChannelMembersToAdd(syncable.UpdateAt+1, nil, false)
	require.NoError(t, err)
	require.Empty(t, channelMembers)

	// Only includes if auto-add
	syncable.AutoAdd = false
	_, err = ss.Group().UpdateGroupSyncable(syncable)
	require.NoError(t, err)
	channelMembers, err = ss.Group().ChannelMembersToAdd(0, nil, false)
	require.NoError(t, err)
	require.Empty(t, channelMembers)

	// reset state of syncable and verify
	_, err = ss.Group().UpdateGroupSyncable(&pristineSyncable)
	require.NoError(t, err)
	channelMembers, err = ss.Group().ChannelMembersToAdd(0, nil, false)
	require.NoError(t, err)
	require.Len(t, channelMembers, 1)

	// No result if Group deleted
	_, err = ss.Group().Delete(group.Id)
	require.NoError(t, err)
	channelMembers, err = ss.Group().ChannelMembersToAdd(0, nil, false)
	require.NoError(t, err)
	require.Empty(t, channelMembers)

	// reset state of group and verify
	group.DeleteAt = 0
	_, err = ss.Group().Update(group)
	require.NoError(t, err)
	channelMembers, err = ss.Group().ChannelMembersToAdd(0, nil, false)
	require.NoError(t, err)
	require.Len(t, channelMembers, 1)

	// No result if Channel deleted
	nErr = ss.Channel().Delete(channel.Id, model.GetMillis())
	require.NoError(t, nErr)
	channelMembers, err = ss.Group().ChannelMembersToAdd(0, nil, false)
	require.NoError(t, err)
	require.Empty(t, channelMembers)

	// reset state of channel and verify
	channel.DeleteAt = 0
	_, nErr = ss.Channel().Update(channel)
	require.NoError(t, nErr)
	channelMembers, err = ss.Group().ChannelMembersToAdd(0, nil, false)
	require.NoError(t, err)
	require.Len(t, channelMembers, 1)

	// No result if GroupChannel deleted
	_, err = ss.Group().DeleteGroupSyncable(group.Id, channel.Id, model.GroupSyncableTypeChannel)
	require.NoError(t, err)
	channelMembers, err = ss.Group().ChannelMembersToAdd(0, nil, false)
	require.NoError(t, err)
	require.Empty(t, channelMembers)

	// reset GroupChannel and verify
	_, err = ss.Group().UpdateGroupSyncable(&pristineSyncable)
	require.NoError(t, err)
	channelMembers, err = ss.Group().ChannelMembersToAdd(0, nil, false)
	require.NoError(t, err)
	require.Len(t, channelMembers, 1)

	// No result if GroupMember deleted
	_, err = ss.Group().DeleteMember(group.Id, user.Id)
	require.NoError(t, err)
	channelMembers, err = ss.Group().ChannelMembersToAdd(0, nil, false)
	require.NoError(t, err)
	require.Empty(t, channelMembers)

	// restore group member and verify
	_, err = ss.Group().UpsertMember(group.Id, user.Id)
	require.NoError(t, err)
	channelMembers, err = ss.Group().ChannelMembersToAdd(0, nil, false)
	require.NoError(t, err)
	require.Len(t, channelMembers, 1)

	// Adding Channel (ChannelMemberHistory) should stop returning result
	nErr = ss.ChannelMemberHistory().LogJoinEvent(user.Id, channel.Id, model.GetMillis())
	require.NoError(t, nErr)
	channelMembers, err = ss.Group().ChannelMembersToAdd(0, nil, false)
	require.NoError(t, err)
	require.Empty(t, channelMembers)

	// Leaving Channel (ChannelMemberHistory) should still not return result
	nErr = ss.ChannelMemberHistory().LogLeaveEvent(user.Id, channel.Id, model.GetMillis())
	require.NoError(t, nErr)
	channelMembers, err = ss.Group().ChannelMembersToAdd(0, nil, false)
	require.NoError(t, err)
	require.Empty(t, channelMembers)

	// Purging ChannelMemberHistory re-returns the result
	_, _, nErr = ss.ChannelMemberHistory().PermanentDeleteBatchForRetentionPolicies(
		0, model.GetMillis()+1, 100, model.RetentionPolicyCursor{})
	require.NoError(t, nErr)
	channelMembers, err = ss.Group().ChannelMembersToAdd(0, nil, false)
	require.NoError(t, err)
	require.Len(t, channelMembers, 1)

	// If includeRemovedMembers is set to true, removed members should be added back in
	nErr = ss.ChannelMemberHistory().LogLeaveEvent(user.Id, channel.Id, model.GetMillis())
	require.NoError(t, nErr)
	channelMembers, err = ss.Group().ChannelMembersToAdd(0, nil, true)
	require.NoError(t, err)
	require.Len(t, channelMembers, 1)
}

func testChannelMembersToAddSingleChannel(t *testing.T, ss store.Store) {
	group1, err := ss.Group().Create(&model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: "TeamMembersToAdd Test Group",
		RemoteId:    model.NewString(model.NewId()),
		Source:      model.GroupSourceLdap,
	})
	require.NoError(t, err)

	group2, err := ss.Group().Create(&model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: "TeamMembersToAdd Test Group",
		RemoteId:    model.NewString(model.NewId()),
		Source:      model.GroupSourceLdap,
	})
	require.NoError(t, err)

	user1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user1, nErr := ss.User().Save(user1)
	require.NoError(t, nErr)

	user2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user2, nErr = ss.User().Save(user2)
	require.NoError(t, nErr)

	user3 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user3, nErr = ss.User().Save(user3)
	require.NoError(t, nErr)

	for _, user := range []*model.User{user1, user2} {
		_, err = ss.Group().UpsertMember(group1.Id, user.Id)
		require.NoError(t, err)
	}
	_, err = ss.Group().UpsertMember(group2.Id, user3.Id)
	require.NoError(t, err)

	channel1 := &model.Channel{
		DisplayName: "Name",
		Name:        "z-z-" + model.NewId() + "a",
		Type:        model.ChannelTypeOpen,
	}
	channel1, nErr = ss.Channel().Save(channel1, 999)
	require.NoError(t, nErr)

	channel2 := &model.Channel{
		DisplayName: "Name",
		Name:        "z-z-" + model.NewId() + "a",
		Type:        model.ChannelTypeOpen,
	}
	channel2, nErr = ss.Channel().Save(channel2, 999)
	require.NoError(t, nErr)

	_, err = ss.Group().CreateGroupSyncable(model.NewGroupChannel(group1.Id, channel1.Id, true))
	require.NoError(t, err)

	_, err = ss.Group().CreateGroupSyncable(model.NewGroupChannel(group2.Id, channel2.Id, true))
	require.NoError(t, err)

	channelMembers, err := ss.Group().ChannelMembersToAdd(0, nil, false)
	require.NoError(t, err)
	require.GreaterOrEqual(t, len(channelMembers), 3)

	channelMembers, err = ss.Group().ChannelMembersToAdd(0, &channel1.Id, false)
	require.NoError(t, err)
	require.Len(t, channelMembers, 2)

	channelMembers, err = ss.Group().ChannelMembersToAdd(0, &channel2.Id, false)
	require.NoError(t, err)
	require.Len(t, channelMembers, 1)
}

func testTeamMembersToRemove(t *testing.T, ss store.Store) {
	data := pendingMemberRemovalsDataSetup(t, ss)

	// one result when both users are in the group (for user C)
	teamMembers, err := ss.Group().TeamMembersToRemove(nil)
	require.NoError(t, err)
	require.Len(t, teamMembers, 1)
	require.Equal(t, data.UserC.Id, teamMembers[0].UserId)

	_, err = ss.Group().DeleteMember(data.Group.Id, data.UserB.Id)
	require.NoError(t, err)

	// user b and c should now be returned
	teamMembers, err = ss.Group().TeamMembersToRemove(nil)
	require.NoError(t, err)
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
	require.NoError(t, err)

	teamMembers, err = ss.Group().TeamMembersToRemove(nil)
	require.NoError(t, err)
	require.Len(t, teamMembers, 3)

	// Make one of them a bot
	teamMembers, err = ss.Group().TeamMembersToRemove(nil)
	require.NoError(t, err)
	teamMember := teamMembers[0]
	bot := &model.Bot{
		UserId:      teamMember.UserId,
		Username:    "un_" + model.NewId(),
		DisplayName: "dn_" + model.NewId(),
		OwnerId:     teamMember.UserId,
	}
	bot, nErr := ss.Bot().Save(bot)
	require.NoError(t, nErr)

	// verify that bot is not returned in results
	teamMembers, err = ss.Group().TeamMembersToRemove(nil)
	require.NoError(t, err)
	require.Len(t, teamMembers, 2)

	// delete the bot
	nErr = ss.Bot().PermanentDelete(bot.UserId)
	require.NoError(t, nErr)

	// Should be back to 3 users
	teamMembers, err = ss.Group().TeamMembersToRemove(nil)
	require.NoError(t, err)
	require.Len(t, teamMembers, 3)

	// add users back to groups
	res := ss.Team().RemoveMember(data.ConstrainedTeam.Id, data.UserA.Id)
	require.NoError(t, res)
	res = ss.Team().RemoveMember(data.ConstrainedTeam.Id, data.UserB.Id)
	require.NoError(t, res)
	res = ss.Team().RemoveMember(data.ConstrainedTeam.Id, data.UserC.Id)
	require.NoError(t, res)
	nErr = ss.Channel().RemoveMember(data.ConstrainedChannel.Id, data.UserA.Id)
	require.NoError(t, nErr)
	nErr = ss.Channel().RemoveMember(data.ConstrainedChannel.Id, data.UserB.Id)
	require.NoError(t, nErr)
	nErr = ss.Channel().RemoveMember(data.ConstrainedChannel.Id, data.UserC.Id)
	require.NoError(t, nErr)
}

func testTeamMembersToRemoveSingleTeam(t *testing.T, ss store.Store) {
	user1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user1, err := ss.User().Save(user1)
	require.NoError(t, err)

	user2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user2, err = ss.User().Save(user2)
	require.NoError(t, err)

	user3 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user3, err = ss.User().Save(user3)
	require.NoError(t, err)

	team1 := &model.Team{
		DisplayName:      "Name",
		Description:      "Some description",
		CompanyName:      "Some company name",
		AllowOpenInvite:  false,
		InviteId:         "inviteid0",
		Name:             "z-z-" + model.NewId() + "a",
		Email:            "success+" + model.NewId() + "@simulator.amazonses.com",
		Type:             model.TeamOpen,
		GroupConstrained: model.NewBool(true),
	}
	team1, nErr := ss.Team().Save(team1)
	require.NoError(t, nErr)

	team2 := &model.Team{
		DisplayName:      "Name",
		Description:      "Some description",
		CompanyName:      "Some company name",
		AllowOpenInvite:  false,
		InviteId:         "inviteid0",
		Name:             "z-z-" + model.NewId() + "a",
		Email:            "success+" + model.NewId() + "@simulator.amazonses.com",
		Type:             model.TeamOpen,
		GroupConstrained: model.NewBool(true),
	}
	team2, nErr = ss.Team().Save(team2)
	require.NoError(t, nErr)

	for _, user := range []*model.User{user1, user2} {
		_, nErr = ss.Team().SaveMember(&model.TeamMember{
			TeamId: team1.Id,
			UserId: user.Id,
		}, 999)
		require.NoError(t, nErr)
	}

	_, nErr = ss.Team().SaveMember(&model.TeamMember{
		TeamId: team2.Id,
		UserId: user3.Id,
	}, 999)
	require.NoError(t, nErr)

	teamMembers, err := ss.Group().TeamMembersToRemove(nil)
	require.NoError(t, err)
	require.Len(t, teamMembers, 3)

	teamMembers, err = ss.Group().TeamMembersToRemove(&team1.Id)
	require.NoError(t, err)
	require.Len(t, teamMembers, 2)

	teamMembers, err = ss.Group().TeamMembersToRemove(&team2.Id)
	require.NoError(t, err)
	require.Len(t, teamMembers, 1)
}

func testChannelMembersToRemove(t *testing.T, ss store.Store) {
	data := pendingMemberRemovalsDataSetup(t, ss)

	// one result when both users are in the group (for user C)
	channelMembers, err := ss.Group().ChannelMembersToRemove(nil)
	require.NoError(t, err)
	require.Len(t, channelMembers, 1)
	require.Equal(t, data.UserC.Id, channelMembers[0].UserId)

	_, err = ss.Group().DeleteMember(data.Group.Id, data.UserB.Id)
	require.NoError(t, err)

	// user b and c should now be returned
	channelMembers, err = ss.Group().ChannelMembersToRemove(nil)
	require.NoError(t, err)
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
	require.NoError(t, err)

	channelMembers, err = ss.Group().ChannelMembersToRemove(nil)
	require.NoError(t, err)
	require.Len(t, channelMembers, 3)

	// Make one of them a bot
	channelMembers, err = ss.Group().ChannelMembersToRemove(nil)
	require.NoError(t, err)
	channelMember := channelMembers[0]
	bot := &model.Bot{
		UserId:      channelMember.UserId,
		Username:    "un_" + model.NewId(),
		DisplayName: "dn_" + model.NewId(),
		OwnerId:     channelMember.UserId,
	}
	bot, nErr := ss.Bot().Save(bot)
	require.NoError(t, nErr)

	// verify that bot is not returned in results
	channelMembers, err = ss.Group().ChannelMembersToRemove(nil)
	require.NoError(t, err)
	require.Len(t, channelMembers, 2)

	// delete the bot
	nErr = ss.Bot().PermanentDelete(bot.UserId)
	require.NoError(t, nErr)

	// Should be back to 3 users
	channelMembers, err = ss.Group().ChannelMembersToRemove(nil)
	require.NoError(t, err)
	require.Len(t, channelMembers, 3)

	// add users back to groups
	res := ss.Team().RemoveMember(data.ConstrainedTeam.Id, data.UserA.Id)
	require.NoError(t, res)
	res = ss.Team().RemoveMember(data.ConstrainedTeam.Id, data.UserB.Id)
	require.NoError(t, res)
	res = ss.Team().RemoveMember(data.ConstrainedTeam.Id, data.UserC.Id)
	require.NoError(t, res)
	nErr = ss.Channel().RemoveMember(data.ConstrainedChannel.Id, data.UserA.Id)
	require.NoError(t, nErr)
	nErr = ss.Channel().RemoveMember(data.ConstrainedChannel.Id, data.UserB.Id)
	require.NoError(t, nErr)
	nErr = ss.Channel().RemoveMember(data.ConstrainedChannel.Id, data.UserC.Id)
	require.NoError(t, nErr)
}

func testChannelMembersToRemoveSingleChannel(t *testing.T, ss store.Store) {
	user1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user1, err := ss.User().Save(user1)
	require.NoError(t, err)

	user2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user2, err = ss.User().Save(user2)
	require.NoError(t, err)

	user3 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user3, err = ss.User().Save(user3)
	require.NoError(t, err)

	channel1 := &model.Channel{
		DisplayName:      "Name",
		Name:             "z-z-" + model.NewId() + "a",
		Type:             model.ChannelTypeOpen,
		GroupConstrained: model.NewBool(true),
	}
	channel1, nErr := ss.Channel().Save(channel1, 999)
	require.NoError(t, nErr)

	channel2 := &model.Channel{
		DisplayName:      "Name",
		Name:             "z-z-" + model.NewId() + "a",
		Type:             model.ChannelTypeOpen,
		GroupConstrained: model.NewBool(true),
	}
	channel2, nErr = ss.Channel().Save(channel2, 999)
	require.NoError(t, nErr)

	for _, user := range []*model.User{user1, user2} {
		_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
			ChannelId:   channel1.Id,
			UserId:      user.Id,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		})
		require.NoError(t, nErr)
	}

	_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   channel2.Id,
		UserId:      user3.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.NoError(t, nErr)

	channelMembers, err := ss.Group().ChannelMembersToRemove(nil)
	require.NoError(t, err)
	require.Len(t, channelMembers, 3)

	channelMembers, err = ss.Group().ChannelMembersToRemove(&channel1.Id)
	require.NoError(t, err)
	require.Len(t, channelMembers, 2)

	channelMembers, err = ss.Group().ChannelMembersToRemove(&channel2.Id)
	require.NoError(t, err)
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
		Name:        model.NewString(model.NewId()),
		DisplayName: "Pending[Channel|Team]MemberRemovals Test Group",
		RemoteId:    model.NewString(model.NewId()),
		Source:      model.GroupSourceLdap,
	})
	require.NoError(t, err)

	// create users
	// userA will get removed from the group
	userA := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	userA, nErr := ss.User().Save(userA)
	require.NoError(t, nErr)

	// userB will not get removed from the group
	userB := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	userB, nErr = ss.User().Save(userB)
	require.NoError(t, nErr)

	// userC was never in the group
	userC := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	userC, nErr = ss.User().Save(userC)
	require.NoError(t, nErr)

	// add users to group (but not userC)
	_, err = ss.Group().UpsertMember(group.Id, userA.Id)
	require.NoError(t, err)

	_, err = ss.Group().UpsertMember(group.Id, userB.Id)
	require.NoError(t, err)

	// create channels
	channelConstrained := &model.Channel{
		TeamId:           model.NewId(),
		DisplayName:      "A Name",
		Name:             model.NewId(),
		Type:             model.ChannelTypePrivate,
		GroupConstrained: model.NewBool(true),
	}
	channelConstrained, nErr = ss.Channel().Save(channelConstrained, 9999)
	require.NoError(t, nErr)

	channelUnconstrained := &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "A Name",
		Name:        model.NewId(),
		Type:        model.ChannelTypePrivate,
	}
	channelUnconstrained, nErr = ss.Channel().Save(channelUnconstrained, 9999)
	require.NoError(t, nErr)

	// create teams
	teamConstrained := &model.Team{
		DisplayName:      "Name",
		Description:      "Some description",
		CompanyName:      "Some company name",
		AllowOpenInvite:  false,
		InviteId:         "inviteid0",
		Name:             "z-z-" + model.NewId() + "a",
		Email:            "success+" + model.NewId() + "@simulator.amazonses.com",
		Type:             model.TeamInvite,
		GroupConstrained: model.NewBool(true),
	}
	teamConstrained, nErr = ss.Team().Save(teamConstrained)
	require.NoError(t, nErr)

	teamUnconstrained := &model.Team{
		DisplayName:     "Name",
		Description:     "Some description",
		CompanyName:     "Some company name",
		AllowOpenInvite: false,
		InviteId:        "inviteid1",
		Name:            "z-z-" + model.NewId() + "a",
		Email:           "success+" + model.NewId() + "@simulator.amazonses.com",
		Type:            model.TeamInvite,
	}
	teamUnconstrained, nErr = ss.Team().Save(teamUnconstrained)
	require.NoError(t, nErr)

	// create groupteams
	_, err = ss.Group().CreateGroupSyncable(model.NewGroupTeam(group.Id, teamConstrained.Id, true))
	require.NoError(t, err)

	_, err = ss.Group().CreateGroupSyncable(model.NewGroupTeam(group.Id, teamUnconstrained.Id, true))
	require.NoError(t, err)

	// create groupchannels
	_, err = ss.Group().CreateGroupSyncable(model.NewGroupChannel(group.Id, channelConstrained.Id, true))
	require.NoError(t, err)

	_, err = ss.Group().CreateGroupSyncable(model.NewGroupChannel(group.Id, channelUnconstrained.Id, true))
	require.NoError(t, err)

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
		_, nErr = ss.Team().SaveMember(&model.TeamMember{
			UserId: item[0],
			TeamId: item[1],
		}, 99)
		require.NoError(t, nErr)
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
		require.NoError(t, err)
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
		Type:        model.ChannelTypeOpen,
	}
	channel1, err := ss.Channel().Save(channel1, 9999)
	require.NoError(t, err)

	// Create Groups 1, 2 and a deleted group
	group1, err := ss.Group().Create(&model.Group{
		Name:           model.NewString(model.NewId()),
		DisplayName:    "group-1",
		RemoteId:       model.NewString(model.NewId()),
		Source:         model.GroupSourceLdap,
		AllowReference: true,
	})
	require.NoError(t, err)

	group2, err := ss.Group().Create(&model.Group{
		Name:           model.NewString(model.NewId()),
		DisplayName:    "group-2",
		RemoteId:       model.NewString(model.NewId()),
		Source:         model.GroupSourceLdap,
		AllowReference: false,
	})
	require.NoError(t, err)

	deletedGroup, err := ss.Group().Create(&model.Group{
		Name:           model.NewString(model.NewId()),
		DisplayName:    "group-deleted",
		RemoteId:       model.NewString(model.NewId()),
		Source:         model.GroupSourceLdap,
		AllowReference: true,
		DeleteAt:       1,
	})
	require.NoError(t, err)

	// And associate them with Channel1
	for _, g := range []*model.Group{group1, group2, deletedGroup} {
		_, err = ss.Group().CreateGroupSyncable(&model.GroupSyncable{
			AutoAdd:    true,
			SyncableId: channel1.Id,
			Type:       model.GroupSyncableTypeChannel,
			GroupId:    g.Id,
		})
		require.NoError(t, err)
	}

	// Create Channel2
	channel2 := &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "Channel2",
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	channel2, nErr := ss.Channel().Save(channel2, 9999)
	require.NoError(t, nErr)

	// Create Group3
	group3, err := ss.Group().Create(&model.Group{
		Name:           model.NewString(model.NewId()),
		DisplayName:    "group-3",
		RemoteId:       model.NewString(model.NewId()),
		Source:         model.GroupSourceLdap,
		AllowReference: true,
	})
	require.NoError(t, err)

	// And associate it to Channel2
	_, err = ss.Group().CreateGroupSyncable(&model.GroupSyncable{
		AutoAdd:    true,
		SyncableId: channel2.Id,
		Type:       model.GroupSyncableTypeChannel,
		GroupId:    group3.Id,
	})
	require.NoError(t, err)

	// add members
	u1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user1, err := ss.User().Save(u1)
	require.NoError(t, err)

	u2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user2, err := ss.User().Save(u2)
	require.NoError(t, err)

	_, err = ss.Group().UpsertMember(group1.Id, user1.Id)
	require.NoError(t, err)

	_, err = ss.Group().UpsertMember(group1.Id, user2.Id)
	require.NoError(t, err)

	user2.DeleteAt = 1
	_, err = ss.User().Update(user2, true)
	require.NoError(t, err)

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
			Opts:       model.GroupSearchOpts{Q: string([]rune(*group1.Name)[2:10])}, // very low change of a name collision
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
		{
			Name:      "Include allow reference",
			ChannelId: channel1.Id,
			Opts:      model.GroupSearchOpts{FilterAllowReference: true},
			Page:      0,
			PerPage:   100,
			Result:    []*model.GroupWithSchemeAdmin{group1WSA},
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
			require.NoError(t, err)
			require.ElementsMatch(t, tc.Result, groups)
			if tc.TotalCount != nil {
				var count int64
				count, err = ss.Group().CountGroupsByChannel(tc.ChannelId, tc.Opts)
				require.NoError(t, err)
				require.Equal(t, *tc.TotalCount, count)
			}
		})
	}
}

func testGetGroupsAssociatedToChannelsByTeam(t *testing.T, ss store.Store) {
	// Create Team1
	team1 := &model.Team{
		DisplayName:     "Team1",
		Description:     model.NewId(),
		CompanyName:     model.NewId(),
		AllowOpenInvite: false,
		InviteId:        model.NewId(),
		Name:            NewTestId(),
		Email:           "success+" + model.NewId() + "@simulator.amazonses.com",
		Type:            model.TeamOpen,
	}
	team1, errt := ss.Team().Save(team1)
	require.NoError(t, errt)

	// Create Channel1
	channel1 := &model.Channel{
		TeamId:      team1.Id,
		DisplayName: "Channel1",
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	channel1, err := ss.Channel().Save(channel1, 9999)
	require.NoError(t, err)

	// Create Groups 1, 2 and a deleted group
	group1, err := ss.Group().Create(&model.Group{
		Name:           model.NewString(model.NewId()),
		DisplayName:    "group-1",
		RemoteId:       model.NewString(model.NewId()),
		Source:         model.GroupSourceLdap,
		AllowReference: false,
	})
	require.NoError(t, err)

	group2, err := ss.Group().Create(&model.Group{
		Name:           model.NewString(model.NewId()),
		DisplayName:    "group-2",
		RemoteId:       model.NewString(model.NewId()),
		Source:         model.GroupSourceLdap,
		AllowReference: true,
	})
	require.NoError(t, err)

	deletedGroup, err := ss.Group().Create(&model.Group{
		Name:           model.NewString(model.NewId()),
		DisplayName:    "group-deleted",
		RemoteId:       model.NewString(model.NewId()),
		Source:         model.GroupSourceLdap,
		AllowReference: true,
		DeleteAt:       1,
	})
	require.NoError(t, err)

	// And associate them with Channel1
	for _, g := range []*model.Group{group1, group2, deletedGroup} {
		_, err = ss.Group().CreateGroupSyncable(&model.GroupSyncable{
			AutoAdd:    true,
			SyncableId: channel1.Id,
			Type:       model.GroupSyncableTypeChannel,
			GroupId:    g.Id,
		})
		require.NoError(t, err)
	}

	// Create Channel2
	channel2 := &model.Channel{
		TeamId:      team1.Id,
		DisplayName: "Channel2",
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	channel2, err = ss.Channel().Save(channel2, 9999)
	require.NoError(t, err)

	// Create Group3
	group3, err := ss.Group().Create(&model.Group{
		Name:           model.NewString(model.NewId()),
		DisplayName:    "group-3",
		RemoteId:       model.NewString(model.NewId()),
		Source:         model.GroupSourceLdap,
		AllowReference: true,
	})
	require.NoError(t, err)

	// And associate it to Channel2
	_, err = ss.Group().CreateGroupSyncable(&model.GroupSyncable{
		AutoAdd:    true,
		SyncableId: channel2.Id,
		Type:       model.GroupSyncableTypeChannel,
		GroupId:    group3.Id,
	})
	require.NoError(t, err)

	// add members
	u1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user1, err := ss.User().Save(u1)
	require.NoError(t, err)

	u2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user2, err := ss.User().Save(u2)
	require.NoError(t, err)

	_, err = ss.Group().UpsertMember(group1.Id, user1.Id)
	require.NoError(t, err)

	_, err = ss.Group().UpsertMember(group1.Id, user2.Id)
	require.NoError(t, err)

	user2.DeleteAt = 1
	_, err = ss.User().Update(user2, true)
	require.NoError(t, err)

	group1WithMemberCount := *group1
	group1WithMemberCount.MemberCount = model.NewInt(1)

	group2WithMemberCount := *group2
	group2WithMemberCount.MemberCount = model.NewInt(0)

	group3WithMemberCount := *group3
	group3WithMemberCount.MemberCount = model.NewInt(0)

	group1WSA := &model.GroupWithSchemeAdmin{Group: *group1, SchemeAdmin: model.NewBool(false)}
	group2WSA := &model.GroupWithSchemeAdmin{Group: *group2, SchemeAdmin: model.NewBool(false)}
	group3WSA := &model.GroupWithSchemeAdmin{Group: *group3, SchemeAdmin: model.NewBool(false)}

	testCases := []struct {
		Name    string
		TeamId  string
		Page    int
		PerPage int
		Result  map[string][]*model.GroupWithSchemeAdmin
		Opts    model.GroupSearchOpts
	}{
		{
			Name:    "Get the groups for Channel1 and Channel2",
			TeamId:  team1.Id,
			Opts:    model.GroupSearchOpts{},
			Page:    0,
			PerPage: 60,
			Result:  map[string][]*model.GroupWithSchemeAdmin{channel1.Id: {group1WSA, group2WSA}, channel2.Id: {group3WSA}},
		},
		{
			Name:    "Get first Group for Channel1 with page 0 with 1 element",
			TeamId:  team1.Id,
			Opts:    model.GroupSearchOpts{},
			Page:    0,
			PerPage: 1,
			Result:  map[string][]*model.GroupWithSchemeAdmin{channel1.Id: {group1WSA}},
		},
		{
			Name:    "Get second Group for Channel1 with page 1 with 1 element",
			TeamId:  team1.Id,
			Opts:    model.GroupSearchOpts{},
			Page:    1,
			PerPage: 1,
			Result:  map[string][]*model.GroupWithSchemeAdmin{channel1.Id: {group2WSA}},
		},
		{
			Name:    "Get empty Groups for a fake id",
			TeamId:  model.NewId(),
			Opts:    model.GroupSearchOpts{},
			Page:    0,
			PerPage: 60,
			Result:  map[string][]*model.GroupWithSchemeAdmin{},
		},
		{
			Name:    "Get group matching name",
			TeamId:  team1.Id,
			Opts:    model.GroupSearchOpts{Q: string([]rune(*group1.Name)[2:10])}, // very low chance of a name collision
			Page:    0,
			PerPage: 100,
			Result:  map[string][]*model.GroupWithSchemeAdmin{channel1.Id: {group1WSA}},
		},
		{
			Name:    "Get group matching display name",
			TeamId:  team1.Id,
			Opts:    model.GroupSearchOpts{Q: "rouP-1"},
			Page:    0,
			PerPage: 100,
			Result:  map[string][]*model.GroupWithSchemeAdmin{channel1.Id: {group1WSA}},
		},
		{
			Name:    "Get group matching multiple display names",
			TeamId:  team1.Id,
			Opts:    model.GroupSearchOpts{Q: "roUp-"},
			Page:    0,
			PerPage: 100,
			Result:  map[string][]*model.GroupWithSchemeAdmin{channel1.Id: {group1WSA, group2WSA}, channel2.Id: {group3WSA}},
		},
		{
			Name:    "Include member counts",
			TeamId:  team1.Id,
			Opts:    model.GroupSearchOpts{IncludeMemberCount: true},
			Page:    0,
			PerPage: 10,
			Result: map[string][]*model.GroupWithSchemeAdmin{
				channel1.Id: {
					{Group: group1WithMemberCount, SchemeAdmin: model.NewBool(false)},
					{Group: group2WithMemberCount, SchemeAdmin: model.NewBool(false)},
				},
				channel2.Id: {
					{Group: group3WithMemberCount, SchemeAdmin: model.NewBool(false)},
				},
			},
		},
		{
			Name:    "Include allow reference",
			TeamId:  team1.Id,
			Opts:    model.GroupSearchOpts{FilterAllowReference: true},
			Page:    0,
			PerPage: 2,
			Result: map[string][]*model.GroupWithSchemeAdmin{
				channel1.Id: {
					group2WSA,
				},
				channel2.Id: {
					group3WSA,
				},
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
			groups, err := ss.Group().GetGroupsAssociatedToChannelsByTeam(tc.TeamId, tc.Opts)
			require.NoError(t, err)
			assert.Equal(t, tc.Result, groups)
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
		Name:            NewTestId(),
		Email:           "success+" + model.NewId() + "@simulator.amazonses.com",
		Type:            model.TeamOpen,
	}
	team1, err := ss.Team().Save(team1)
	require.NoError(t, err)

	// Create Groups 1, 2 and a deleted group
	group1, err := ss.Group().Create(&model.Group{
		Name:           model.NewString(model.NewId()),
		DisplayName:    "group-1",
		RemoteId:       model.NewString(model.NewId()),
		Source:         model.GroupSourceLdap,
		AllowReference: false,
	})
	require.NoError(t, err)

	group2, err := ss.Group().Create(&model.Group{
		Name:           model.NewString(model.NewId()),
		DisplayName:    "group-2",
		RemoteId:       model.NewString(model.NewId()),
		Source:         model.GroupSourceLdap,
		AllowReference: true,
	})
	require.NoError(t, err)

	deletedGroup, err := ss.Group().Create(&model.Group{
		Name:           model.NewString(model.NewId()),
		DisplayName:    "group-deleted",
		RemoteId:       model.NewString(model.NewId()),
		Source:         model.GroupSourceLdap,
		AllowReference: true,
		DeleteAt:       1,
	})
	require.NoError(t, err)

	// And associate them with Team1
	for _, g := range []*model.Group{group1, group2, deletedGroup} {
		_, err = ss.Group().CreateGroupSyncable(&model.GroupSyncable{
			AutoAdd:    true,
			SyncableId: team1.Id,
			Type:       model.GroupSyncableTypeTeam,
			GroupId:    g.Id,
		})
		require.NoError(t, err)
	}

	// Create Team2
	team2 := &model.Team{
		DisplayName:     "Team2",
		Description:     model.NewId(),
		CompanyName:     model.NewId(),
		AllowOpenInvite: false,
		InviteId:        model.NewId(),
		Name:            NewTestId(),
		Email:           "success+" + model.NewId() + "@simulator.amazonses.com",
		Type:            model.TeamInvite,
	}
	team2, err = ss.Team().Save(team2)
	require.NoError(t, err)

	// Create Group3
	group3, err := ss.Group().Create(&model.Group{
		Name:           model.NewString(model.NewId()),
		DisplayName:    "group-3",
		RemoteId:       model.NewString(model.NewId()),
		Source:         model.GroupSourceLdap,
		AllowReference: true,
	})
	require.NoError(t, err)

	// And associate it to Team2
	_, err = ss.Group().CreateGroupSyncable(&model.GroupSyncable{
		AutoAdd:    true,
		SyncableId: team2.Id,
		Type:       model.GroupSyncableTypeTeam,
		GroupId:    group3.Id,
	})
	require.NoError(t, err)

	// add members
	u1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user1, err := ss.User().Save(u1)
	require.NoError(t, err)

	u2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user2, err := ss.User().Save(u2)
	require.NoError(t, err)

	_, err = ss.Group().UpsertMember(group1.Id, user1.Id)
	require.NoError(t, err)

	_, err = ss.Group().UpsertMember(group1.Id, user2.Id)
	require.NoError(t, err)

	user2.DeleteAt = 1
	_, err = ss.User().Update(user2, true)
	require.NoError(t, err)

	_, err = ss.Group().UpsertMember(deletedGroup.Id, user1.Id)
	require.NoError(t, err)

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
			Opts:       model.GroupSearchOpts{Q: string([]rune(*group1.Name)[2:10])}, // very low change of a name collision
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
		{
			Name:    "Include allow reference",
			TeamId:  team1.Id,
			Opts:    model.GroupSearchOpts{FilterAllowReference: true},
			Page:    0,
			PerPage: 100,
			Result:  []*model.GroupWithSchemeAdmin{group2WSA},
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
			require.NoError(t, err)
			require.ElementsMatch(t, tc.Result, groups)
			if tc.TotalCount != nil {
				var count int64
				count, err = ss.Group().CountGroupsByTeam(tc.TeamId, tc.Opts)
				require.NoError(t, err)
				require.Equal(t, *tc.TotalCount, count)
			}
		})
	}
}

func testGetGroups(t *testing.T, ss store.Store) {
	// Create Team1
	team1 := &model.Team{
		DisplayName:      "Team1",
		Description:      model.NewId(),
		CompanyName:      model.NewId(),
		AllowOpenInvite:  false,
		InviteId:         model.NewId(),
		Name:             NewTestId(),
		Email:            "success+" + model.NewId() + "@simulator.amazonses.com",
		Type:             model.TeamOpen,
		GroupConstrained: model.NewBool(true),
	}
	team1, err := ss.Team().Save(team1)
	require.NoError(t, err)

	startCreateTime := team1.UpdateAt - 1

	// Create Channel1
	channel1 := &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "Channel1",
		Name:        model.NewId(),
		Type:        model.ChannelTypePrivate,
	}
	channel1, nErr := ss.Channel().Save(channel1, 9999)
	require.NoError(t, nErr)

	// Create Groups 1 and 2
	group1, err := ss.Group().Create(&model.Group{
		Name:           model.NewString(model.NewId()),
		DisplayName:    "group-1",
		RemoteId:       model.NewString(model.NewId()),
		Source:         model.GroupSourceLdap,
		AllowReference: true,
	})
	require.NoError(t, err)

	group2, err := ss.Group().Create(&model.Group{
		Name:           model.NewString(model.NewId() + "-group-2"),
		DisplayName:    "group-2",
		RemoteId:       model.NewString(model.NewId()),
		Source:         model.GroupSourceLdap,
		AllowReference: false,
	})
	require.NoError(t, err)

	deletedGroup, err := ss.Group().Create(&model.Group{
		Name:           model.NewString(model.NewId() + "-group-deleted"),
		DisplayName:    "group-deleted",
		RemoteId:       model.NewString(model.NewId()),
		Source:         model.GroupSourceLdap,
		AllowReference: false,
		DeleteAt:       1,
	})
	require.NoError(t, err)

	// And associate them with Team1
	for _, g := range []*model.Group{group1, group2, deletedGroup} {
		_, err = ss.Group().CreateGroupSyncable(&model.GroupSyncable{
			AutoAdd:    true,
			SyncableId: team1.Id,
			Type:       model.GroupSyncableTypeTeam,
			GroupId:    g.Id,
		})
		require.NoError(t, err)
	}

	// Create Team2
	team2 := &model.Team{
		DisplayName:     "Team2",
		Description:     model.NewId(),
		CompanyName:     model.NewId(),
		AllowOpenInvite: false,
		InviteId:        model.NewId(),
		Name:            NewTestId(),
		Email:           "success+" + model.NewId() + "@simulator.amazonses.com",
		Type:            model.TeamInvite,
	}
	team2, err = ss.Team().Save(team2)
	require.NoError(t, err)

	// Create Channel2
	channel2 := &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "Channel2",
		Name:        model.NewId(),
		Type:        model.ChannelTypePrivate,
	}
	channel2, nErr = ss.Channel().Save(channel2, 9999)
	require.NoError(t, nErr)

	// Create Channel3
	channel3 := &model.Channel{
		TeamId:      team1.Id,
		DisplayName: "Channel3",
		Name:        model.NewId(),
		Type:        model.ChannelTypePrivate,
	}
	channel3, nErr = ss.Channel().Save(channel3, 9999)
	require.NoError(t, nErr)

	// Create Group3
	group3, err := ss.Group().Create(&model.Group{
		Name:           model.NewString(model.NewId() + "-group-3"),
		DisplayName:    "group-3",
		RemoteId:       model.NewString(model.NewId()),
		Source:         model.GroupSourceLdap,
		AllowReference: true,
	})
	require.NoError(t, err)

	// And associate it to Team2
	_, err = ss.Group().CreateGroupSyncable(&model.GroupSyncable{
		AutoAdd:    true,
		SyncableId: team2.Id,
		Type:       model.GroupSyncableTypeTeam,
		GroupId:    group3.Id,
	})
	require.NoError(t, err)

	// And associate Group1 to Channel2
	_, err = ss.Group().CreateGroupSyncable(&model.GroupSyncable{
		AutoAdd:    true,
		SyncableId: channel2.Id,
		Type:       model.GroupSyncableTypeChannel,
		GroupId:    group1.Id,
	})
	require.NoError(t, err)

	// And associate Group2 and Group3 to Channel1
	for _, g := range []*model.Group{group2, group3} {
		_, err = ss.Group().CreateGroupSyncable(&model.GroupSyncable{
			AutoAdd:    true,
			SyncableId: channel1.Id,
			Type:       model.GroupSyncableTypeChannel,
			GroupId:    g.Id,
		})
		require.NoError(t, err)
	}

	// add members
	u1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user1, err := ss.User().Save(u1)
	require.NoError(t, err)

	u2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user2, err := ss.User().Save(u2)
	require.NoError(t, err)

	u3 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user3, err := ss.User().Save(u3)
	require.NoError(t, err)

	_, err = ss.Group().UpsertMember(group1.Id, user1.Id)
	require.NoError(t, err)

	_, err = ss.Group().UpsertMember(group1.Id, user2.Id)
	require.NoError(t, err)

	_, err = ss.Group().UpsertMember(group2.Id, user2.Id)
	require.NoError(t, err)

	_, err = ss.Group().UpsertMember(group2.Id, user3.Id)
	require.NoError(t, err)

	_, err = ss.Group().UpsertMember(deletedGroup.Id, user1.Id)
	require.NoError(t, err)

	m1 := model.ChannelMember{
		ChannelId:   channel1.Id,
		UserId:      user1.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}
	_, err = ss.Channel().SaveMember(&m1)
	require.NoError(t, err)

	user2.DeleteAt = 1
	u2Update, _ := ss.User().Update(user2, true)

	group2NameSubstring := "group-2"

	endCreateTime := u2Update.New.UpdateAt + 1

	// Create Team3
	team3 := &model.Team{
		DisplayName:     "Team3",
		Description:     model.NewId(),
		CompanyName:     model.NewId(),
		AllowOpenInvite: false,
		InviteId:        model.NewId(),
		Name:            NewTestId(),
		Email:           "success+" + model.NewId() + "@simulator.amazonses.com",
		Type:            model.TeamInvite,
	}
	team3, err = ss.Team().Save(team3)
	require.NoError(t, err)

	channel4 := &model.Channel{
		TeamId:      team3.Id,
		DisplayName: "Channel4",
		Name:        model.NewId(),
		Type:        model.ChannelTypePrivate,
	}
	channel4, nErr = ss.Channel().Save(channel4, 9999)
	require.NoError(t, nErr)

	testCases := []struct {
		Name         string
		Page         int
		PerPage      int
		Opts         model.GroupSearchOpts
		Resultf      func([]*model.Group) bool
		Restrictions *model.ViewUsersRestrictions
	}{
		{
			Name:         "Get all the Groups",
			Opts:         model.GroupSearchOpts{},
			Page:         0,
			PerPage:      3,
			Resultf:      func(groups []*model.Group) bool { return len(groups) == 3 },
			Restrictions: nil,
		},
		{
			Name:         "Get first Group with page 0 with 1 element",
			Opts:         model.GroupSearchOpts{},
			Page:         0,
			PerPage:      1,
			Resultf:      func(groups []*model.Group) bool { return len(groups) == 1 },
			Restrictions: nil,
		},
		{
			Name:         "Get single result from page 1",
			Opts:         model.GroupSearchOpts{},
			Page:         1,
			PerPage:      1,
			Resultf:      func(groups []*model.Group) bool { return len(groups) == 1 },
			Restrictions: nil,
		},
		{
			Name:         "Get multiple results from page 1",
			Opts:         model.GroupSearchOpts{},
			Page:         1,
			PerPage:      2,
			Resultf:      func(groups []*model.Group) bool { return len(groups) == 2 },
			Restrictions: nil,
		},
		{
			Name:    "Get group matching name",
			Opts:    model.GroupSearchOpts{Q: group2NameSubstring},
			Page:    0,
			PerPage: 100,
			Resultf: func(groups []*model.Group) bool {
				for _, g := range groups {
					if !strings.Contains(*g.Name, group2NameSubstring) && !strings.Contains(g.DisplayName, group2NameSubstring) {
						return false
					}
				}
				return true
			},
			Restrictions: nil,
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
			Restrictions: nil,
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
			Restrictions: nil,
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
					if (g.Id == group1.Id || g.Id == group2.Id) && *g.MemberCount != 1 {
						return false
					}
					if g.DeleteAt != 0 {
						return false
					}
				}
				return true
			},
			Restrictions: nil,
		},
		{
			Name:    "Include member counts with restrictions",
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
					if g.Id == group2.Id && *g.MemberCount != 0 {
						return false
					}
					if g.DeleteAt != 0 {
						return false
					}
				}
				return true
			},
			Restrictions: &model.ViewUsersRestrictions{Channels: []string{channel1.Id}},
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
					if g.DeleteAt != 0 {
						return false
					}
				}
				return true
			},
			Restrictions: nil,
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
					if g.DeleteAt != 0 {
						return false
					}
				}
				return true
			},
			Restrictions: nil,
		},
		{
			Name:    "Include allow reference",
			Opts:    model.GroupSearchOpts{FilterAllowReference: true},
			Page:    0,
			PerPage: 100,
			Resultf: func(groups []*model.Group) bool {
				if len(groups) == 0 {
					return false
				}
				for _, g := range groups {
					if !g.AllowReference {
						return false
					}
					if g.DeleteAt != 0 {
						return false
					}
				}
				return true
			},
			Restrictions: nil,
		},
		{
			Name:    "Use Since return all",
			Opts:    model.GroupSearchOpts{FilterAllowReference: true, Since: startCreateTime},
			Page:    0,
			PerPage: 100,
			Resultf: func(groups []*model.Group) bool {
				if len(groups) == 0 {
					return false
				}
				for _, g := range groups {
					if g.DeleteAt != 0 {
						return false
					}
				}
				return true
			},
			Restrictions: nil,
		},
		{
			Name:    "Use Since return none",
			Opts:    model.GroupSearchOpts{FilterAllowReference: true, Since: endCreateTime},
			Page:    0,
			PerPage: 100,
			Resultf: func(groups []*model.Group) bool {
				return len(groups) == 0
			},
			Restrictions: nil,
		},
		{
			Name:    "Filter groups from group-constrained teams",
			Opts:    model.GroupSearchOpts{NotAssociatedToChannel: channel3.Id, FilterParentTeamPermitted: true},
			Page:    0,
			PerPage: 100,
			Resultf: func(groups []*model.Group) bool {
				return len(groups) == 2 && groups[0].Id == group1.Id && groups[1].Id == group2.Id
			},
			Restrictions: nil,
		},
		{
			Name:    "Filter groups from group-constrained page 0",
			Opts:    model.GroupSearchOpts{NotAssociatedToChannel: channel3.Id, FilterParentTeamPermitted: true},
			Page:    0,
			PerPage: 1,
			Resultf: func(groups []*model.Group) bool {
				return groups[0].Id == group1.Id
			},
			Restrictions: nil,
		},
		{
			Name:    "Filter groups from group-constrained page 1",
			Opts:    model.GroupSearchOpts{NotAssociatedToChannel: channel3.Id, FilterParentTeamPermitted: true},
			Page:    1,
			PerPage: 1,
			Resultf: func(groups []*model.Group) bool {
				return groups[0].Id == group2.Id
			},
			Restrictions: nil,
		},
		{
			Name:    "Non-group constrained team with no associated groups still returns groups for the child channel",
			Opts:    model.GroupSearchOpts{NotAssociatedToChannel: channel4.Id, FilterParentTeamPermitted: true},
			Page:    0,
			PerPage: 100,
			Resultf: func(groups []*model.Group) bool {
				return len(groups) > 0
			},
			Restrictions: nil,
		},
		{
			Name:    "Filter by group member",
			Opts:    model.GroupSearchOpts{FilterHasMember: user1.Id},
			Page:    0,
			PerPage: 100,
			Resultf: func(groups []*model.Group) bool {
				return len(groups) == 1 && groups[0].Id == group1.Id
			},
			Restrictions: nil,
		},
		{
			Name:    "Filter by non-existent group member",
			Opts:    model.GroupSearchOpts{FilterHasMember: model.NewId()},
			Page:    0,
			PerPage: 100,
			Resultf: func(groups []*model.Group) bool {
				return len(groups) == 0
			},
			Restrictions: nil,
		},
		{
			Name:    "Filter by non-member member",
			Opts:    model.GroupSearchOpts{FilterHasMember: user2.Id},
			Page:    0,
			PerPage: 100,
			Resultf: func(groups []*model.Group) bool {
				return len(groups) == 2
			},
			Restrictions: nil,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			groups, err := ss.Group().GetGroups(tc.Page, tc.PerPage, tc.Opts, tc.Restrictions)
			require.NoError(t, err)
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
		Name:             NewTestId(),
		Email:            model.NewId() + "@simulator.amazonses.com",
		Type:             model.TeamOpen,
		GroupConstrained: model.NewBool(true),
	}
	team, err := ss.Team().Save(team)
	require.NoError(t, err)

	for i := 0; i < numberOfUsers; i++ {
		user := &model.User{
			Email:    MakeEmail(),
			Username: fmt.Sprintf("%d_%s", i, model.NewId()),
		}
		user, err = ss.User().Save(user)
		require.NoError(t, err)
		users = append(users, user)

		trueOrFalse := int(math.Mod(float64(i), 2)) == 0
		_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: team.Id, UserId: user.Id, SchemeUser: trueOrFalse, SchemeAdmin: !trueOrFalse}, 999)
		require.NoError(t, nErr)
	}

	// Extra user outside of the group member users.
	user := &model.User{
		Email:    MakeEmail(),
		Username: "99_" + model.NewId(),
	}
	user, err = ss.User().Save(user)
	require.NoError(t, err)
	users = append(users, user)
	_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: team.Id, UserId: user.Id, SchemeUser: true, SchemeAdmin: false}, 999)
	require.NoError(t, nErr)

	for i := 0; i < numberOfGroups; i++ {
		group := &model.Group{
			Name:        model.NewString(fmt.Sprintf("n_%d_%s", i, model.NewId())),
			DisplayName: model.NewId(),
			Source:      model.GroupSourceLdap,
			Description: model.NewId(),
			RemoteId:    model.NewString(model.NewId()),
		}
		group, err := ss.Group().Create(group)
		require.NoError(t, err)
		groups = append(groups, group)
	}

	sort.Slice(users, func(i, j int) bool {
		return users[i].Username < users[j].Username
	})

	// Add even users to even group, and the inverse
	for i := 0; i < numberOfUsers; i++ {
		groupIndex := int(math.Mod(float64(i), 2))
		_, err := ss.Group().UpsertMember(groups[groupIndex].Id, users[i].Id)
		require.NoError(t, err)

		// Add everyone to group 2
		_, err = ss.Group().UpsertMember(groups[numberOfGroups-1].Id, users[i].Id)
		require.NoError(t, err)
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
			require.NoError(t, err)
			require.ElementsMatch(t, tc.expectedUserIDs, mapUserIDs(actual))

			actualCount, err := ss.Group().CountTeamMembersMinusGroupMembers(team.Id, tc.groupIDs)
			require.NoError(t, err)
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
		Type:             model.ChannelTypePrivate,
		GroupConstrained: model.NewBool(true),
	}
	channel, err := ss.Channel().Save(channel, 9999)
	require.NoError(t, err)

	for i := 0; i < numberOfUsers; i++ {
		user := &model.User{
			Email:    MakeEmail(),
			Username: fmt.Sprintf("%d_%s", i, model.NewId()),
		}
		user, err = ss.User().Save(user)
		require.NoError(t, err)
		users = append(users, user)

		trueOrFalse := int(math.Mod(float64(i), 2)) == 0
		_, err = ss.Channel().SaveMember(&model.ChannelMember{
			ChannelId:   channel.Id,
			UserId:      user.Id,
			SchemeUser:  trueOrFalse,
			SchemeAdmin: !trueOrFalse,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		})
		require.NoError(t, err)
	}

	// Extra user outside of the group member users.
	user, err := ss.User().Save(&model.User{
		Email:    MakeEmail(),
		Username: "99_" + model.NewId(),
	})
	require.NoError(t, err)
	users = append(users, user)
	_, err = ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   channel.Id,
		UserId:      user.Id,
		SchemeUser:  true,
		SchemeAdmin: false,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.NoError(t, err)

	for i := 0; i < numberOfGroups; i++ {
		group := &model.Group{
			Name:        model.NewString(fmt.Sprintf("n_%d_%s", i, model.NewId())),
			DisplayName: model.NewId(),
			Source:      model.GroupSourceLdap,
			Description: model.NewId(),
			RemoteId:    model.NewString(model.NewId()),
		}
		group, err := ss.Group().Create(group)
		require.NoError(t, err)
		groups = append(groups, group)
	}

	sort.Slice(users, func(i, j int) bool {
		return users[i].Username < users[j].Username
	})

	// Add even users to even group, and the inverse
	for i := 0; i < numberOfUsers; i++ {
		groupIndex := int(math.Mod(float64(i), 2))
		_, err := ss.Group().UpsertMember(groups[groupIndex].Id, users[i].Id)
		require.NoError(t, err)

		// Add everyone to group 2
		_, err = ss.Group().UpsertMember(groups[numberOfGroups-1].Id, users[i].Id)
		require.NoError(t, err)
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
			require.NoError(t, err)
			require.ElementsMatch(t, tc.expectedUserIDs, mapUserIDs(actual))

			actualCount, err := ss.Group().CountChannelMembersMinusGroupMembers(channel.Id, tc.groupIDs)
			require.NoError(t, err)
			require.Equal(t, tc.expectedTotalCount, actualCount)
		})
	}
}

func groupTestGetMemberCount(t *testing.T, ss store.Store) {
	group := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		Description: model.NewId(),
		RemoteId:    model.NewString(model.NewId()),
	}
	group, err := ss.Group().Create(group)
	require.NoError(t, err)

	var user *model.User
	var nErr error
	for i := 0; i < 2; i++ {
		user = &model.User{
			Email:    MakeEmail(),
			Username: fmt.Sprintf("%d_%s", i, model.NewId()),
		}
		user, nErr = ss.User().Save(user)
		require.NoError(t, nErr)

		_, err = ss.Group().UpsertMember(group.Id, user.Id)
		require.NoError(t, err)
	}

	count, err := ss.Group().GetMemberCount(group.Id)
	require.NoError(t, err)
	require.Equal(t, int64(2), count)

	user.DeleteAt = 1
	_, nErr = ss.User().Update(user, true)
	require.NoError(t, nErr)

	count, err = ss.Group().GetMemberCount(group.Id)
	require.NoError(t, err)
	require.Equal(t, int64(1), count)
}

func groupTestAdminRoleGroupsForSyncableMemberChannel(t *testing.T, ss store.Store) {
	user := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user, err := ss.User().Save(user)
	require.NoError(t, err)

	group1 := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		Description: model.NewId(),
		RemoteId:    model.NewString(model.NewId()),
	}
	group1, err = ss.Group().Create(group1)
	require.NoError(t, err)

	_, err = ss.Group().UpsertMember(group1.Id, user.Id)
	require.NoError(t, err)

	group2 := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		Description: model.NewId(),
		RemoteId:    model.NewString(model.NewId()),
	}
	group2, err = ss.Group().Create(group2)
	require.NoError(t, err)

	_, err = ss.Group().UpsertMember(group2.Id, user.Id)
	require.NoError(t, err)

	channel := &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "A Name",
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	channel, nErr := ss.Channel().Save(channel, 9999)
	require.NoError(t, nErr)

	_, err = ss.Group().CreateGroupSyncable(&model.GroupSyncable{
		AutoAdd:     true,
		SyncableId:  channel.Id,
		Type:        model.GroupSyncableTypeChannel,
		GroupId:     group1.Id,
		SchemeAdmin: true,
	})
	require.NoError(t, err)

	groupSyncable2, err := ss.Group().CreateGroupSyncable(&model.GroupSyncable{
		AutoAdd:    true,
		SyncableId: channel.Id,
		Type:       model.GroupSyncableTypeChannel,
		GroupId:    group2.Id,
	})
	require.NoError(t, err)

	// User is a member of both groups but only one is SchemeAdmin: true
	actualGroupIDs, err := ss.Group().AdminRoleGroupsForSyncableMember(user.Id, channel.Id, model.GroupSyncableTypeChannel)
	require.NoError(t, err)
	require.ElementsMatch(t, []string{group1.Id}, actualGroupIDs)

	// Update the second group syncable to be SchemeAdmin: true and both groups should be returned
	groupSyncable2.SchemeAdmin = true
	_, err = ss.Group().UpdateGroupSyncable(groupSyncable2)
	require.NoError(t, err)
	actualGroupIDs, err = ss.Group().AdminRoleGroupsForSyncableMember(user.Id, channel.Id, model.GroupSyncableTypeChannel)
	require.NoError(t, err)
	require.ElementsMatch(t, []string{group1.Id, group2.Id}, actualGroupIDs)

	// Deleting membership from group should stop the group from being returned
	_, err = ss.Group().DeleteMember(group1.Id, user.Id)
	require.NoError(t, err)
	actualGroupIDs, err = ss.Group().AdminRoleGroupsForSyncableMember(user.Id, channel.Id, model.GroupSyncableTypeChannel)
	require.NoError(t, err)
	require.ElementsMatch(t, []string{group2.Id}, actualGroupIDs)

	// Deleting group syncable should stop it being returned
	_, err = ss.Group().DeleteGroupSyncable(group2.Id, channel.Id, model.GroupSyncableTypeChannel)
	require.NoError(t, err)
	actualGroupIDs, err = ss.Group().AdminRoleGroupsForSyncableMember(user.Id, channel.Id, model.GroupSyncableTypeChannel)
	require.NoError(t, err)
	require.ElementsMatch(t, []string{}, actualGroupIDs)
}

func groupTestAdminRoleGroupsForSyncableMemberTeam(t *testing.T, ss store.Store) {
	user := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user, err := ss.User().Save(user)
	require.NoError(t, err)

	group1 := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		Description: model.NewId(),
		RemoteId:    model.NewString(model.NewId()),
	}
	group1, err = ss.Group().Create(group1)
	require.NoError(t, err)

	_, err = ss.Group().UpsertMember(group1.Id, user.Id)
	require.NoError(t, err)

	group2 := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		Description: model.NewId(),
		RemoteId:    model.NewString(model.NewId()),
	}
	group2, err = ss.Group().Create(group2)
	require.NoError(t, err)

	_, err = ss.Group().UpsertMember(group2.Id, user.Id)
	require.NoError(t, err)

	team := &model.Team{
		DisplayName: "A Name",
		Name:        NewTestId(),
		Type:        model.TeamOpen,
	}
	team, nErr := ss.Team().Save(team)
	require.NoError(t, nErr)

	_, err = ss.Group().CreateGroupSyncable(&model.GroupSyncable{
		AutoAdd:     true,
		SyncableId:  team.Id,
		Type:        model.GroupSyncableTypeTeam,
		GroupId:     group1.Id,
		SchemeAdmin: true,
	})
	require.NoError(t, err)

	groupSyncable2, err := ss.Group().CreateGroupSyncable(&model.GroupSyncable{
		AutoAdd:    true,
		SyncableId: team.Id,
		Type:       model.GroupSyncableTypeTeam,
		GroupId:    group2.Id,
	})
	require.NoError(t, err)

	// User is a member of both groups but only one is SchemeAdmin: true
	actualGroupIDs, err := ss.Group().AdminRoleGroupsForSyncableMember(user.Id, team.Id, model.GroupSyncableTypeTeam)
	require.NoError(t, err)
	require.ElementsMatch(t, []string{group1.Id}, actualGroupIDs)

	// Update the second group syncable to be SchemeAdmin: true and both groups should be returned
	groupSyncable2.SchemeAdmin = true
	_, err = ss.Group().UpdateGroupSyncable(groupSyncable2)
	require.NoError(t, err)
	actualGroupIDs, err = ss.Group().AdminRoleGroupsForSyncableMember(user.Id, team.Id, model.GroupSyncableTypeTeam)
	require.NoError(t, err)
	require.ElementsMatch(t, []string{group1.Id, group2.Id}, actualGroupIDs)

	// Deleting membership from group should stop the group from being returned
	_, err = ss.Group().DeleteMember(group1.Id, user.Id)
	require.NoError(t, err)
	actualGroupIDs, err = ss.Group().AdminRoleGroupsForSyncableMember(user.Id, team.Id, model.GroupSyncableTypeTeam)
	require.NoError(t, err)
	require.ElementsMatch(t, []string{group2.Id}, actualGroupIDs)

	// Deleting group syncable should stop it being returned
	_, err = ss.Group().DeleteGroupSyncable(group2.Id, team.Id, model.GroupSyncableTypeTeam)
	require.NoError(t, err)
	actualGroupIDs, err = ss.Group().AdminRoleGroupsForSyncableMember(user.Id, team.Id, model.GroupSyncableTypeTeam)
	require.NoError(t, err)
	require.ElementsMatch(t, []string{}, actualGroupIDs)
}

func groupTestPermittedSyncableAdminsTeam(t *testing.T, ss store.Store) {
	user1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user1, err := ss.User().Save(user1)
	require.NoError(t, err)

	user2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user2, err = ss.User().Save(user2)
	require.NoError(t, err)

	user3 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user3, err = ss.User().Save(user3)
	require.NoError(t, err)

	group1 := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		Description: model.NewId(),
		RemoteId:    model.NewString(model.NewId()),
	}
	group1, err = ss.Group().Create(group1)
	require.NoError(t, err)

	_, err = ss.Group().UpsertMember(group1.Id, user1.Id)
	require.NoError(t, err)
	_, err = ss.Group().UpsertMember(group1.Id, user2.Id)
	require.NoError(t, err)

	group2 := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		Description: model.NewId(),
		RemoteId:    model.NewString(model.NewId()),
	}
	group2, err = ss.Group().Create(group2)
	require.NoError(t, err)

	_, err = ss.Group().UpsertMember(group2.Id, user3.Id)
	require.NoError(t, err)

	team := &model.Team{
		DisplayName: "A Name",
		Name:        NewTestId(),
		Type:        model.TeamOpen,
	}
	team, nErr := ss.Team().Save(team)
	require.NoError(t, nErr)

	_, err = ss.Group().CreateGroupSyncable(&model.GroupSyncable{
		AutoAdd:     true,
		SyncableId:  team.Id,
		Type:        model.GroupSyncableTypeTeam,
		GroupId:     group1.Id,
		SchemeAdmin: true,
	})
	require.NoError(t, err)

	groupSyncable2, err := ss.Group().CreateGroupSyncable(&model.GroupSyncable{
		AutoAdd:     true,
		SyncableId:  team.Id,
		Type:        model.GroupSyncableTypeTeam,
		GroupId:     group2.Id,
		SchemeAdmin: false,
	})
	require.NoError(t, err)

	// group 1's users are returned because groupsyncable 2 has SchemeAdmin false.
	actualUserIDs, err := ss.Group().PermittedSyncableAdmins(team.Id, model.GroupSyncableTypeTeam)
	require.NoError(t, err)
	require.ElementsMatch(t, []string{user1.Id, user2.Id}, actualUserIDs)

	// update groupsyncable 2 to be SchemeAdmin true
	groupSyncable2.SchemeAdmin = true
	_, err = ss.Group().UpdateGroupSyncable(groupSyncable2)
	require.NoError(t, err)

	// group 2's users are now included in return value
	actualUserIDs, err = ss.Group().PermittedSyncableAdmins(team.Id, model.GroupSyncableTypeTeam)
	require.NoError(t, err)
	require.ElementsMatch(t, []string{user1.Id, user2.Id, user3.Id}, actualUserIDs)

	// deleted group member should not be included
	ss.Group().DeleteMember(group1.Id, user2.Id)
	require.NoError(t, err)
	actualUserIDs, err = ss.Group().PermittedSyncableAdmins(team.Id, model.GroupSyncableTypeTeam)
	require.NoError(t, err)
	require.ElementsMatch(t, []string{user1.Id, user3.Id}, actualUserIDs)

	// deleted group syncable no longer includes group members
	_, err = ss.Group().DeleteGroupSyncable(group1.Id, team.Id, model.GroupSyncableTypeTeam)
	require.NoError(t, err)
	actualUserIDs, err = ss.Group().PermittedSyncableAdmins(team.Id, model.GroupSyncableTypeTeam)
	require.NoError(t, err)
	require.ElementsMatch(t, []string{user3.Id}, actualUserIDs)
}

func groupTestPermittedSyncableAdminsChannel(t *testing.T, ss store.Store) {
	user1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user1, err := ss.User().Save(user1)
	require.NoError(t, err)

	user2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user2, err = ss.User().Save(user2)
	require.NoError(t, err)

	user3 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user3, err = ss.User().Save(user3)
	require.NoError(t, err)

	group1 := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		Description: model.NewId(),
		RemoteId:    model.NewString(model.NewId()),
	}
	group1, err = ss.Group().Create(group1)
	require.NoError(t, err)

	_, err = ss.Group().UpsertMember(group1.Id, user1.Id)
	require.NoError(t, err)
	_, err = ss.Group().UpsertMember(group1.Id, user2.Id)
	require.NoError(t, err)

	group2 := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		Description: model.NewId(),
		RemoteId:    model.NewString(model.NewId()),
	}
	group2, err = ss.Group().Create(group2)
	require.NoError(t, err)

	_, err = ss.Group().UpsertMember(group2.Id, user3.Id)
	require.NoError(t, err)

	channel := &model.Channel{
		TeamId:      model.NewId(),
		DisplayName: "A Name",
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	channel, nErr := ss.Channel().Save(channel, 9999)
	require.NoError(t, nErr)

	_, err = ss.Group().CreateGroupSyncable(&model.GroupSyncable{
		AutoAdd:     true,
		SyncableId:  channel.Id,
		Type:        model.GroupSyncableTypeChannel,
		GroupId:     group1.Id,
		SchemeAdmin: true,
	})
	require.NoError(t, err)

	groupSyncable2, err := ss.Group().CreateGroupSyncable(&model.GroupSyncable{
		AutoAdd:     true,
		SyncableId:  channel.Id,
		Type:        model.GroupSyncableTypeChannel,
		GroupId:     group2.Id,
		SchemeAdmin: false,
	})
	require.NoError(t, err)

	// group 1's users are returned because groupsyncable 2 has SchemeAdmin false.
	actualUserIDs, err := ss.Group().PermittedSyncableAdmins(channel.Id, model.GroupSyncableTypeChannel)
	require.NoError(t, err)
	require.ElementsMatch(t, []string{user1.Id, user2.Id}, actualUserIDs)

	// update groupsyncable 2 to be SchemeAdmin true
	groupSyncable2.SchemeAdmin = true
	_, err = ss.Group().UpdateGroupSyncable(groupSyncable2)
	require.NoError(t, err)

	// group 2's users are now included in return value
	actualUserIDs, err = ss.Group().PermittedSyncableAdmins(channel.Id, model.GroupSyncableTypeChannel)
	require.NoError(t, err)
	require.ElementsMatch(t, []string{user1.Id, user2.Id, user3.Id}, actualUserIDs)

	// deleted group member should not be included
	_, err = ss.Group().DeleteMember(group1.Id, user2.Id)
	require.NoError(t, err)
	actualUserIDs, err = ss.Group().PermittedSyncableAdmins(channel.Id, model.GroupSyncableTypeChannel)
	require.NoError(t, err)
	require.ElementsMatch(t, []string{user1.Id, user3.Id}, actualUserIDs)

	// deleted group syncable no longer includes group members
	_, err = ss.Group().DeleteGroupSyncable(group1.Id, channel.Id, model.GroupSyncableTypeChannel)
	require.NoError(t, err)
	actualUserIDs, err = ss.Group().PermittedSyncableAdmins(channel.Id, model.GroupSyncableTypeChannel)
	require.NoError(t, err)
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
		Type:            model.TeamOpen,
	}
	team, err := ss.Team().Save(team)
	require.NoError(t, err)

	user1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user1, err = ss.User().Save(user1)
	require.NoError(t, err)

	user2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user2, err = ss.User().Save(user2)
	require.NoError(t, err)

	user3 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user3, err = ss.User().Save(user3)
	require.NoError(t, err)

	user4 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user4, err = ss.User().Save(user4)
	require.NoError(t, err)

	for _, user := range []*model.User{user1, user2, user3} {
		_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: team.Id, UserId: user.Id}, 9999)
		require.NoError(t, nErr)
	}

	_, nErr := ss.Team().SaveMember(&model.TeamMember{TeamId: team.Id, UserId: user4.Id, SchemeGuest: true}, 9999)
	require.NoError(t, nErr)

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

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			err = ss.Team().UpdateMembersRole(team.Id, tt.inUserIDs)
			require.NoError(t, err)

			members, err := ss.Team().GetMembers(team.Id, 0, 100, nil)
			require.NoError(t, err)
			require.GreaterOrEqual(t, len(members), 4) // sanity check for team membership

			for _, member := range members {
				if utils.StringInSlice(member.UserId, tt.inUserIDs) {
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
		Type:        model.ChannelTypeOpen, // Query does not look at type so this shouldn't matter.
	}
	channel, err := ss.Channel().Save(channel, 9999)
	require.NoError(t, err)

	user1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user1, err = ss.User().Save(user1)
	require.NoError(t, err)

	user2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user2, err = ss.User().Save(user2)
	require.NoError(t, err)

	user3 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user3, err = ss.User().Save(user3)
	require.NoError(t, err)

	user4 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user4, err = ss.User().Save(user4)
	require.NoError(t, err)

	for _, user := range []*model.User{user1, user2, user3} {
		_, err = ss.Channel().SaveMember(&model.ChannelMember{
			ChannelId:   channel.Id,
			UserId:      user.Id,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		})
		require.NoError(t, err)
	}

	_, err = ss.Channel().SaveMember(&model.ChannelMember{
		ChannelId:   channel.Id,
		UserId:      user4.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
		SchemeGuest: true,
	})
	require.NoError(t, err)

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

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			err = ss.Channel().UpdateMembersRole(channel.Id, tt.inUserIDs)
			require.NoError(t, err)

			members, err := ss.Channel().GetMembers(channel.Id, 0, 100)
			require.NoError(t, err)

			require.GreaterOrEqual(t, len(members), 4) // sanity check for channel membership

			for _, member := range members {
				if utils.StringInSlice(member.UserId, tt.inUserIDs) {
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

func groupTestGroupCount(t *testing.T, ss store.Store) {
	group1, err := ss.Group().Create(&model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString(model.NewId()),
	})
	require.NoError(t, err)
	defer ss.Group().Delete(group1.Id)

	count, err := ss.Group().GroupCount()
	require.NoError(t, err)
	require.GreaterOrEqual(t, count, int64(1))

	group2, err := ss.Group().Create(&model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString(model.NewId()),
	})
	require.NoError(t, err)
	defer ss.Group().Delete(group2.Id)

	countAfter, err := ss.Group().GroupCount()
	require.NoError(t, err)
	require.GreaterOrEqual(t, countAfter, count+1)
}

func groupTestGroupTeamCount(t *testing.T, ss store.Store) {
	team, err := ss.Team().Save(&model.Team{
		DisplayName:     model.NewId(),
		Description:     model.NewId(),
		AllowOpenInvite: false,
		InviteId:        model.NewId(),
		Name:            NewTestId(),
		Email:           model.NewId() + "@simulator.amazonses.com",
		Type:            model.TeamOpen,
	})
	require.NoError(t, err)
	defer ss.Team().PermanentDelete(team.Id)

	group1, err := ss.Group().Create(&model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString(model.NewId()),
	})
	require.NoError(t, err)
	defer ss.Group().Delete(group1.Id)

	group2, err := ss.Group().Create(&model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString(model.NewId()),
	})
	require.NoError(t, err)
	defer ss.Group().Delete(group2.Id)

	groupSyncable1, err := ss.Group().CreateGroupSyncable(model.NewGroupTeam(group1.Id, team.Id, false))
	require.NoError(t, err)
	defer ss.Group().DeleteGroupSyncable(groupSyncable1.GroupId, groupSyncable1.SyncableId, groupSyncable1.Type)

	count, err := ss.Group().GroupTeamCount()
	require.NoError(t, err)
	require.GreaterOrEqual(t, count, int64(1))

	groupSyncable2, err := ss.Group().CreateGroupSyncable(model.NewGroupTeam(group2.Id, team.Id, false))
	require.NoError(t, err)
	defer ss.Group().DeleteGroupSyncable(groupSyncable2.GroupId, groupSyncable2.SyncableId, groupSyncable2.Type)

	countAfter, err := ss.Group().GroupTeamCount()
	require.NoError(t, err)
	require.GreaterOrEqual(t, countAfter, count+1)
}

func groupTestGroupChannelCount(t *testing.T, ss store.Store) {
	channel, err := ss.Channel().Save(&model.Channel{
		TeamId:      model.NewId(),
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, 9999)
	require.NoError(t, err)
	defer ss.Channel().Delete(channel.Id, 0)

	group1, err := ss.Group().Create(&model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString(model.NewId()),
	})
	require.NoError(t, err)
	defer ss.Group().Delete(group1.Id)

	group2, err := ss.Group().Create(&model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString(model.NewId()),
	})
	require.NoError(t, err)
	defer ss.Group().Delete(group2.Id)

	groupSyncable1, err := ss.Group().CreateGroupSyncable(model.NewGroupChannel(group1.Id, channel.Id, false))
	require.NoError(t, err)
	defer ss.Group().DeleteGroupSyncable(groupSyncable1.GroupId, groupSyncable1.SyncableId, groupSyncable1.Type)

	count, err := ss.Group().GroupChannelCount()
	require.NoError(t, err)
	require.GreaterOrEqual(t, count, int64(1))

	groupSyncable2, err := ss.Group().CreateGroupSyncable(model.NewGroupChannel(group2.Id, channel.Id, false))
	require.NoError(t, err)
	defer ss.Group().DeleteGroupSyncable(groupSyncable2.GroupId, groupSyncable2.SyncableId, groupSyncable2.Type)

	countAfter, err := ss.Group().GroupChannelCount()
	require.NoError(t, err)
	require.GreaterOrEqual(t, countAfter, count+1)
}

func groupTestGroupMemberCount(t *testing.T, ss store.Store) {
	user := &model.User{
		Email:    fmt.Sprintf("test.%s@localhost", model.NewId()),
		Username: model.NewId(),
	}
	user, err := ss.User().Save(user)
	require.NoError(t, err)

	user2 := &model.User{
		Email:    fmt.Sprintf("test.%s@localhost", model.NewId()),
		Username: model.NewId(),
	}
	user2, err = ss.User().Save(user2)
	require.NoError(t, err)

	group, err := ss.Group().Create(&model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString(model.NewId()),
	})
	require.NoError(t, err)
	defer ss.Group().Delete(group.Id)

	member1, err := ss.Group().UpsertMember(group.Id, user.Id)
	require.NoError(t, err)
	defer ss.Group().DeleteMember(group.Id, member1.UserId)

	count, err := ss.Group().GroupMemberCount()
	require.NoError(t, err)
	require.GreaterOrEqual(t, count, int64(1))

	member2, err := ss.Group().UpsertMember(group.Id, user2.Id)
	require.NoError(t, err)
	defer ss.Group().DeleteMember(group.Id, member2.UserId)

	countAfter, err := ss.Group().GroupMemberCount()
	require.NoError(t, err)
	require.GreaterOrEqual(t, countAfter, count+1)
}

func groupTestDistinctGroupMemberCount(t *testing.T, ss store.Store) {
	group1, err := ss.Group().Create(&model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString(model.NewId()),
	})
	require.NoError(t, err)
	defer ss.Group().Delete(group1.Id)

	group2, err := ss.Group().Create(&model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString(model.NewId()),
	})
	require.NoError(t, err)
	defer ss.Group().Delete(group2.Id)

	user := &model.User{
		Email:    fmt.Sprintf("test.%s@localhost", model.NewId()),
		Username: model.NewId(),
	}
	user, err = ss.User().Save(user)
	require.NoError(t, err)

	user2 := &model.User{
		Email:    fmt.Sprintf("test.%s@localhost", model.NewId()),
		Username: model.NewId(),
	}
	user2, err = ss.User().Save(user2)
	require.NoError(t, err)

	member1, err := ss.Group().UpsertMember(group1.Id, user.Id)
	require.NoError(t, err)
	defer ss.Group().DeleteMember(group1.Id, member1.UserId)

	count, err := ss.Group().GroupMemberCount()
	require.NoError(t, err)
	require.GreaterOrEqual(t, count, int64(1))

	member2, err := ss.Group().UpsertMember(group1.Id, user2.Id)
	require.NoError(t, err)
	defer ss.Group().DeleteMember(group1.Id, member2.UserId)

	countAfter1, err := ss.Group().GroupMemberCount()
	require.NoError(t, err)
	require.GreaterOrEqual(t, countAfter1, count+1)

	member3, err := ss.Group().UpsertMember(group1.Id, member1.UserId)
	require.NoError(t, err)
	defer ss.Group().DeleteMember(group1.Id, member3.UserId)

	countAfter2, err := ss.Group().GroupMemberCount()
	require.NoError(t, err)
	require.GreaterOrEqual(t, countAfter2, countAfter1)
}

func groupTestGroupCountWithAllowReference(t *testing.T, ss store.Store) {
	initialCount, err := ss.Group().GroupCountWithAllowReference()
	require.NoError(t, err)

	group1, err := ss.Group().Create(&model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString(model.NewId()),
	})
	require.NoError(t, err)
	defer ss.Group().Delete(group1.Id)

	count, err := ss.Group().GroupCountWithAllowReference()
	require.NoError(t, err)
	require.Equal(t, count, initialCount)

	group2, err := ss.Group().Create(&model.Group{
		Name:           model.NewString(model.NewId()),
		DisplayName:    model.NewId(),
		Source:         model.GroupSourceLdap,
		RemoteId:       model.NewString(model.NewId()),
		AllowReference: true,
	})
	require.NoError(t, err)
	defer ss.Group().Delete(group2.Id)

	countAfter, err := ss.Group().GroupCountWithAllowReference()
	require.NoError(t, err)
	require.Greater(t, countAfter, count)
}

func groupTestGetMember(t *testing.T, ss store.Store) {
	g1 := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString(model.NewId()),
	}
	group, err := ss.Group().Create(g1)
	require.NoError(t, err)

	u1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user1, nErr := ss.User().Save(u1)
	require.NoError(t, nErr)

	u2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user2, nErr := ss.User().Save(u2)
	require.NoError(t, nErr)

	_, err = ss.Group().UpsertMember(group.Id, user1.Id)
	require.NoError(t, err)

	member, err := ss.Group().GetMember(g1.Id, u1.Id)
	require.NoError(t, err)
	require.NotNil(t, member)

	member, err = ss.Group().GetMember(g1.Id, user2.Id)
	require.Error(t, err)
	require.Nil(t, member)
}

func groupTestGetNonMemberUsersPage(t *testing.T, ss store.Store) {
	g1 := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString(model.NewId()),
	}
	group, err := ss.Group().Create(g1)
	require.NoError(t, err)

	u1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user1, nErr := ss.User().Save(u1)
	require.NoError(t, nErr)

	u2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	_, nErr = ss.User().Save(u2)
	require.NoError(t, nErr)

	users, err := ss.Group().GetNonMemberUsersPage(group.Id, 0, 1000, nil)
	require.NoError(t, err)

	originalLen := len(users)

	_, err = ss.Group().UpsertMember(group.Id, user1.Id)
	require.NoError(t, err)

	users, err = ss.Group().GetNonMemberUsersPage(group.Id, 0, 1000, nil)
	require.NoError(t, err)
	require.Len(t, users, originalLen-1)

	users, err = ss.Group().GetNonMemberUsersPage(model.NewId(), 0, 1000, nil)
	require.Error(t, err)
	require.Nil(t, users)
}

func groupTestDistinctGroupMemberCountForSource(t *testing.T, ss store.Store) {
	// get the before counts
	customGroupCountBefore, err := ss.Group().DistinctGroupMemberCountForSource(model.GroupSourceCustom)
	require.NoError(t, err)
	ldapGroupCountBefore, err := ss.Group().DistinctGroupMemberCountForSource(model.GroupSourceLdap)
	require.NoError(t, err)

	// create 2 groups, 1 custom and 1 ldap
	g1 := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Source:      model.GroupSourceCustom,
		RemoteId:    model.NewString(model.NewId()),
	}
	customGroup, err := ss.Group().Create(g1)
	require.NoError(t, err)

	g2 := &model.Group{
		Name:        model.NewString(model.NewId()),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Source:      model.GroupSourceLdap,
		RemoteId:    model.NewString(model.NewId()),
	}
	ldapGroup, err := ss.Group().Create(g2)
	require.NoError(t, err)

	// create a couple of users
	u1 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user1, nErr := ss.User().Save(u1)
	require.NoError(t, nErr)

	u2 := &model.User{
		Email:    MakeEmail(),
		Username: model.NewId(),
	}
	user2, nErr := ss.User().Save(u2)
	require.NoError(t, nErr)

	// add both new users to both new groups
	_, err = ss.Group().UpsertMember(customGroup.Id, user1.Id)
	require.NoError(t, err)
	_, err = ss.Group().UpsertMember(ldapGroup.Id, user1.Id)
	require.NoError(t, err)

	_, err = ss.Group().UpsertMember(customGroup.Id, user2.Id)
	require.NoError(t, err)
	_, err = ss.Group().UpsertMember(ldapGroup.Id, user2.Id)
	require.NoError(t, err)

	// remove one user from a group to ensure the 'where deleteat = 0' clause is working
	_, err = ss.Group().DeleteMember(ldapGroup.Id, user1.Id)
	require.NoError(t, err)

	defer func() {
		ss.Group().DeleteMember(ldapGroup.Id, user2.Id)
		ss.Group().DeleteMember(customGroup.Id, user1.Id)
		ss.Group().DeleteMember(customGroup.Id, user2.Id)

		ss.Group().Delete(customGroup.Id)
		ss.Group().Delete(ldapGroup.Id)

		ss.User().PermanentDelete(user1.Id)
		ss.User().PermanentDelete(user2.Id)
	}()

	customGroupCount, err := ss.Group().DistinctGroupMemberCountForSource(model.GroupSourceCustom)
	require.NoError(t, err)
	require.Equal(t, customGroupCountBefore+2, customGroupCount)

	ldapGroupCount, err := ss.Group().DistinctGroupMemberCountForSource(model.GroupSourceLdap)
	require.NoError(t, err)
	require.Equal(t, ldapGroupCountBefore+1, ldapGroupCount)
}
