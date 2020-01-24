// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/stretchr/testify/require"
)

func TestCreateDefaultMemberships(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	singersTeam, err := th.App.CreateTeam(&model.Team{
		DisplayName: "Singers",
		Name:        model.NewId(),
		Email:       "singers@test.com",
		Type:        model.TEAM_OPEN,
	})
	if err != nil {
		t.Errorf("test team not created: %s", err.Error())
	}

	nerdsTeam, err := th.App.CreateTeam(&model.Team{
		DisplayName: "Nerds",
		Name:        model.NewId(),
		Email:       "nerds@test.com",
		Type:        model.TEAM_INVITE,
	})
	if err != nil {
		t.Errorf("test team not created: %s", err.Error())
	}

	practiceChannel, err := th.App.CreateChannel(&model.Channel{
		TeamId:      singersTeam.Id,
		DisplayName: "Practices",
		Name:        model.NewId(),
		Type:        model.CHANNEL_OPEN,
	}, false)
	if err != nil {
		t.Errorf("test channel not created: %s", err.Error())
	}

	experimentsChannel, err := th.App.CreateChannel(&model.Channel{
		TeamId:      singersTeam.Id,
		DisplayName: "Experiments",
		Name:        model.NewId(),
		Type:        model.CHANNEL_PRIVATE,
	}, false)
	if err != nil {
		t.Errorf("test channel not created: %s", err.Error())
	}

	gleeGroup, err := th.App.CreateGroup(&model.Group{
		Name:        model.NewId(),
		DisplayName: "Glee Club",
		RemoteId:    model.NewId(),
		Source:      model.GroupSourceLdap,
	})
	if err != nil {
		t.Errorf("test group not created: %s", err.Error())
	}

	scienceGroup, err := th.App.CreateGroup(&model.Group{
		Name:        model.NewId(),
		DisplayName: "Science Club",
		RemoteId:    model.NewId(),
		Source:      model.GroupSourceLdap,
	})
	if err != nil {
		t.Errorf("test group not created: %s", err.Error())
	}

	_, err = th.App.UpsertGroupSyncable(model.NewGroupChannel(gleeGroup.Id, practiceChannel.Id, true))
	if err != nil {
		t.Errorf("test groupchannel not created: %s", err.Error())
	}

	scienceTeamGroupSyncable, err := th.App.UpsertGroupSyncable(model.NewGroupTeam(scienceGroup.Id, nerdsTeam.Id, false))
	if err != nil {
		t.Errorf("test groupteam not created: %s", err.Error())
	}

	scienceChannelGroupSyncable, err := th.App.UpsertGroupSyncable(model.NewGroupChannel(scienceGroup.Id, experimentsChannel.Id, false))
	if err != nil {
		t.Errorf("test groupchannel not created: %s", err.Error())
	}

	singer1 := th.BasicUser
	scientist1 := th.BasicUser2

	_, err = th.App.UpsertGroupMember(gleeGroup.Id, singer1.Id)
	if err != nil {
		t.Errorf("test groupmember not created: %s", err.Error())
	}

	scientistGroupMember, err := th.App.UpsertGroupMember(scienceGroup.Id, scientist1.Id)
	if err != nil {
		t.Errorf("test groupmember not created: %s", err.Error())
	}

	pErr := th.App.CreateDefaultMemberships(0)
	if pErr != nil {
		t.Errorf("faild to populate syncables: %s", pErr.Error())
	}

	// Singer should be in team and channel
	_, err = th.App.GetTeamMember(singersTeam.Id, singer1.Id)
	if err != nil {
		t.Errorf("error retrieving team member: %s", err.Error())
	}
	_, err = th.App.GetChannelMember(practiceChannel.Id, singer1.Id)
	if err != nil {
		t.Errorf("error retrieving channel member: %s", err.Error())
	}

	tMembers, err := th.App.GetTeamMembers(singersTeam.Id, 0, 999, nil)
	if err != nil {
		t.Errorf("error retrieving team members: %s", err.Error())
	}
	expected := 1
	actual := len(tMembers)
	if actual != expected {
		t.Errorf("expected %d team members but got %d", expected, actual)
	}

	cMembersCount, err := th.App.GetChannelMemberCount(practiceChannel.Id)
	if err != nil {
		t.Errorf("error retrieving team members: %s", err.Error())
	}
	if cMembersCount != int64(expected) {
		t.Errorf("expected %d team member but got %d", expected, cMembersCount)
	}

	// Scientist should not be in team or channel
	_, err = th.App.GetTeamMember(nerdsTeam.Id, scientist1.Id)
	if err.Id != "store.sql_team.get_member.missing.app_error" {
		t.Errorf("wrong error: %s", err.Id)
	}

	_, err = th.App.GetChannelMember(experimentsChannel.Id, scientist1.Id)
	if err.Id != "store.sql_channel.get_member.missing.app_error" {
		t.Errorf("wrong error: %s", err.Id)
	}

	tMembers, err = th.App.GetTeamMembers(nerdsTeam.Id, 0, 999, nil)
	if err != nil {
		t.Errorf("error retrieving team members: %s", err.Error())
	}
	expected = 0
	actual = len(tMembers)
	if actual != expected {
		t.Errorf("expected %d team members but got %d", expected, actual)
	}

	cMembersCount, err = th.App.GetChannelMemberCount(experimentsChannel.Id)
	if err != nil {
		t.Errorf("error retrieving team members: %s", err.Error())
	}
	if cMembersCount != int64(expected) {
		t.Errorf("expected %d team members but got %d", expected, cMembersCount)
	}

	// update AutoAdd to true
	scienceTeamGroupSyncable.AutoAdd = true
	scienceTeamGroupSyncable, err = th.App.UpdateGroupSyncable(scienceTeamGroupSyncable)
	if err != nil {
		t.Errorf("error updating group syncable: %s", err.Error())
	}

	// Sync everything after syncable was created (proving that team updates trigger re-sync)
	pErr = th.App.CreateDefaultMemberships(scientistGroupMember.CreateAt + 1)
	if pErr != nil {
		t.Errorf("faild to populate syncables: %s", pErr.Error())
	}

	// Scientist should be in team but not the channel
	_, err = th.App.GetTeamMember(nerdsTeam.Id, scientist1.Id)
	if err != nil {
		t.Errorf("error retrieving team member: %s", err.Error())
	}

	_, err = th.App.GetChannelMember(experimentsChannel.Id, scientist1.Id)
	if err.Id != "store.sql_channel.get_member.missing.app_error" {
		t.Errorf("wrong error: %s", err.Id)
	}

	tMembers, err = th.App.GetTeamMembers(nerdsTeam.Id, 0, 999, nil)
	if err != nil {
		t.Errorf("error retrieving team members: %s", err.Error())
	}
	expected = 1
	actual = len(tMembers)
	if actual != expected {
		t.Errorf("expected %d team members but got %d", expected, actual)
	}

	expected = 0
	cMembersCount, err = th.App.GetChannelMemberCount(experimentsChannel.Id)
	if err != nil {
		t.Errorf("error retrieving team members: %s", err.Error())
	}
	if cMembersCount != int64(expected) {
		t.Errorf("expected %d team members but got %d", expected, cMembersCount)
	}

	// Update the channel syncable
	scienceChannelGroupSyncable.AutoAdd = true
	scienceChannelGroupSyncable, err = th.App.UpdateGroupSyncable(scienceChannelGroupSyncable)
	if err != nil {
		t.Errorf("error updating group syncable: %s", err.Error())
	}

	// Sync everything after syncable was created (proving that channel updates trigger re-sync)
	pErr = th.App.CreateDefaultMemberships(scientistGroupMember.CreateAt + 1)
	if pErr != nil {
		t.Errorf("faild to populate syncables: %s", pErr.Error())
	}

	expected = 1
	cMembersCount, err = th.App.GetChannelMemberCount(experimentsChannel.Id)
	if err != nil {
		t.Errorf("error retrieving team members: %s", err.Error())
	}
	if cMembersCount != int64(expected) {
		t.Errorf("expected %d team members but got %d", expected, cMembersCount)
	}

	// singer leaves team and channel
	err = th.App.LeaveChannel(practiceChannel.Id, singer1.Id)
	if err != nil {
		t.Errorf("error leaving channel: %s", err.Error())
	}
	err = th.App.LeaveTeam(singersTeam, singer1, "")
	if err != nil {
		t.Errorf("error leaving team: %s", err.Error())
	}

	// Even re-syncing from the beginning doesn't re-add to channel or team
	pErr = th.App.CreateDefaultMemberships(0)
	if pErr != nil {
		t.Errorf("faild to populate syncables: %s", pErr.Error())
	}

	// Singer should not be in team or channel
	tMember, err := th.App.GetTeamMember(singersTeam.Id, singer1.Id)
	if err != nil {
		t.Errorf("error retrieving team member: %s", err.Error())
	}
	if tMember.DeleteAt == 0 {
		t.Error("expected team member to remain deleted")
	}

	_, err = th.App.GetChannelMember(practiceChannel.Id, singer1.Id)
	if err == nil {
		t.Error("Expected channel member to remain deleted")
	}

	// Ensure members are in channel
	_, err = th.App.AddChannelMember(scientist1.Id, experimentsChannel, "", "")
	if err != nil {
		t.Errorf("unable to add user to channel: %s", err.Error())
	}

	// Add other user so that user can leave channel
	_, err = th.App.AddTeamMember(singersTeam.Id, singer1.Id)
	if err != nil {
		t.Errorf("unable to add user to team: %s", err.Error())
	}
	_, err = th.App.AddChannelMember(singer1.Id, experimentsChannel, "", "")
	if err != nil {
		t.Errorf("unable to add user to channel: %s", err.Error())
	}

	// the channel syncable is updated
	scienceChannelGroupSyncable, err = th.App.UpdateGroupSyncable(scienceChannelGroupSyncable)
	if err != nil {
		t.Errorf("error updating group syncable: %s", err.Error())
	}

	pErr = th.App.CreateDefaultMemberships(0)
	if pErr != nil {
		t.Errorf("faild to populate syncables: %s", pErr.Error())
	}

	timeBeforeLeaving := model.GetMillis()

	// User leaves channel
	err = th.App.LeaveChannel(experimentsChannel.Id, scientist1.Id)
	if err != nil {
		t.Errorf("unable to add user to channel: %s", err.Error())
	}

	timeAfterLeaving := model.GetMillis()

	// Purging channelmemberhistory doesn't re-add user to channel
	_, err = th.App.Srv.Store.ChannelMemberHistory().PermanentDeleteBatch(timeBeforeLeaving, 1000)
	if err != nil {
		t.Errorf("error permanently deleting channelmemberhistory: %s", err.Error())
	}

	pErr = th.App.CreateDefaultMemberships(scienceChannelGroupSyncable.UpdateAt)
	if pErr != nil {
		t.Errorf("failed to populate syncables: %s", pErr.Error())
	}

	_, err = th.App.GetChannelMember(experimentsChannel.Id, scientist1.Id)
	if err == nil {
		t.Error("Expected channel member to remain deleted")
	}

	// Purging channelmemberhistory doesn't re-add user to channel
	_, err = th.App.Srv.Jobs.Store.ChannelMemberHistory().PermanentDeleteBatch(timeAfterLeaving, 1000)
	if err != nil {
		t.Errorf("error permanently deleting channelmemberhistory: %s", err.Error())
	}

	pErr = th.App.CreateDefaultMemberships(scienceChannelGroupSyncable.UpdateAt)
	if pErr != nil {
		t.Errorf("failed to populate syncables: %s", pErr.Error())
	}

	// Channel member is re-added.
	_, err = th.App.GetChannelMember(experimentsChannel.Id, scientist1.Id)
	if err != nil {
		t.Errorf("expected channel member: %s", err.Error())
	}
}

