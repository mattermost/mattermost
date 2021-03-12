// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
)

func TestChannelGroupEnable(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// create public channel
	channel := th.CreatePublicChannel()

	// try to enable, should fail it is private
	require.Error(t, th.RunCommand(t, "group", "channel", "enable", th.BasicTeam.Name+":"+channel.Name))

	channel = th.CreatePrivateChannel()

	// try to enable, should fail because channel has no groups
	require.Error(t, th.RunCommand(t, "group", "channel", "enable", th.BasicTeam.Name+":"+channel.Name))

	// add group
	id := model.NewId()
	group, err := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewId(),
	})
	require.Nil(t, err)

	_, err = th.App.UpsertGroupSyncable(&model.GroupSyncable{
		AutoAdd:    true,
		SyncableId: channel.Id,
		Type:       model.GroupSyncableTypeChannel,
		GroupId:    group.Id,
	})
	require.Nil(t, err)

	// enabling should succeed now
	th.CheckCommand(t, "group", "channel", "enable", th.BasicTeam.Name+":"+channel.Name)
	channel, appErr := th.App.GetChannelByName(channel.Name, th.BasicTeam.Id, false)
	require.Nil(t, appErr)
	require.NotNil(t, channel.GroupConstrained)
	require.True(t, *channel.GroupConstrained)

	// try to enable nonexistent channel, should fail
	require.Error(t, th.RunCommand(t, "group", "channel", "enable", th.BasicTeam.Name+":"+channel.Name+"asdf"))
}

func TestChannelGroupDisable(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// create private channel
	channel := th.CreatePrivateChannel()

	// try to disable, should work
	th.CheckCommand(t, "group", "channel", "disable", th.BasicTeam.Name+":"+channel.Name)
	channel, appErr := th.App.GetChannelByName(channel.Name, th.BasicTeam.Id, false)
	require.Nil(t, appErr)
	require.NotNil(t, channel.GroupConstrained)
	require.False(t, *channel.GroupConstrained)

	// add group and enable
	id := model.NewId()
	group, err := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewId(),
	})
	require.Nil(t, err)

	_, err = th.App.UpsertGroupSyncable(&model.GroupSyncable{
		AutoAdd:    true,
		SyncableId: channel.Id,
		Type:       model.GroupSyncableTypeChannel,
		GroupId:    group.Id,
	})
	require.Nil(t, err)

	th.CheckCommand(t, "group", "channel", "enable", th.BasicTeam.Name+":"+channel.Name)
	channel, appErr = th.App.GetChannelByName(channel.Name, th.BasicTeam.Id, false)
	require.Nil(t, appErr)
	require.NotNil(t, channel.GroupConstrained)
	require.True(t, *channel.GroupConstrained)

	// try to disable, should work
	th.CheckCommand(t, "group", "channel", "disable", th.BasicTeam.Name+":"+channel.Name)
	channel, appErr = th.App.GetChannelByName(channel.Name, th.BasicTeam.Id, false)
	require.Nil(t, appErr)
	require.NotNil(t, channel.GroupConstrained)
	require.False(t, *channel.GroupConstrained)

	// try to disable nonexistent channel, should fail
	require.Error(t, th.RunCommand(t, "group", "channel", "disable", th.BasicTeam.Name+":"+channel.Name+"asdf"))
}

func TestChannelGroupStatus(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// create private channel
	channel := th.CreatePrivateChannel()

	// get status, should be Disabled
	output := th.CheckCommand(t, "group", "channel", "status", th.BasicTeam.Name+":"+channel.Name)
	require.Contains(t, output, "Disabled")

	// add group and enable
	id := model.NewId()
	group, err := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewId(),
	})
	require.Nil(t, err)

	_, err = th.App.UpsertGroupSyncable(&model.GroupSyncable{
		AutoAdd:    true,
		SyncableId: channel.Id,
		Type:       model.GroupSyncableTypeChannel,
		GroupId:    group.Id,
	})
	require.Nil(t, err)

	th.CheckCommand(t, "group", "channel", "enable", th.BasicTeam.Name+":"+channel.Name)
	channel, appErr := th.App.GetChannelByName(channel.Name, th.BasicTeam.Id, false)
	require.Nil(t, appErr)
	require.NotNil(t, channel.GroupConstrained)
	require.True(t, *channel.GroupConstrained)

	// get status, should be enabled
	output = th.CheckCommand(t, "group", "channel", "status", th.BasicTeam.Name+":"+channel.Name)
	require.Contains(t, output, "Enabled")

	// try to get status of nonexistent channel, should fail
	require.Error(t, th.RunCommand(t, "group", "channel", "status", th.BasicTeam.Name+":"+channel.Name+"asdf"))
}

