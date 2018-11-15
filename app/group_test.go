// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
)

func TestGetGroup(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	group := th.CreateGroup()

	if _, err := th.App.GetGroup(group.Id); err != nil {
		t.Log(err)
		t.Fatal("Should get the group")
	}

	if _, err := th.App.GetGroup(model.NewId()); err == nil {
		t.Fatal("Should not have found a group")
	}
}

func TestGetGroupByRemoteID(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	group := th.CreateGroup()

	if _, err := th.App.GetGroupByRemoteID(group.RemoteId, model.GroupTypeLdap); err != nil {
		t.Log(err)
		t.Fatal("Should get the group")
	}

	if _, err := th.App.GetGroupByRemoteID(model.NewId(), model.GroupTypeLdap); err == nil {
		t.Fatal("Should not have found a group")
	}
}

func TestGetGroupsByType(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	th.CreateGroup()
	th.CreateGroup()
	th.CreateGroup()

	groups, err := th.App.GetGroupsByType(model.GroupTypeLdap)
	if err != nil {
		t.Log(err)
		t.Fatal("Should have groups")
	}

	if len(groups) < 1 {
		t.Fatal("Should have retrieved at least one group")
	}

	if groups, _ = th.App.GetGroupsByType(model.GroupType("blah")); len(groups) > 0 {
		t.Fatal("Should not have groups.")
	}
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

	if _, err := th.App.CreateGroup(group); err != nil {
		t.Log(err)
		t.Fatal("Should create a new group")
	}

	if _, err := th.App.CreateGroup(group); err == nil {
		t.Fatal("Should not create a new group - group already exist")
	}
}

func TestUpdateGroup(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	group := th.CreateGroup()
	group.DisplayName = model.NewId()

	if _, err := th.App.UpdateGroup(group); err != nil {
		t.Log(err)
		t.Fatal("Should update the group")
	}
}

func TestDeleteGroup(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	group := th.CreateGroup()

	if _, err := th.App.DeleteGroup(group.Id); err != nil {
		t.Log(err)
		t.Fatal("Should delete the group")
	}

	if _, err := th.App.DeleteGroup(group.Id); err == nil {
		t.Fatal("Should not delete the group again - group already deleted")
	}
}

func TestCreateOrRestoreGroupMember(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	group := th.CreateGroup()

	if _, err := th.App.CreateOrRestoreGroupMember(group.Id, th.BasicUser.Id); err != nil {
		t.Log(err)
		t.Fatal("Should create a group member")
	}

	if _, err := th.App.CreateOrRestoreGroupMember(group.Id, th.BasicUser.Id); err == nil {
		t.Fatal("Should not create a new group member - group member already exist")
	}
}

func TestDeleteGroupMember(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	group := th.CreateGroup()
	groupMember, err := th.App.CreateOrRestoreGroupMember(group.Id, th.BasicUser.Id)
	if err != nil {
		t.Log(err)
		t.Fatal("Should create a group member")
	}

	if _, err := th.App.DeleteGroupMember(groupMember.GroupId, groupMember.UserId); err != nil {
		t.Log(err)
		t.Fatal("Should delete group member")
	}

	if _, err := th.App.DeleteGroupMember(groupMember.GroupId, groupMember.UserId); err == nil {
		t.Fatal("Should not re-delete group member - group member already deleted")
	}
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

	if _, err := th.App.CreateGroupSyncable(groupSyncable); err != nil {
		t.Log(err)
		t.Fatal("Should create group team")
	}

	if _, err := th.App.CreateGroupSyncable(groupSyncable); err == nil {
		t.Fatal("Should not create group team - group team already exists")
	}
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
	if _, err := th.App.CreateGroupSyncable(groupSyncable); err != nil {
		t.Log(err)
		t.Fatal("Should create group team")
	}

	if _, err := th.App.GetGroupSyncable(group.Id, th.BasicTeam.Id, model.GroupSyncableTypeTeam); err != nil {
		t.Log(err)
		t.Fatal("Should delete group team")
	}
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

	if _, err := th.App.CreateGroupSyncable(groupSyncable); err != nil {
		t.Log(err)
		t.Fatal("Should create group team")
	}

	groupTeams, err := th.App.GetGroupSyncables(group.Id, model.GroupSyncableTypeTeam)
	if err != nil {
		t.Log(err)
		t.Fatal("Should have group teams")
	}

	if len(groupTeams) < 1 {
		t.Fatal("Should have retrieved at least one group team")
	}
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
	if _, err := th.App.CreateGroupSyncable(groupChannel); err != nil {
		t.Log(err)
		t.Fatal("Should create group channel")
	}

	if _, err := th.App.DeleteGroupSyncable(group.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel); err != nil {
		t.Log(err)
		t.Fatal("Should delete group channel")
	}

	if _, err := th.App.DeleteGroupSyncable(group.Id, th.BasicChannel.Id, model.GroupSyncableTypeChannel); err == nil {
		t.Fatal("Should not re-delete group channel - group channel already deleted")
	}
}