func TestDeleteGroupMemberships(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	group := th.CreateGroup()

	userIDs := []string{th.BasicUser.Id, th.BasicUser2.Id, th.SystemAdminUser.Id}

	var err *model.AppError
	// add users to teams and channels
	for _, userID := range userIDs {
		_, err = th.App.AddTeamMember(th.BasicTeam.Id, userID)
		require.Nil(t, err)

		_, err = th.App.AddChannelMember(userID, th.BasicChannel, "", "")
		require.Nil(t, err)
	}

	// make team group-constrained
	team := th.BasicTeam
	team.GroupConstrained = model.NewBool(true)
	team, err = th.App.UpdateTeam(team)
	require.Nil(t, err)
	require.True(t, *team.GroupConstrained)

	// make channel group-constrained
	channel := th.BasicChannel
	channel.GroupConstrained = model.NewBool(true)
	channel, err = th.App.UpdateChannel(channel)
	require.Nil(t, err)
	require.True(t, *channel.GroupConstrained)

	// create groupteam and groupchannel
	_, err = th.App.UpsertGroupSyncable(model.NewGroupTeam(group.Id, team.Id, true))
	require.Nil(t, err)
	_, err = th.App.UpsertGroupSyncable(model.NewGroupChannel(group.Id, channel.Id, true))
	require.Nil(t, err)

	// verify the member count
	tmembers, err := th.App.GetTeamMembers(th.BasicTeam.Id, 0, 100, nil)
	require.Nil(t, err)
	require.Len(t, tmembers, 3)

	cmemberCount, err := th.App.GetChannelMemberCount(th.BasicChannel.Id)
	require.Nil(t, err)
	require.Equal(t, 3, int(cmemberCount))

	// add a user to the group
	_, err = th.App.UpsertGroupMember(group.Id, th.SystemAdminUser.Id)
	require.Nil(t, err)

	// run the delete
	appErr := th.App.DeleteGroupConstrainedMemberships()
	require.Nil(t, appErr)

	// verify the new member counts
	tmembers, err = th.App.GetTeamMembers(th.BasicTeam.Id, 0, 100, nil)
	require.Nil(t, err)
	require.Len(t, tmembers, 1)
	require.Equal(t, th.SystemAdminUser.Id, tmembers[0].UserId)

	cmembers, err := th.App.GetChannelMembersPage(channel.Id, 0, 99)
	require.Nil(t, err)
	require.Len(t, (*cmembers), 1)
	require.Equal(t, th.SystemAdminUser.Id, (*cmembers)[0].UserId)
}