func TestChannelGroupList(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// create private channel
	channel := th.CreatePrivateChannel()

	// list groups for a channel with none, should work
	th.CheckCommand(t, "group", "channel", "list", th.BasicTeam.Name+":"+channel.Name)

	// add groups and enable
	id1 := model.NewId()
	g1, err := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id1,
		Name:        model.NewString("name" + id1),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id1,
		RemoteId:    model.NewId(),
	})
	require.Nil(t, err)

	_, err = th.App.UpsertGroupSyncable(&model.GroupSyncable{
		AutoAdd:    true,
		SyncableId: channel.Id,
		Type:       model.GroupSyncableTypeChannel,
		GroupId:    g1.Id,
	})
	require.Nil(t, err)

	id2 := model.NewId()
	g2, err := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id2,
		Name:        model.NewString("name" + id2),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id2,
		RemoteId:    model.NewId(),
	})
	require.Nil(t, err)

	_, err = th.App.UpsertGroupSyncable(&model.GroupSyncable{
		AutoAdd:    true,
		SyncableId: channel.Id,
		Type:       model.GroupSyncableTypeChannel,
		GroupId:    g2.Id,
	})
	require.Nil(t, err)

	th.CheckCommand(t, "group", "channel", "enable", th.BasicTeam.Name+":"+channel.Name)
	channel, appErr := th.App.GetChannelByName(channel.Name, th.BasicTeam.Id, false)
	require.Nil(t, appErr)
	require.NotNil(t, channel.GroupConstrained)
	require.True(t, *channel.GroupConstrained)

	// list groups
	output := th.CheckCommand(t, "group", "channel", "list", th.BasicTeam.Name+":"+channel.Name)
	require.Contains(t, output, g1.DisplayName)
	require.Contains(t, output, g2.DisplayName)

	// try to get list of nonexistent channel, should fail
	require.Error(t, th.RunCommand(t, "group", "channel", "list", th.BasicTeam.Name+":"+channel.Name+"asdf"))
}

func TestTeamGroupEnable(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// try to enable, should fail because team has no groups
	require.Error(t, th.RunCommand(t, "group", "team", "enable", th.BasicTeam.Name))

	// add group
	id := model.NewId()
	group, err := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewId(),
	})
	require.Nil(t, err)

	_, err = th.App.UpsertGroupSyncable(&model.GroupSyncable{
		AutoAdd:    true,
		SyncableId: th.BasicTeam.Id,
		Type:       model.GroupSyncableTypeTeam,
		GroupId:    group.Id,
	})
	require.Nil(t, err)

	// enabling should succeed now
	th.CheckCommand(t, "group", "team", "enable", th.BasicTeam.Name)
	team, appErr := th.App.GetTeamByName(th.BasicTeam.Name)
	require.Nil(t, appErr)
	require.NotNil(t, team.GroupConstrained)
	require.True(t, *team.GroupConstrained)

	// try to enable nonexistent team, should fail
	require.Error(t, th.RunCommand(t, "group", "team", "enable", th.BasicTeam.Name+"asdf"))
}

