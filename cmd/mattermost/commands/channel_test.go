// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"strings"
	"testing"

	"github.com/mattermost/mattermost-server/api4"
	"github.com/mattermost/mattermost-server/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestJoinChannel(t *testing.T) {
	th := api4.Setup().InitBasic()
	defer th.TearDown()

	channel := th.CreatePublicChannel()

	CheckCommand(t, "channel", "add", th.BasicTeam.Name+":"+channel.Name, th.BasicUser2.Email)

	// Joining twice should succeed
	CheckCommand(t, "channel", "add", th.BasicTeam.Name+":"+channel.Name, th.BasicUser2.Email)

	// should fail because channel does not exist
	require.Error(t, RunCommand(t, "channel", "add", th.BasicTeam.Name+":"+channel.Name+"asdf", th.BasicUser2.Email))
}

func TestRemoveChannel(t *testing.T) {
	th := api4.Setup().InitBasic()
	defer th.TearDown()

	channel := th.CreatePublicChannel()

	CheckCommand(t, "channel", "add", th.BasicTeam.Name+":"+channel.Name, th.BasicUser2.Email)

	// should fail because channel does not exist
	require.Error(t, RunCommand(t, "channel", "remove", th.BasicTeam.Name+":doesnotexist", th.BasicUser2.Email))

	CheckCommand(t, "channel", "remove", th.BasicTeam.Name+":"+channel.Name, th.BasicUser2.Email)

	// Leaving twice should succeed
	CheckCommand(t, "channel", "remove", th.BasicTeam.Name+":"+channel.Name, th.BasicUser2.Email)
}

func TestMoveChannel(t *testing.T) {
	th := api4.Setup().InitBasic()
	defer th.TearDown()

	team1 := th.BasicTeam
	team2 := th.CreateTeam()
	user1 := th.BasicUser
	th.LinkUserToTeam(user1, team2)
	channel := th.BasicChannel

	th.LinkUserToTeam(user1, team1)
	th.LinkUserToTeam(user1, team2)

	adminEmail := user1.Email
	adminUsername := user1.Username
	origin := team1.Name + ":" + channel.Name
	dest := team2.Name

	CheckCommand(t, "channel", "add", origin, adminEmail)

	// should fail with nill because errors are logged instead of returned when a channel does not exist
	require.Nil(t, RunCommand(t, "channel", "move", dest, team1.Name+":doesnotexist", "--username", adminUsername))

	CheckCommand(t, "channel", "move", dest, origin, "--username", adminUsername)
}

func TestListChannels(t *testing.T) {
	th := api4.Setup().InitBasic()
	defer th.TearDown()

	channel := th.CreatePublicChannel()
	th.Client.Must(th.Client.DeleteChannel(channel.Id))

	output := CheckCommand(t, "channel", "list", th.BasicTeam.Name)

	if !strings.Contains(string(output), "town-square") {
		t.Fatal("should have channels")
	}

	if !strings.Contains(string(output), channel.Name+" (archived)") {
		t.Fatal("should have archived channel")
	}
}

func TestRestoreChannel(t *testing.T) {
	th := api4.Setup().InitBasic()
	defer th.TearDown()

	channel := th.CreatePublicChannel()
	th.Client.Must(th.Client.DeleteChannel(channel.Id))

	CheckCommand(t, "channel", "restore", th.BasicTeam.Name+":"+channel.Name)

	// restoring twice should succeed
	CheckCommand(t, "channel", "restore", th.BasicTeam.Name+":"+channel.Name)
}

func TestCreateChannel(t *testing.T) {
	th := api4.Setup().InitBasic()
	defer th.TearDown()

	id := model.NewId()
	name := "name" + id

	CheckCommand(t, "channel", "create", "--display_name", name, "--team", th.BasicTeam.Name, "--name", name)

	name = name + "-private"
	CheckCommand(t, "channel", "create", "--display_name", name, "--team", th.BasicTeam.Name, "--private", "--name", name)
}

func TestRenameChannel(t *testing.T) {
	th := api4.Setup().InitBasic()
	defer th.TearDown()

	channel := th.CreatePublicChannel()
	CheckCommand(t, "channel", "rename", th.BasicTeam.Name+":"+channel.Name, "newchannelname10", "--display_name", "New Display Name")

	// Get the channel from the DB
	updatedChannel, _ := th.App.GetChannel(channel.Id)
	assert.Equal(t, "newchannelname10", updatedChannel.Name)
	assert.Equal(t, "New Display Name", updatedChannel.DisplayName)
}