func TestSyncSyncableRoles(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	team := th.CreateTeam()

	channel := th.CreateChannel(team)
	channel.GroupConstrained = model.NewBool(true)
	channel, err := th.App.UpdateChannel(channel)
	require.Nil(t, err)

	user1 := th.CreateUser()
	user2 := th.CreateUser()
	group := th.CreateGroup()

	teamSyncable, err := th.App.UpsertGroupSyncable(&model.GroupSyncable{
		SyncableId: team.Id,
		Type:       model.GroupSyncableTypeTeam,
		GroupId:    group.Id,
	})
	require.Nil(t, err)

	channelSyncable, err := th.App.UpsertGroupSyncable(&model.GroupSyncable{
		SyncableId: channel.Id,
		Type:       model.GroupSyncableTypeChannel,
		GroupId:    group.Id,
	})
	require.Nil(t, err)

	for _, user := range []*model.User{user1, user2} {
		_, err = th.App.UpsertGroupMember(group.Id, user.Id)
		require.Nil(t, err)

		var tm *model.TeamMember
		tm, err = th.App.AddTeamMember(team.Id, user.Id)
		require.Nil(t, err)
		require.False(t, tm.SchemeAdmin)

		cm := th.AddUserToChannel(user, channel)
		require.False(t, cm.SchemeAdmin)
	}

	teamSyncable.SchemeAdmin = true
	_, err = th.App.UpdateGroupSyncable(teamSyncable)
	require.Nil(t, err)

	channelSyncable.SchemeAdmin = true
	_, err = th.App.UpdateGroupSyncable(channelSyncable)
	require.Nil(t, err)

	err = th.App.SyncSyncableRoles(channel.Id, model.GroupSyncableTypeChannel)
	require.Nil(t, err)

	err = th.App.SyncSyncableRoles(team.Id, model.GroupSyncableTypeTeam)
	require.Nil(t, err)

	for _, user := range []*model.User{user1, user2} {
		tm, err := th.App.GetTeamMember(team.Id, user.Id)
		require.Nil(t, err)
		require.True(t, tm.SchemeAdmin)

		cm, err := th.App.GetChannelMember(channel.Id, user.Id)
		require.Nil(t, err)
		require.True(t, cm.SchemeAdmin)
	}
}