func TestTeamGroupDisable(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// try to disable, should work
	th.CheckCommand(t, "group", "team", "disable", th.BasicTeam.Name)
	team, appErr := th.App.GetTeamByName(th.BasicTeam.Name)
	require.Nil(t, appErr)
	require.NotNil(t, team.GroupConstrained)
	require.False(t, *team.GroupConstrained)

	// add group and enable
	id := model.NewId()
	group, err := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewId(),
	})
	require.Nil(t, err)

	_, err = th.App.UpsertGroupSyncable(&model.GroupSyncable{
		AutoAdd:    true,
		SyncableId: team.Id,
		Type:       model.GroupSyncableTypeTeam,
		GroupId:    group.Id,
	})
	require.Nil(t, err)

	th.CheckCommand(t, "group", "team", "enable", th.BasicTeam.Name)
	team, appErr = th.App.GetTeamByName(th.BasicTeam.Name)
	require.Nil(t, appErr)
	require.NotNil(t, team.GroupConstrained)
	require.True(t, *team.GroupConstrained)

	// try to disable, should work
	th.CheckCommand(t, "group", "team", "disable", th.BasicTeam.Name)
	team, appErr = th.App.GetTeamByName(th.BasicTeam.Name)
	require.Nil(t, appErr)
	require.NotNil(t, team.GroupConstrained)
	require.False(t, *team.GroupConstrained)

	// try to disable nonexistent team, should fail
	require.Error(t, th.RunCommand(t, "group", "team", "disable", th.BasicTeam.Name+"asdf"))
}

func TestTeamGroupStatus(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// get status, should be Disabled
	output := th.CheckCommand(t, "group", "team", "status", th.BasicTeam.Name)
	require.Contains(t, output, "Disabled")

	// add group and enable
	id := model.NewId()
	group, err := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id,
		Name:        model.NewString("name" + id),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id,
		RemoteId:    model.NewId(),
	})
	require.Nil(t, err)

	_, err = th.App.UpsertGroupSyncable(&model.GroupSyncable{
		AutoAdd:    true,
		SyncableId: th.BasicTeam.Id,
		Type:       model.GroupSyncableTypeTeam,
		GroupId:    group.Id,
	})
	require.Nil(t, err)

	th.CheckCommand(t, "group", "team", "enable", th.BasicTeam.Name)
	team, appErr := th.App.GetTeamByName(th.BasicTeam.Name)
	require.Nil(t, appErr)
	require.NotNil(t, team.GroupConstrained)
	require.True(t, *team.GroupConstrained)

	// get status, should be enabled
	output = th.CheckCommand(t, "group", "team", "status", th.BasicTeam.Name)
	require.Contains(t, output, "Enabled")

	// try to get status of nonexistent channel, should fail
	require.Error(t, th.RunCommand(t, "group", "team", "status", th.BasicTeam.Name+"asdf"))
}

func TestTeamGroupList(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// list groups for a team with none, should work
	th.CheckCommand(t, "group", "team", "list", th.BasicTeam.Name)

	// add groups and enable
	id1 := model.NewId()
	g1, err := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id1,
		Name:        model.NewString("name" + id1),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id1,
		RemoteId:    model.NewId(),
	})
	require.Nil(t, err)

	_, err = th.App.UpsertGroupSyncable(&model.GroupSyncable{
		AutoAdd:    true,
		SyncableId: th.BasicTeam.Id,
		Type:       model.GroupSyncableTypeTeam,
		GroupId:    g1.Id,
	})
	require.Nil(t, err)

	id2 := model.NewId()
	g2, err := th.App.CreateGroup(&model.Group{
		DisplayName: "dn_" + id2,
		Name:        model.NewString("name" + id2),
		Source:      model.GroupSourceLdap,
		Description: "description_" + id2,
		RemoteId:    model.NewId(),
	})
	require.Nil(t, err)

	_, err = th.App.UpsertGroupSyncable(&model.GroupSyncable{
		AutoAdd:    true,
		SyncableId: th.BasicTeam.Id,
		Type:       model.GroupSyncableTypeTeam,
		GroupId:    g2.Id,
	})
	require.Nil(t, err)

	th.CheckCommand(t, "group", "team", "enable", th.BasicTeam.Name)
	team, appErr := th.App.GetTeamByName(th.BasicTeam.Name)
	require.Nil(t, appErr)
	require.NotNil(t, team.GroupConstrained)
	require.True(t, *team.GroupConstrained)

	// list groups
	output := th.CheckCommand(t, "group", "team", "list", th.BasicTeam.Name)
	require.Contains(t, output, g1.DisplayName)
	require.Contains(t, output, g2.DisplayName)

	// try to get list of nonexistent team, should fail
	require.Error(t, th.RunCommand(t, "group", "team", "list", th.BasicTeam.Name+"asdf"))
}
