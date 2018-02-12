// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package main

import (
	"strings"
	"testing"

	"github.com/mattermost/mattermost-server/api"
	"github.com/mattermost/mattermost-server/model"
	"github.com/stretchr/testify/require"
)

func TestJoinChannel(t *testing.T) {
	th := api.Setup().InitBasic()
	defer th.TearDown()

	channel := th.CreateChannel(th.BasicClient, th.BasicTeam)

	checkCommand(t, "channel", "add", th.BasicTeam.Name+":"+channel.Name, th.BasicUser2.Email)

	// Joining twice should succeed
	checkCommand(t, "channel", "add", th.BasicTeam.Name+":"+channel.Name, th.BasicUser2.Email)

	// should fail because channel does not exist
	require.Error(t, runCommand(t, "channel", "add", th.BasicTeam.Name+":"+channel.Name+"asdf", th.BasicUser2.Email))
}

func TestRemoveChannel(t *testing.T) {
	th := api.Setup().InitBasic()
	defer th.TearDown()

	channel := th.CreateChannel(th.BasicClient, th.BasicTeam)

	checkCommand(t, "channel", "add", th.BasicTeam.Name+":"+channel.Name, th.BasicUser2.Email)

	// should fail because channel does not exist
	require.Error(t, runCommand(t, "channel", "remove", th.BasicTeam.Name+":doesnotexist", th.BasicUser2.Email))

	checkCommand(t, "channel", "remove", th.BasicTeam.Name+":"+channel.Name, th.BasicUser2.Email)

	// Leaving twice should succeed
	checkCommand(t, "channel", "remove", th.BasicTeam.Name+":"+channel.Name, th.BasicUser2.Email)
}

func TestListChannels(t *testing.T) {
	th := api.Setup().InitBasic()
	defer th.TearDown()

	channel := th.CreateChannel(th.BasicClient, th.BasicTeam)
	th.BasicClient.Must(th.BasicClient.DeleteChannel(channel.Id))

	output := checkCommand(t, "channel", "list", th.BasicTeam.Name)

	if !strings.Contains(string(output), "town-square") {
		t.Fatal("should have channels")
	}

	if !strings.Contains(string(output), channel.Name+" (archived)") {
		t.Fatal("should have archived channel")
	}
}

func TestRestoreChannel(t *testing.T) {
	th := api.Setup().InitBasic()
	defer th.TearDown()

	channel := th.CreateChannel(th.BasicClient, th.BasicTeam)
	th.BasicClient.Must(th.BasicClient.DeleteChannel(channel.Id))

	checkCommand(t, "channel", "restore", th.BasicTeam.Name+":"+channel.Name)

	// restoring twice should succeed
	checkCommand(t, "channel", "restore", th.BasicTeam.Name+":"+channel.Name)
}

func TestCreateChannel(t *testing.T) {
	th := api.Setup().InitBasic()
	defer th.TearDown()

	id := model.NewId()
	name := "name" + id

	checkCommand(t, "channel", "create", "--display_name", name, "--team", th.BasicTeam.Name, "--name", name)

	name = name + "-private"
	checkCommand(t, "channel", "create", "--display_name", name, "--team", th.BasicTeam.Name, "--private", "--name", name)
}
