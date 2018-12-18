// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/model"
	"github.com/stretchr/testify/require"
)

func TestGetGroup(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	group := th.CreateGroup()

	_, err := th.App.GetGroup(group.Id)
	require.Nil(t, err)

	_, err = th.App.GetGroup(model.NewId())
	require.NotNil(t, err)
}

func TestGetGroupByRemoteID(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	group := th.CreateGroup()

	_, err := th.App.GetGroupByRemoteID(group.RemoteId, model.GroupTypeLdap)
	require.Nil(t, err)

	_, err = th.App.GetGroupByRemoteID(model.NewId(), model.GroupTypeLdap)
	require.NotNil(t, err)
}

func TestGetGroupsByType(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	th.CreateGroup()
	th.CreateGroup()
	th.CreateGroup()

	groups, err := th.App.GetGroupsByType(model.GroupTypeLdap)
	require.Nil(t, err)

	require.NotEmpty(t, groups)

	groups, _ = th.App.GetGroupsByType(model.GroupType("blah"))

	require.Empty(t, groups)
}

func TestCreateGroup(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	id := model.NewId()
	group := &model.Group{
		DisplayName: "dn_" + id,
		Name:        "name" + id,
		Type:        model.GroupTypeLdap,
		RemoteId:    model.NewId(),
	}

	_, err := th.App.CreateGroup(group)
	assert.Nil(t, err)

	_, err = th.App.CreateGroup(group)
	assert.NotNil(t, err)
}

func TestUpdateGroup(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	group := th.CreateGroup()
	group.DisplayName = model.NewId()

	_, err := th.App.UpdateGroup(group)
	assert.Nil(t, err)
}

func TestDeleteGroup(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	group := th.CreateGroup()

	_, err := th.App.DeleteGroup(group.Id)
	assert.Nil(t, err)

	_, err = th.App.DeleteGroup(group.Id)
	assert.NotNil(t, err)
}

func TestCreateOrRestoreGroupMember(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	group := th.CreateGroup()

	_, err := th.App.CreateOrRestoreGroupMember(group.Id, th.BasicUser.Id)
	assert.Nil(t, err)

	_, err = th.App.CreateOrRestoreGroupMember(group.Id, th.BasicUser.Id)
	assert.NotNil(t, err)
}

func TestDeleteGroupMember(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	group := th.CreateGroup()
	groupMember, err := th.App.CreateOrRestoreGroupMember(group.Id, th.BasicUser.Id)
	assert.Nil(t, err)

	_, err = th.App.DeleteGroupMember(groupMember.GroupId, groupMember.UserId)
	assert.Nil(t, err)

	_, err = th.App.DeleteGroupMember(groupMember.GroupId, groupMember.UserId)
	assert.NotNil(t, err)
}

func TestCreateGroupSyncable(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	group := th.CreateGroup()
	groupSyncable := &model.GroupSyncable{
		GroupId:    group.Id,
		CanLeave:   true,
		AutoAdd:    false,
		SyncableId: th.BasicTeam.Id,
		Type:       model.GroupSyncableTypeTeam,
	}

	_, err := th.App.CreateGroupSyncable(groupSyncable)
	assert.Nil(t, err)

	_, err = th.App.CreateGroupSyncable(groupSyncable)
	assert.NotNil(t, err)
}

func TestGetGroupSyncable(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	group := th.CreateGroup()
	groupSyncable := &model.GroupSyncable{
		GroupId:    group.Id,
		CanLeave:   true,
		AutoAdd:    false,
		SyncableId: th.BasicTeam.Id,
		Type:       model.GroupSyncableTypeTeam,
	}

	// Create GroupSyncable
	_, err := th.App.CreateGroupSyncable(groupSyncable)
	assert.Nil(t, err)

	_, err = th.App.GetGroupSyncable(group.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam)
	assert.Nil(t, err)
}

func TestGetGroupSyncables(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	group := th.CreateGroup()

	// Create a group team
	groupSyncable := &model.GroupSyncable{
		GroupId:    group.Id,
		CanLeave:   true,
		AutoAdd:    false,
		SyncableId: th.BasicTeam.Id,
		Type:       model.GroupSyncableTypeTeam,
	}

	_, err := th.App.CreateGroupSyncable(groupSyncable)
	assert.Nil(t, err)

	groupTeams, err := th.App.GetGroupSyncables(group.Id, model.GroupSyncableTypeTeam)
	assert.Nil(t, err)

	assert.NotEmpty(t, groupTeams)
}

func TestDeleteGroupSyncable(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	group := th.CreateGroup()
	groupChannel := &model.GroupSyncable{
		GroupId:    group.Id,
		CanLeave:   true,
		AutoAdd:    false,
		SyncableId: th.BasicChannel.Id,
		Type:       model.GroupSyncableTypeChannel,
	}

	// Create GroupSyncable
	_, err := th.App.CreateGroupSyncable(groupChannel)
	assert.Nil(t, err)

	_, err = th.App.DeleteGroupSyncable(group.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel)
	assert.Nil(t, err)

	_, err = th.App.DeleteGroupSyncable(group.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel)
	assert.NotNil(t, err)
}
