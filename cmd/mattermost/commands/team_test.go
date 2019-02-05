// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"strings"
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/stretchr/testify/require"
)

func TestCreateTeam(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	id := model.NewId()
	name := "name" + id
	displayName := "Name " + id

	th.CheckCommand(t, "team", "create", "--name", name, "--display_name", displayName)

	found := th.SystemAdminClient.Must(th.SystemAdminClient.TeamExists(name, "")).(bool)

	if !found {
		t.Fatal("Failed to create Team")
	}
}

func TestJoinTeam(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	th.CheckCommand(t, "team", "add", th.BasicTeam.Name, th.BasicUser.Email)

	profiles := th.SystemAdminClient.Must(th.SystemAdminClient.GetUsersInTeam(th.BasicTeam.Id, 0, 1000, "")).([]*model.User)

	found := false

	for _, user := range profiles {
		if user.Email == th.BasicUser.Email {
			found = true
		}

	}

	if !found {
		t.Fatal("Failed to create User")
	}
}

func TestLeaveTeam(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	th.CheckCommand(t, "team", "remove", th.BasicTeam.Name, th.BasicUser.Email)

	profiles := th.Client.Must(th.Client.GetUsersInTeam(th.BasicTeam.Id, 0, 1000, "")).([]*model.User)

	found := false

	for _, user := range profiles {
		if user.Email == th.BasicUser.Email {
			found = true
		}

	}

	if found {
		t.Fatal("profile should not be on team")
	}

	if result := <-th.App.Srv.Store.Team().GetTeamsByUserId(th.BasicUser.Id); result.Err != nil {
		teamMembers := result.Data.([]*model.TeamMember)
		if len(teamMembers) > 0 {
			t.Fatal("Shouldn't be in team")
		}
	}
}

func TestListTeams(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	id := model.NewId()
	name := "name" + id
	displayName := "Name " + id

	th.CheckCommand(t, "team", "create", "--name", name, "--display_name", displayName)

	output := th.CheckCommand(t, "team", "list", th.BasicTeam.Name, th.BasicUser.Email)

	if !strings.Contains(string(output), name) {
		t.Fatal("should have the created team")
	}
}

func TestListArchivedTeams(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	id := model.NewId()
	name := "name" + id
	displayName := "Name " + id

	th.CheckCommand(t, "team", "create", "--name", name, "--display_name", displayName)

	th.CheckCommand(t, "team", "archive", name)

	output := th.CheckCommand(t, "team", "list", th.BasicTeam.Name, th.BasicUser.Email)

	if !strings.Contains(string(output), name+" (archived)") {
		t.Fatal("should have archived team")
	}
}

func TestSearchTeamsByName(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	id := model.NewId()
	name := "name" + id
	displayName := "Name " + id

	th.CheckCommand(t, "team", "create", "--name", name, "--display_name", displayName)

	output := th.CheckCommand(t, "team", "search", name)

	if !strings.Contains(string(output), name) {
		t.Fatal("should have the created team")
	}
}

func TestSearchTeamsByDisplayName(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	id := model.NewId()
	name := "name" + id
	displayName := "Name " + id

	th.CheckCommand(t, "team", "create", "--name", name, "--display_name", displayName)

	output := th.CheckCommand(t, "team", "search", displayName)

	if !strings.Contains(string(output), name) {
		t.Fatal("should have the created team")
	}
}

func TestSearchArchivedTeamsByName(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	id := model.NewId()
	name := "name" + id
	displayName := "Name " + id

	th.CheckCommand(t, "team", "create", "--name", name, "--display_name", displayName)

	th.CheckCommand(t, "team", "archive", name)

	output := th.CheckCommand(t, "team", "search", name)

	if !strings.Contains(string(output), "(archived)") {
		t.Fatal("should have archived team")
	}
}

func TestArchiveTeams(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	id := model.NewId()
	name := "name" + id
	displayName := "Name " + id

	th.CheckCommand(t, "team", "create", "--name", name, "--display_name", displayName)

	th.CheckCommand(t, "team", "archive", name)

	output := th.CheckCommand(t, "team", "list")

	if !strings.Contains(string(output), name+" (archived)") {
		t.Fatal("should have archived team")
	}
}

func TestRestoreTeams(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	id := model.NewId()
	name := "name" + id
	displayName := "Name " + id

	th.CheckCommand(t, "team", "create", "--name", name, "--display_name", displayName)

	th.CheckCommand(t, "team", "archive", name)

	th.CheckCommand(t, "team", "restore", name)

	found := th.SystemAdminClient.Must(th.SystemAdminClient.TeamExists(name, "")).(bool)

	require.True(t, found)
}
